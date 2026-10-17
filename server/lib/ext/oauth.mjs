// Sosyal hesap bağlantıları (OAuth 2.0 yetkilendirme kodu akışı) + güvenli paylaşım adaptörleri.
// Uygulama (client) bilgileri ve belirteçler sır kasasında şifreli tutulur; arayüze/günlüğe asla çıkmaz.
// Paylaşım YALNIZCA onaylanıp mühürlenmiş (hash eşleşen) gönderiler için, açık kullanıcı eylemiyle ve tek seferlik (idempotent) yapılır.
import crypto from 'node:crypto';
import { q, audit } from '../db.mjs';
import { config } from '../config.mjs';
import { HttpError } from '../http.mjs';
import { setSecret, getSecret, hasSecret, deleteSecret } from './vault.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { PLATFORMS, getPost, markManuallyPublished } from './social.mjs';
import { mediaFilePath } from '../media.mjs';
import { db } from '../db.mjs';
import './schema.mjs';

db.exec(`
CREATE TABLE IF NOT EXISTS social_connections (
  provider TEXT PRIMARY KEY, account_id TEXT, account_label TEXT, scopes TEXT, status TEXT NOT NULL DEFAULT 'bagli',
  connected_at TEXT NOT NULL DEFAULT (datetime('now')), connected_by TEXT, expires_at TEXT, extra TEXT NOT NULL DEFAULT '{}'
);
CREATE TABLE IF NOT EXISTS oauth_states (
  state TEXT PRIMARY KEY, provider TEXT NOT NULL, user_email TEXT, verifier TEXT, redirect TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS social_publish_log (
  key TEXT PRIMARY KEY, post_id INTEGER NOT NULL, platform TEXT NOT NULL, state TEXT NOT NULL DEFAULT 'basladi', remote_id TEXT, ts TEXT NOT NULL DEFAULT (datetime('now'))
);
`);

/* Test ortamında (üretim dışı) tüm uç noktalar sahte sağlayıcıya yönlendirilebilir */
const T = process.env.OAUTH_TEST_BASE && process.env.NODE_ENV !== 'production' ? process.env.OAUTH_TEST_BASE : '';
const U = (real, mock) => (T ? `${T}${mock}` : real);

const json = async (res) => { const t = await res.text(); try { return JSON.parse(t); } catch { return { raw: t.slice(0, 300) }; } };
const get = async (url, headers = {}) => {
  const r = await fetch(url, { headers: { Accept: 'application/json', ...headers }, signal: AbortSignal.timeout(20_000) });
  const d = await json(r);
  if (!r.ok) throw Object.assign(new HttpError(502, `Sağlayıcı hatası (${r.status}): ${String(d.error_description ?? d.error?.message ?? d.message ?? d.error ?? d.raw ?? '').slice(0, 160)}`), { definitive: true });
  return d;
};

/** Sağlayıcı yapılandırmaları (resmî belgelere göre) */
export const PROVIDERS = {
  linkedin: { auth: () => U('https://www.linkedin.com/oauth/v2/authorization', '/linkedin/authorize'), token: () => U('https://www.linkedin.com/oauth/v2/accessToken', '/linkedin/token'), scopes: ['openid', 'profile', 'w_member_social'], sep: ' ', idParam: 'client_id',
    me: async (t) => { const d = await get(U('https://api.linkedin.com/v2/userinfo', '/linkedin/userinfo'), { Authorization: `Bearer ${t}` }); return { id: d.sub, label: d.name ?? d.sub }; } },
  x: { auth: () => U('https://x.com/i/oauth2/authorize', '/x/authorize'), token: () => U('https://api.x.com/2/oauth2/token', '/x/token'), scopes: ['tweet.read', 'tweet.write', 'users.read', 'media.write', 'offline.access'], sep: ' ', idParam: 'client_id', pkce: true, basic: true,
    me: async (t) => { const d = (await get(U('https://api.x.com/2/users/me', '/x/me'), { Authorization: `Bearer ${t}` })).data; return { id: d.id, label: `@${d.username}` }; } },
  facebook: { auth: () => U('https://www.facebook.com/v21.0/dialog/oauth', '/facebook/authorize'), token: () => U('https://graph.facebook.com/v21.0/oauth/access_token', '/facebook/token'), scopes: ['public_profile', 'pages_show_list', 'pages_manage_posts', 'pages_read_engagement'], sep: ',', idParam: 'client_id', meta: true,
    me: async (t) => { const d = await get(U(`https://graph.facebook.com/v21.0/me?fields=id,name&access_token=${encodeURIComponent(t)}`, '/facebook/me')); return { id: d.id, label: d.name }; } },
  instagram: { auth: () => U('https://www.facebook.com/v21.0/dialog/oauth', '/facebook/authorize'), token: () => U('https://graph.facebook.com/v21.0/oauth/access_token', '/facebook/token'), scopes: ['public_profile', 'pages_show_list', 'pages_read_engagement', 'instagram_basic', 'instagram_content_publish'], sep: ',', idParam: 'client_id', meta: true,
    me: async (t) => { const d = await get(U(`https://graph.facebook.com/v21.0/me?fields=id,name&access_token=${encodeURIComponent(t)}`, '/facebook/me')); return { id: d.id, label: d.name }; } },
  youtube: { auth: () => U('https://accounts.google.com/o/oauth2/v2/auth', '/google/authorize'), token: () => U('https://oauth2.googleapis.com/token', '/google/token'), scopes: ['https://www.googleapis.com/auth/youtube.readonly', 'https://www.googleapis.com/auth/youtube.upload'], sep: ' ', idParam: 'client_id', pkce: true, extra: { access_type: 'offline', prompt: 'consent' },
    me: async (t) => { const d = await get(U('https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true', '/google/channels'), { Authorization: `Bearer ${t}` }); const c = d.items?.[0]; if (!c) throw new HttpError(409, 'Bu Google hesabında YouTube kanalı bulunamadı'); return { id: c.id, label: c.snippet?.title ?? c.id }; } },
  threads: { auth: () => U('https://threads.net/oauth/authorize', '/threads/authorize'), token: () => U('https://graph.threads.net/oauth/access_token', '/threads/token'), scopes: ['threads_basic', 'threads_content_publish'], sep: ',', idParam: 'client_id', longLived: true,
    me: async (t) => { const d = await get(U(`https://graph.threads.net/v1.0/me?fields=id,username&access_token=${encodeURIComponent(t)}`, '/threads/me')); return { id: d.id, label: `@${d.username}` }; } },
  pinterest: { boards: true, auth: () => U('https://www.pinterest.com/oauth/', '/pinterest/authorize'), token: () => U('https://api.pinterest.com/v5/oauth/token', '/pinterest/token'), scopes: ['boards:read', 'pins:read', 'pins:write', 'user_accounts:read'], sep: ',', idParam: 'client_id', basic: true,
    me: async (t) => { const d = await get(U('https://api.pinterest.com/v5/user_account', '/pinterest/me'), { Authorization: `Bearer ${t}` }); return { id: d.id ?? d.username, label: d.username }; } },
  tiktok: { auth: () => U('https://www.tiktok.com/v2/auth/authorize/', '/tiktok/authorize'), token: () => U('https://open.tiktokapis.com/v2/oauth/token/', '/tiktok/token'), scopes: ['user.info.basic', 'video.publish'], sep: ',', idParam: 'client_key', secretParam: 'client_secret',
    me: async (t) => { const d = (await get(U('https://open.tiktokapis.com/v2/user/info/?fields=open_id,display_name', '/tiktok/me'), { Authorization: `Bearer ${t}` })).data?.user ?? {}; return { id: d.open_id, label: d.display_name ?? d.open_id }; } },
};

const TOK = { min: 4, max: 4096 }; // gerçek OAuth belirteçleri 600 karakteri aşabilir
const sec = (p, k) => `social.${p}.${k}`;
const cfgOf = (p) => { const c = PROVIDERS[p]; if (!c) throw new HttpError(400, 'Bilinmeyen platform'); return c; };
const row = (p) => q.get('SELECT * FROM social_connections WHERE provider = ?', p);

export const redirectUri = (base, p) => `${String(base).replace(/\/$/, '')}/api/admin/x/oauth/cb/${p}`;

export const saveApp = (p, clientId, clientSecret, user) => {
  cfgOf(p);
  const id = String(clientId ?? '').trim(), secret = String(clientSecret ?? '').trim();
  if (id.length < 6 || secret.length < 8 || /\s/.test(id + secret)) throw new HttpError(400, 'Client ID ve Client Secret geçerli görünmüyor (boşluk içermemeli)');
  setSecret(sec(p, 'id'), id, user, TOK);
  setSecret(sec(p, 'secret'), secret, user, TOK);
  audit(user, 'sosyal.uygulama_kaydet', p);
};
export const removeApp = (p, user) => {
  disconnect(p, user, true);
  for (const k of ['id', 'secret']) if (hasSecret(sec(p, k))) deleteSecret(sec(p, k), user);
};

/* ------------------------------ yetkilendirme ------------------------------ */
export const startAuth = (p, user, base) => {
  const cfg = cfgOf(p);
  const id = getSecret(sec(p, 'id'));
  if (!id || !getSecret(sec(p, 'secret'))) throw new HttpError(409, 'Önce uygulama bilgilerini (Client ID/Secret) kaydedin');
  q.run(`DELETE FROM oauth_states WHERE created_at < datetime('now','-10 minutes')`);
  const state = crypto.randomBytes(24).toString('base64url');
  const verifier = cfg.pkce ? crypto.randomBytes(48).toString('base64url') : null;
  const redirect = redirectUri(base, p);
  q.run('INSERT INTO oauth_states (state, provider, user_email, verifier, redirect) VALUES (?,?,?,?,?)', state, p, user.email, verifier, redirect);
  const params = new URLSearchParams({ response_type: 'code', [cfg.idParam]: id, redirect_uri: redirect, scope: cfg.scopes.join(cfg.sep), state, ...(cfg.extra ?? {}) });
  if (verifier) { params.set('code_challenge', crypto.createHash('sha256').update(verifier).digest('base64url')); params.set('code_challenge_method', 'S256'); }
  audit(user, 'sosyal.baglan_basla', p);
  return `${cfg.auth()}?${params}`;
};

const tokenRequest = async (p, params) => {
  const cfg = cfgOf(p);
  const id = getSecret(sec(p, 'id')), secret = getSecret(sec(p, 'secret'));
  const body = new URLSearchParams(params);
  const headers = { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' };
  if (cfg.basic) { headers.Authorization = `Basic ${Buffer.from(`${id}:${secret}`).toString('base64')}`; body.set(cfg.idParam, id); }
  else { body.set(cfg.idParam, id); body.set(cfg.secretParam ?? 'client_secret', secret); }
  const r = await fetch(cfg.token(), { method: 'POST', headers, body, signal: AbortSignal.timeout(20_000) });
  const d = await json(r);
  if (!r.ok || d.error || !d.access_token) throw new HttpError(502, `Belirteç alınamadı (${r.status}): ${String(d.error_description ?? d.error?.message ?? d.error ?? d.message ?? d.raw ?? 'bilinmeyen hata').slice(0, 160)}`);
  return d;
};

const storeTokens = (p, d, user) => {
  setSecret(sec(p, 'access'), d.access_token, user, TOK);
  if (d.refresh_token) setSecret(sec(p, 'refresh'), d.refresh_token, user, TOK);
  return d.expires_in ? new Date(Date.now() + Number(d.expires_in) * 1000).toISOString().slice(0, 19).replace('T', ' ') : null;
};

const fbPages = async (p, userToken) => {
  const d = await get(U(`https://graph.facebook.com/v21.0/me/accounts?fields=id,name,access_token,instagram_business_account%7Bid,username%7D&limit=50&access_token=${encodeURIComponent(userToken)}`, '/facebook/accounts'));
  return d.data ?? [];
};

/** Geri çağrı: state tek kullanımlıktır ve oturum çerezine bağlı DEĞİLDİR (SameSite=Strict çerez sağlayıcıdan dönüşte gönderilmez). */
export const handleCallback = async (p, query) => {
  const cfg = cfgOf(p);
  const st = q.get(`SELECT * FROM oauth_states WHERE state = ? AND created_at >= datetime('now','-10 minutes')`, String(query.state ?? ''));
  if (!st || st.provider !== p) throw new HttpError(400, 'Geçersiz veya süresi dolmuş yetkilendirme isteği — baştan deneyin');
  q.run('DELETE FROM oauth_states WHERE state = ?', st.state);
  if (query.error) throw new HttpError(400, `Platform yetkilendirmeyi reddetti: ${String(query.error_description ?? query.error).slice(0, 160)}`);
  if (!query.code) throw new HttpError(400, 'Yetkilendirme kodu gelmedi');
  const user = { email: st.user_email };
  const params = { grant_type: 'authorization_code', code: String(query.code), redirect_uri: st.redirect };
  if (st.verifier) params.code_verifier = st.verifier;
  let d = await tokenRequest(p, params);
  if (cfg.meta) {
    // kısa ömürlü kullanıcı belirtecini uzun ömürlüye çevir
    const ll = await tokenRequest(p, { grant_type: 'fb_exchange_token', fb_exchange_token: d.access_token }).catch(() => null);
    if (ll?.access_token) d = ll;
  }
  if (cfg.longLived) {
    const id = getSecret(sec(p, 'secret'));
    const ll = await get(U(`https://graph.threads.net/access_token?grant_type=th_exchange_token&client_secret=${encodeURIComponent(id)}&access_token=${encodeURIComponent(d.access_token)}`, '/threads/long')).catch(() => null);
    if (ll?.access_token) d = { ...d, ...ll };
  }
  const expires = storeTokens(p, d, user);
  const acct = await cfg.me(d.access_token);
  const extra = {};
  if (cfg.boards) {
    const bd = await get(U('https://api.pinterest.com/v5/boards?page_size=50', '/pinterest/boards'), { Authorization: `Bearer ${d.access_token}` });
    extra.options = (bd.items ?? []).map((x) => ({ id: x.id, label: x.name }));
    if (!extra.options.length) extra.warning = 'Pinterest hesabında pano bulunamadı — önce bir pano oluşturun';
    if (extra.options.length === 1) extra.selected = extra.options[0];
  }
  if (cfg.meta) {
    const pages = await fbPages(p, d.access_token);
    const list = p === 'instagram' ? pages.filter((x) => x.instagram_business_account) : pages;
    extra.options = list.map((x) => ({ id: p === 'instagram' ? x.instagram_business_account.id : x.id, label: p === 'instagram' ? `@${x.instagram_business_account.username} (${x.name})` : x.name, page: x.id }));
    if (!extra.options.length) extra.warning = p === 'instagram' ? 'Bağlı bir Instagram Business hesabı olan Facebook Sayfası bulunamadı' : 'Yönetici olduğunuz bir Facebook Sayfası bulunamadı';
    if (extra.options.length === 1) await selectOption(p, extra.options[0].id, user, extra, d.access_token);
  }
  q.run(`INSERT INTO social_connections (provider, account_id, account_label, scopes, status, connected_by, expires_at, extra, connected_at) VALUES (?,?,?,?, 'bagli', ?,?,?, datetime('now'))
         ON CONFLICT(provider) DO UPDATE SET account_id = excluded.account_id, account_label = excluded.account_label, scopes = excluded.scopes, status = 'bagli', connected_by = excluded.connected_by, expires_at = excluded.expires_at, extra = excluded.extra, connected_at = datetime('now')`,
    p, String(acct.id ?? ''), String(acct.label ?? ''), cfg.scopes.join(' '), st.user_email, expires, JSON.stringify(extra));
  audit(user, 'sosyal.baglandi', p, acct.label);
  return { provider: p, label: acct.label };
};

/** Facebook Sayfası / Instagram hesabı seçimi */
async function selectOption(p, optionId, user, extraObj, userToken) {
  const r = row(p);
  const extra = extraObj ?? JSON.parse(r?.extra ?? '{}');
  const opt = (extra.options ?? []).find((o) => String(o.id) === String(optionId));
  if (!opt) throw new HttpError(400, 'Geçersiz seçim');
  if (PROVIDERS[p].boards) {
    extra.selected = { id: opt.id, label: opt.label };
    if (!extraObj) q.run('UPDATE social_connections SET extra = ? WHERE provider = ?', JSON.stringify(extra), p);
    return audit(user, 'sosyal.secim', p, opt.label);
  }
  const token = userToken ?? getSecret(sec(p, 'access'));
  const page = (await fbPages(p, token)).find((x) => x.id === opt.page);
  if (!page?.access_token) throw new HttpError(502, 'Sayfa erişim belirteci alınamadı (yetki eksik olabilir)');
  setSecret(sec(p, 'page'), page.access_token, user, TOK);
  extra.selected = { id: opt.id, label: opt.label, page: opt.page };
  if (!extraObj) q.run('UPDATE social_connections SET extra = ? WHERE provider = ?', JSON.stringify(extra), p);
  audit(user, 'sosyal.secim', p, opt.label);
}
export const selectAccount = (p, optionId, user) => { if (!row(p)) throw new HttpError(409, 'Önce hesabı bağlayın'); return selectOption(p, optionId, user); };

export const disconnect = (p, user, silent = false) => {
  cfgOf(p);
  for (const k of ['access', 'refresh', 'page']) if (hasSecret(sec(p, k))) deleteSecret(sec(p, k), user);
  q.run('DELETE FROM social_connections WHERE provider = ?', p);
  if (!silent) audit(user, 'sosyal.baglanti_kes', p);
};

/** Geçerli erişim belirteci (süresi yaklaştıysa yenilenir) */
export const accessToken = async (p) => {
  const r = row(p);
  if (!r) throw new HttpError(409, 'Hesap bağlı değil');
  const exp = r.expires_at ? new Date(`${r.expires_at.replace(' ', 'T')}Z`).getTime() : null;
  if (exp && exp - Date.now() < 5 * 60_000) {
    const refresh = getSecret(sec(p, 'refresh'));
    if (!refresh) { q.run(`UPDATE social_connections SET status = 'yenilenmeli' WHERE provider = ?`, p); throw new HttpError(401, 'Bağlantı süresi doldu — hesabı yeniden bağlayın'); }
    try {
      const d = await tokenRequest(p, { grant_type: 'refresh_token', refresh_token: refresh });
      const e = storeTokens(p, { ...d, refresh_token: d.refresh_token ?? refresh }, { email: 'sistem' });
      q.run('UPDATE social_connections SET expires_at = ?, status = ? WHERE provider = ?', e, 'bagli', p);
    } catch (e) { q.run(`UPDATE social_connections SET status = 'yenilenmeli' WHERE provider = ?`, p); throw new HttpError(401, `Belirteç yenilenemedi — hesabı yeniden bağlayın (${e.message})`); }
  }
  return getSecret(sec(p, 'access'));
};

/* ------------------------------ paylaşım adaptörleri (yalnızca metin) ------------------------------ */
const post = async (url, { headers = {}, json: body, form }) => {
  let r;
  try {
    r = await fetch(url, { method: 'POST', headers: { Accept: 'application/json', ...(form ? { 'Content-Type': 'application/x-www-form-urlencoded' } : { 'Content-Type': 'application/json' }), ...headers }, body: form ? new URLSearchParams(form) : JSON.stringify(body), signal: AbortSignal.timeout(25_000) });
  } catch (e) { throw Object.assign(new HttpError(504, `Platforma ulaşılamadı veya yanıt gelmedi (${e.name === 'TimeoutError' ? 'zaman aşımı' : e.message}) — gönderinin ulaşıp ulaşmadığını platformda kontrol edin`), { definitive: false }); }
  const d = await json(r);
  if (!r.ok) throw Object.assign(new HttpError(502, `Platform paylaşımı reddetti (${r.status}): ${String(d.detail ?? d.error?.message ?? d.message ?? d.title ?? d.raw ?? '').slice(0, 200)}`), { definitive: true });
  return { d, r };
};
const liEscape = (s) => s.replace(/([|{}@[\]()<>\\*_~])/g, '\\$1');
const pageToken = (p) => { const t = getSecret(sec(p, 'page')); if (!t) throw new HttpError(409, 'Önce paylaşım yapılacak hesabı/sayfayı seçin'); return t; };
const selected = (extra) => { if (!extra.selected) throw new HttpError(409, 'Önce paylaşım yapılacak hesabı/sayfayı seçin'); return extra.selected; };
const putBinary = async (url, buf, headers) => {
  let r;
  try { r = await fetch(url, { method: 'PUT', headers: { 'Content-Type': 'application/octet-stream', ...headers }, body: buf, signal: AbortSignal.timeout(60_000) }); }
  catch (e) { throw Object.assign(new HttpError(504, `Görsel yüklenemedi (${e.message})`), { definitive: true }); } // gönderi henüz oluşmadı: yeniden denenebilir
  if (!r.ok) throw Object.assign(new HttpError(502, `Görsel yükleme reddedildi (${r.status})`), { definitive: true });
};

/** media: { file, url, mime, alt } | null */
const ADAPTERS = {
  linkedin: async (text, tok, acct, extra, media) => {
    const H = { Authorization: `Bearer ${tok}`, 'LinkedIn-Version': '202405', 'X-Restli-Protocol-Version': '2.0.0' };
    const owner = `urn:li:person:${acct.account_id}`;
    let content;
    if (media) {
      const init = await post(U('https://api.linkedin.com/rest/images?action=initializeUpload', '/linkedin/images'), { headers: H, json: { initializeUploadRequest: { owner } } });
      const v = init.d.value;
      if (!v?.uploadUrl || !v?.image) throw Object.assign(new HttpError(502, 'LinkedIn görsel yükleme adresi vermedi'), { definitive: true });
      await putBinary(T ? `${T}${new URL(v.uploadUrl).pathname}` : v.uploadUrl, fs.readFileSync(media.file), { Authorization: `Bearer ${tok}` });
      content = { media: { id: v.image, altText: media.alt.slice(0, 300) } };
    }
    const { r, d } = await post(U('https://api.linkedin.com/rest/posts', '/linkedin/posts'), { headers: H,
      json: { author: owner, commentary: liEscape(text), visibility: 'PUBLIC', distribution: { feedDistribution: 'MAIN_FEED', targetEntities: [], thirdPartyDistributionChannels: [] }, ...(content ? { content } : {}), lifecycleState: 'PUBLISHED', isReshareDisabledByAuthor: false } });
    return r.headers.get('x-restli-id') ?? d.id ?? 'linkedin';
  },
  x: async (text, tok, acct, extra, media) => {
    let mediaIds;
    if (media) {
      const fd = new FormData();
      fd.set('media', new Blob([fs.readFileSync(media.file)], { type: media.mime }), path.basename(media.file));
      fd.set('media_category', 'tweet_image');
      let r;
      try { r = await fetch(U('https://api.x.com/2/media/upload', '/x/media'), { method: 'POST', headers: { Authorization: `Bearer ${tok}` }, body: fd, signal: AbortSignal.timeout(60_000) }); }
      catch (e) { throw Object.assign(new HttpError(504, `Görsel yüklenemedi (${e.message})`), { definitive: true }); }
      const d = await json(r);
      const id = d.data?.id ?? d.media_id_string;
      if (!r.ok || !id) throw Object.assign(new HttpError(502, `X görsel yükleme reddedildi (${r.status}): ${String(d.detail ?? d.title ?? d.raw ?? '').slice(0, 160)}`), { definitive: true });
      mediaIds = [String(id)];
    }
    return (await post(U('https://api.x.com/2/tweets', '/x/tweets'), { headers: { Authorization: `Bearer ${tok}` }, json: { text, ...(mediaIds ? { media: { media_ids: mediaIds } } : {}) } })).d.data?.id ?? 'x';
  },
  facebook: async (text, tok, acct, extra, media) => {
    const pageId = selected(extra).page ?? extra.selected.id;
    const pt = pageToken('facebook');
    if (media) return (await post(U(`https://graph.facebook.com/v21.0/${pageId}/photos`, '/facebook/photos'), { form: { url: media.url, caption: text, access_token: pt } })).d.post_id ?? 'facebook';
    return (await post(U(`https://graph.facebook.com/v21.0/${pageId}/feed`, '/facebook/feed'), { form: { message: text, access_token: pt } })).d.id ?? 'facebook';
  },
  instagram: async (text, tok, acct, extra, media) => {
    if (!media) throw new HttpError(422, 'Instagram yalnızca görselli gönderiyle paylaşılabilir');
    if (media.mime !== 'image/jpeg') throw new HttpError(422, 'Instagram yalnızca JPEG görseli kabul eder — görseli JPEG olarak yükleyin');
    const igId = selected(extra).id, pt = pageToken('instagram');
    const c = await post(U(`https://graph.facebook.com/v21.0/${igId}/media`, '/facebook/ig-media'), { form: { image_url: media.url, caption: text, access_token: pt } });
    return (await post(U(`https://graph.facebook.com/v21.0/${igId}/media_publish`, '/facebook/ig-publish'), { form: { creation_id: c.d.id, access_token: pt } })).d.id ?? 'instagram';
  },
  threads: async (text, tok, acct, extra, media) => {
    const c = await post(U(`https://graph.threads.net/v1.0/${acct.account_id}/threads`, '/threads/create'), { form: { media_type: media ? 'IMAGE' : 'TEXT', text, ...(media ? { image_url: media.url } : {}), access_token: tok } });
    const p = await post(U(`https://graph.threads.net/v1.0/${acct.account_id}/threads_publish`, '/threads/publish'), { form: { creation_id: c.d.id, access_token: tok } });
    return p.d.id ?? 'threads';
  },
  pinterest: async (text, tok, acct, extra, media, title) => {
    if (!media) throw new HttpError(422, 'Pinterest yalnızca görselli pin paylaşır');
    const board = selected(extra);
    return (await post(U('https://api.pinterest.com/v5/pins', '/pinterest/pins'), { headers: { Authorization: `Bearer ${tok}` }, json: { board_id: board.id, title: title.slice(0, 100), description: text.slice(0, 500), media_source: { source_type: 'image_url', url: media.url } } })).d.id ?? 'pinterest';
  },
};
export const canPublish = (p) => !!ADAPTERS[p];

/** Onaylı + mühürlü gönderiyi bağlı hesaba GÖNDERİR (açık kullanıcı eylemi). Her gönderi/platform çifti en fazla bir kez gönderilir. */
export const publishNow = async (postId, platform, user) => {
  if (!ADAPTERS[platform]) throw new HttpError(409, `${PLATFORMS[platform]?.label ?? platform} için otomatik yayın henüz desteklenmiyor — gönderiyi platformda kendiniz paylaşıp "elle yayımlandı" işaretleyin`);
  const p = getPost(postId);
  if (!p.platforms.includes(platform)) throw new HttpError(400, 'Bu platform gönderide seçili değil');
  if (!['onaylandi', 'planlandi'].includes(p.status)) throw new HttpError(409, 'Yalnızca onaylı veya planlı gönderi yayımlanabilir');
  if (!p.approved_hash || p.approved_hash !== p.content_hash) throw new HttpError(409, 'Onaylı sürümle içerik eşleşmiyor — yeniden onaylayın');
  if (p.platform_post_ids[platform]) throw new HttpError(409, 'Bu platform için zaten yayımlandı');
  let media = null;
  if (p.media) {
    const name = p.media.startsWith('/medya/') ? p.media.slice(7) : '';
    const file = name && mediaFilePath(name);
    if (!file) throw new HttpError(422, 'Görsel medya kitaplığında bulunamadı (yalnızca /medya/ altındaki görseller paylaşılır)');
    const mime = ({ '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.gif': 'image/gif' })[path.extname(file).toLowerCase()];
    if (!mime) throw new HttpError(422, 'Yalnızca JPEG/PNG/WebP/GIF görseller otomatik paylaşılır (video için platformda elle paylaşın)');
    if (fs.statSync(file).size > 8 * 1024 * 1024) throw new HttpError(422, 'Görsel 8 MB sınırını aşıyor');
    const site = String(config.siteUrl ?? '').replace(/\/$/, '');
    if (!T && !/^https:\/\//.test(site)) throw new HttpError(409, 'Görselin herkese açık HTTPS adresi gerekir (PUBLIC_SITE_URL ayarlanmamış)');
    media = { file, mime, url: `${site}${p.media}`, alt: p.title || 'Görsel' };
  }
  const acct = row(platform);
  if (!acct) throw new HttpError(409, 'Hesap bağlı değil');
  const text = `${p.body}${p.hashtags ? `\n\n${p.hashtags}` : ''}`.trim();
  const key = `${p.idempotency_key}:${platform}`;
  try { q.run('INSERT INTO social_publish_log (key, post_id, platform) VALUES (?,?,?)', key, postId, platform); } catch { throw new HttpError(409, 'Bu gönderi bu platforma zaten gönderilmiş veya gönderiliyor — platformu kontrol edin'); }
  try {
    const tok = await accessToken(platform);
    const remote = await ADAPTERS[platform](text, tok, acct, JSON.parse(acct.extra || '{}'), media, p.title);
    q.run(`UPDATE social_publish_log SET state = 'tamam', remote_id = ? WHERE key = ?`, String(remote), key);
    const out = markManuallyPublished(postId, platform, String(remote), user);
    audit(user, 'sosyal.yayimlandi', String(postId), `${platform}:${remote}`);
    return out;
  } catch (e) {
    if (e.definitive !== false) q.run('DELETE FROM social_publish_log WHERE key = ?', key); // kesin ret: yeniden denenebilir
    else q.run(`UPDATE social_publish_log SET state = 'belirsiz' WHERE key = ?`, key); // sonuç belirsiz: çift gönderimi önlemek için kilitli kalır
    q.run('UPDATE social_posts SET review_note = ? WHERE id = ?', `Yayın hatası (${platform}): ${String(e.message).slice(0, 200)}`, postId);
    audit(user, 'sosyal.yayin_hatasi', String(postId), `${platform}: ${String(e.message).slice(0, 120)}`);
    throw e;
  }
};

/* ------------------------------ panel listesi ------------------------------ */
export const listAccounts = (base) =>
  Object.entries(PLATFORMS).map(([id, pl]) => {
    const c = PROVIDERS[id];
    const r = row(id);
    const extra = r ? JSON.parse(r.extra || '{}') : {};
    return {
      id, label: pl.label, url: pl.url, docs: pl.docs, needs: pl.needs,
      hasApp: hasSecret(sec(id, 'id')) && hasSecret(sec(id, 'secret')),
      connected: !!r && r.status === 'bagli', status: r?.status ?? null,
      account: r ? { id: r.account_id, label: r.account_label, connectedAt: r.connected_at, by: r.connected_by, expiresAt: r.expires_at } : null,
      options: extra.options ?? null, selected: extra.selected ?? null, warning: extra.warning ?? null,
      redirectUri: redirectUri(base, id), scopes: c.scopes, publish: canPublish(id),
    };
  });
