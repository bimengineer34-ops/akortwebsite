// Yönetim API'si ve herkese açık form uç noktaları — yol tablosu
import fs from 'node:fs';
import path from 'node:path';
import { q, audit } from './db.mjs';
import { config, paths } from './config.mjs';
import { HttpError, readJson, readBody, sendJson, sendText, clientIp, baseHeaders } from './http.mjs';
import {
  authenticate, requireUser, requireAdmin, login, logout, createUser, hashPassword, verifyPassword, validatePassword, validateEmail, userCount, revokeUserSessions,
  checkCredentials, createSession,
} from './auth.mjs';
import { requestReset, completeReset } from './reset.mjs';
import { getStats } from './stats.mjs';
import { totpStatus,beginSetup, enable as enable2fa, disable as disable2fa, adminReset as reset2fa, issueTicket, redeemTicket } from './totp.mjs';
import { listDocs, getDoc, saveDraft, discardDraft, listVersions, getVersion, defaultsOf, pendingDrafts, scanUnverified } from './content.mjs';
import { publish, rollback, buildState, listBuilds, getBuildLog } from './build.mjs';
import { submitContact, subscribe, listForms, getForm, updateForm, deleteForm, formsCsv, listSubscribers, setSubscriberStatus, deleteSubscriber, subscribersCsv } from './forms.mjs';
import { uploadMedia, listMedia, updateMedia, deleteMedia, getMedia, mediaUsage } from './media.mjs';
import { smtpStatus, getRecipients, setRecipients, sendMail } from './mail.mjs';
import { listRedirects, saveRedirect, deleteRedirect } from './redirects.mjs';
import { createBackup, listBackups, backupPath } from './backup.mjs';
import { listEntries, getEntry, saveEntry, deleteEntry, ENTRY_KINDS, isDirty } from './entries.mjs';
import { extRoutes } from './ext/routes.mjs';
import { ROLE_IDS, ROLES, denyReason, writableAreas } from './rbac.mjs';

const num = (v) => {
  const n = Number(v);
  if (!Number.isInteger(n) || n < 0) throw new HttpError(400, 'Geçersiz kimlik');
  return n;
};

const iconNames = () => {
  const out = [];
  const walk = (d, pre) => {
    if (!fs.existsSync(d)) return;
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      if (e.isDirectory()) walk(path.join(d, e.name), `${pre}${e.name}/`);
      else if (e.name.endsWith('.svg')) out.push(`${pre}${e.name.slice(0, -4)}`);
    }
  };
  walk(paths.iconsDir, '');
  return out.sort();
};

/** Yalnızca GELİŞTİRME: istek doğrudan yerel makineden geliyorsa (soket adresi loopback) ve üretim modunda değilse e-posta alanı önceden doldurulur. Parola ASLA gönderilmez. */
const devLoginHint = (req) => {
  const ra = req.socket.remoteAddress ?? '';
  const local = ra === '127.0.0.1' || ra === '::1' || ra === '::ffff:127.0.0.1';
  return local && !config.secureCookies && !config.trustProxy ? config.bootstrapEmail : '';
};

const publicUser = (u) => ({ id: u.id, email: u.email, name: u.name, role: u.role, roleLabel: ROLES[u.role]?.label ?? u.role, areas: writableAreas(u.role), readCrm: !denyReason(u.role, 'GET', '/api/admin/formlar') });
const me = (req) => {
  const u = authenticate(req);
  return u ? { ...publicUser(u), csrf: u.csrf } : null;
};

/** [yöntem, regex, işleyici(ctx)] — ctx: { req, res, url, m (regex grupları) } */
export const routes = [
  /* ---------- herkese açık ---------- */
  ['GET', /^\/api\/saglik$/, ({ res }) => sendJson(res, 200, { ok: true, ts: Date.now() })],
  [
    'POST',
    /^\/api\/iletisim$/,
    async ({ req, res }) => {
      const body = await readJson(req, 64 * 1024);
      const r = submitContact(body, clientIp(req), req.headers['user-agent']);
      sendJson(res, 200, { ok: true, id: r.id ?? undefined });
    },
  ],
  [
    'POST',
    /^\/api\/bulten$/,
    async ({ req, res }) => {
      subscribe(await readJson(req, 8 * 1024), clientIp(req));
      sendJson(res, 200, { ok: true });
    },
  ],

  /* ---------- oturum ---------- */
  [
    'GET',
    /^\/api\/admin\/durum$/,
    ({ req, res }) => sendJson(res, 200, { setupRequired: userCount() === 0, user: me(req), siteUrl: config.siteUrl, ticker: Date.now(), loginHint: devLoginHint(req) }),
  ],
  [
    'POST',
    /^\/api\/admin\/kurulum$/,
    async ({ req, res }) => {
      if (userCount() > 0) throw new HttpError(403, 'Kurulum zaten tamamlanmış');
      const b = await readJson(req, 8 * 1024);
      createUser({ email: b.email, name: b.name || 'Yönetici', role: 'admin', password: b.password });
      audit(null, 'kurulum.ilk_yonetici', String(b.email).toLowerCase(), '', clientIp(req));
      const { user, cookie } = login(b.email, b.password, clientIp(req), req.headers['user-agent']);
      sendJson(res, 200, { ok: true, user: publicUser(user) }, { 'Set-Cookie': cookie });
    },
  ],
  [
    'POST',
    /^\/api\/admin\/giris$/,
    async ({ req, res }) => {
      const b = await readJson(req, 8 * 1024);
      const ip = clientIp(req);
      const user = checkCredentials(b.email, b.password, ip);
      if (user.totp_enabled) return sendJson(res, 200, { ok: true, need2fa: true, ticket: issueTicket(user.id, ip) });
      const s = createSession(user, ip, req.headers['user-agent'], b.remember === true);
      sendJson(res, 200, { ok: true, user: publicUser(s.user) }, { 'Set-Cookie': s.cookie });
    },
  ],
  [
    'POST',
    /^\/api\/admin\/giris\/2fa$/,
    async ({ req, res }) => {
      const b = await readJson(req, 4 * 1024);
      const ip = clientIp(req);
      const user = redeemTicket(String(b.ticket ?? ''), b.code, ip);
      const s = createSession(user, ip, req.headers['user-agent'], b.remember === true);
      sendJson(res, 200, { ok: true, user: publicUser(s.user) }, { 'Set-Cookie': s.cookie });
    },
  ],
  [
    'POST',
    /^\/api\/admin\/parola-unuttum$/,
    async ({ req, res }) => sendJson(res, 200, await requestReset((await readJson(req, 2048)).email, clientIp(req))),
  ],
  [
    'POST',
    /^\/api\/admin\/parola-sifirla$/,
    async ({ req, res }) => {
      const b = await readJson(req, 4096);
      completeReset(b.token, b.password, clientIp(req));
      sendJson(res, 200, { ok: true });
    },
  ],
  ['GET', /^\/api\/admin\/2fa$/,({ req, res }) => sendJson(res, 200, totpStatus(requireUser(req).id))],
  ['POST', /^\/api\/admin\/2fa\/baslat$/, ({ req, res }) => sendJson(res, 200, beginSetup(requireUser(req)))],
  [
    'POST',
    /^\/api\/admin\/2fa\/etkinlestir$/,
    async ({ req, res }) => {
      const u = requireUser(req);
      sendJson(res, 200, { ok: true, recoveryCodes: enable2fa(u, (await readJson(req, 1024)).code, clientIp(req)) });
    },
  ],
  [
    'POST',
    /^\/api\/admin\/2fa\/kapat$/,
    async ({ req, res }) => {
      const u = requireUser(req);
      const b = await readJson(req, 2048);
      disable2fa(u, b.password, b.code, clientIp(req));
      sendJson(res, 200, { ok: true });
    },
  ],
  [
    'POST',
    /^\/api\/admin\/cikis$/,
    ({ req, res }) => {
      const u = authenticate(req);
      if (u) audit(u, 'cikis', u.email, '', clientIp(req));
      sendJson(res, 200, { ok: true }, { 'Set-Cookie': logout(req) });
    },
  ],
  [
    'POST',
    /^\/api\/admin\/parola$/,
    async ({ req, res }) => {
      const u = requireUser(req);
      const b = await readJson(req, 4 * 1024);
      const row = q.get('SELECT pass_hash FROM users WHERE id = ?', u.id);
      if (!verifyPassword(String(b.current ?? ''), row.pass_hash)) throw new HttpError(400, 'Mevcut parola hatalı');
      const err = validatePassword(b.next);
      if (err) throw new HttpError(400, err);
      q.run('UPDATE users SET pass_hash = ? WHERE id = ?', hashPassword(b.next), u.id);
      revokeUserSessions(u.id, u.sid); // diğer oturumları kapat
      audit(u, 'parola.degistir', u.email, '', clientIp(req));
      sendJson(res, 200, { ok: true });
    },
  ],

  /* ---------- pano ---------- */
  [
    'GET',
    /^\/api\/admin\/pano$/,
    ({ req, res }) => {
      const u0 = requireUser(req);
      const forms = q.get(`SELECT COUNT(*) AS n, SUM(status = 'yeni') AS fresh FROM forms`);
      const lastBuild = q.get('SELECT id, status, started_at, finished_at, user_email, summary FROM builds ORDER BY id DESC LIMIT 1');
      const lastOk = q.get(`SELECT finished_at FROM builds WHERE status = 'basarili' ORDER BY id DESC LIMIT 1`);
      const unverified = scanUnverified();
      sendJson(res, 200, {
        forms: { total: forms.n, fresh: forms.fresh ?? 0 },
        subscribers: q.get(`SELECT COUNT(*) AS n FROM subscribers WHERE status = 'aktif'`).n,
        media: q.get('SELECT COUNT(*) AS n FROM media').n,
        drafts: pendingDrafts(),
        entriesDirty: isDirty(),
        lastBuild,
        lastPublish: lastOk?.finished_at ?? null,
        unverifiedCount: unverified.length,
        recentForms: q.all('SELECT id, created_at, name, email, subject, status FROM forms ORDER BY id DESC LIMIT 6'),
        recentAudit: q.all('SELECT ts, user_email, action, target FROM audit ORDER BY id DESC LIMIT 10'),
        blog: { total: listEntries('blog').length, drafts: listEntries('blog').filter((e) => e.draft).length },
        projects: { total: listEntries('projects').length, drafts: listEntries('projects').filter((e) => e.draft).length },
        docs: listDocs().length,
        views7: getStats(7).total,
        myTwoFactor: totpStatus(u0.id).enabled,
        node: process.version,
        uptime: Math.round(process.uptime()),
      });
    },
  ],
  ['GET', /^\/api\/admin\/istatistik$/, ({ req, res, url }) => (requireUser(req), sendJson(res, 200, getStats(url.searchParams.get('gun') ?? 30)))],
  ['GET', /^\/api\/admin\/dogrulama$/, ({ req, res }) => (requireUser(req), sendJson(res, 200, { rows: scanUnverified() }))],
  [
    'GET',
    /^\/api\/admin\/simge\/([a-z0-9_/-]+)$/,
    ({ req, res, m }) => {
      requireUser(req);
      const file = path.join(paths.iconsDir, `${m[1]}.svg`);
      if (!file.startsWith(paths.iconsDir) || !fs.existsSync(file)) throw new HttpError(404, 'Simge yok');
      res.writeHead(200, baseHeaders({ 'Content-Type': 'image/svg+xml', 'Cache-Control': 'private, max-age=3600', 'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'" }));
      res.end(fs.readFileSync(file).toString().replace(/currentColor/g, '#0b4f80'));
    },
  ],
  ['GET', /^\/api\/admin\/simgeler$/, ({ req, res }) => (requireUser(req), sendJson(res, 200, { icons: iconNames() }))],

  /* ---------- içerik belgeleri ---------- */
  ['GET', /^\/api\/admin\/icerik$/, ({ req, res }) => (requireUser(req), sendJson(res, 200, { docs: listDocs() }))],
  ['GET', /^\/api\/admin\/icerik\/([\w.-]+)$/, ({ req, res, m }) => (requireUser(req), sendJson(res, 200, getDoc(m[1])))],
  [
    'PUT',
    /^\/api\/admin\/icerik\/([\w.-]+)$/,
    async ({ req, res, m }) => {
      const u = requireUser(req);
      const b = await readJson(req, 4 * 1024 * 1024);
      if (b.value === undefined) throw new HttpError(400, 'value gerekli');
      saveDraft(m[1], b.value, u, String(b.note ?? '').slice(0, 200));
      sendJson(res, 200, { ok: true });
    },
  ],
  ['DELETE', /^\/api\/admin\/icerik\/([\w.-]+)\/taslak$/, ({ req, res, m }) => (discardDraft(m[1], requireUser(req)), sendJson(res, 200, { ok: true }))],
  [
    'POST',
    /^\/api\/admin\/icerik\/([\w.-]+)\/sifirla$/,
    ({ req, res, m }) => {
      const u = requireUser(req);
      saveDraft(m[1], defaultsOf(m[1]), u, 'Varsayılana döndürüldü');
      sendJson(res, 200, { ok: true });
    },
  ],
  ['GET', /^\/api\/admin\/icerik\/([\w.-]+)\/surumler$/, ({ req, res, m }) => (requireUser(req), sendJson(res, 200, { versions: listVersions(m[1]) }))],
  ['GET', /^\/api\/admin\/icerik\/([\w.-]+)\/surum\/(\d+)$/, ({ req, res, m }) => (requireUser(req), sendJson(res, 200, getVersion(m[1], num(m[2]))))],

  /* ---------- blog / projeler ---------- */
  [
    'GET',
    /^\/api\/admin\/girdi\/(blog|projects|legal)$/,
    ({ req, res, m }) => (requireUser(req), sendJson(res, 200, { kind: m[1], rows: listEntries(m[1]), meta: { label: ENTRY_KINDS[m[1]].label, canCreate: ENTRY_KINDS[m[1]].canCreate, fields: ENTRY_KINDS[m[1]].fields(), defaults: ENTRY_KINDS[m[1]].defaults } })),
  ],
  ['GET', /^\/api\/admin\/girdi\/(blog|projects|legal)\/([a-z0-9-]+)$/, ({ req, res, m }) => (requireUser(req), sendJson(res, 200, getEntry(m[1], m[2])))],
  [
    'PUT',
    /^\/api\/admin\/girdi\/(blog|projects|legal)\/([a-z0-9-]+)$/,
    async ({ req, res, m }) => {
      const u = requireUser(req);
      const b = await readJson(req, 4 * 1024 * 1024);
      const r = saveEntry(m[1], m[2], b, u, { create: b.create === true });
      sendJson(res, 200, r);
    },
  ],
  ['DELETE', /^\/api\/admin\/girdi\/(blog|projects|legal)\/([a-z0-9-]+)$/, ({ req, res, m }) => (deleteEntry(m[1], m[2], requireUser(req)), sendJson(res, 200, { ok: true }))],

  /* ---------- yayın ---------- */
  ['GET', /^\/api\/admin\/yayin$/, ({ req, res }) => (requireUser(req), sendJson(res, 200, { ...buildState(), pending: pendingDrafts(), entriesDirty: isDirty() }))],
  [
    'POST',
    /^\/api\/admin\/yayinla$/,
    async ({ req, res }) => sendJson(res, 202, await publish(requireUser(req))),
  ],
  [
    'POST',
    /^\/api\/admin\/yeniden-derle$/,
    async ({ req, res }) => sendJson(res, 202, await publish(requireUser(req), { rebuildOnly: true })),
  ],
  ['POST', /^\/api\/admin\/yayin-geri-al$/, ({ req, res }) => (rollback(requireAdmin(req)), sendJson(res, 200, { ok: true }))],
  ['GET', /^\/api\/admin\/yayinlar$/, ({ req, res }) => (requireUser(req), sendJson(res, 200, { builds: listBuilds() }))],
  [
    'GET',
    /^\/api\/admin\/yayinlar\/(\d+)$/,
    ({ req, res, m }) => {
      requireUser(req);
      const b = getBuildLog(num(m[1]));
      if (!b) throw new HttpError(404, 'Kayıt yok');
      sendJson(res, 200, b);
    },
  ],

  /* ---------- formlar ---------- */
  [
    'GET',
    /^\/api\/admin\/formlar$/,
    ({ req, res, url }) => {
      requireUser(req);
      const p = url.searchParams;
      sendJson(res, 200, listForms({ status: p.get('durum') ?? '', search: p.get('ara') ?? '', limit: p.get('limit') ?? 50, offset: p.get('offset') ?? 0 }));
    },
  ],
  [
    'GET',
    /^\/api\/admin\/formlar\.csv$/,
    ({ req, res }) => {
      const u = requireUser(req);
      audit(u, 'form.disa_aktar', 'csv');
      sendText(res, 200, formsCsv(), 'text/csv; charset=utf-8', { 'Content-Disposition': 'attachment; filename="akort-formlar.csv"', 'Cache-Control': 'no-store' });
    },
  ],
  ['GET', /^\/api\/admin\/formlar\/(\d+)$/, ({ req, res, m }) => (requireUser(req), sendJson(res, 200, getForm(num(m[1]))))],
  [
    'PATCH',
    /^\/api\/admin\/formlar\/(\d+)$/,
    async ({ req, res, m }) => {
      const u = requireUser(req);
      updateForm(num(m[1]), await readJson(req, 16 * 1024), u);
      sendJson(res, 200, { ok: true });
    },
  ],
  ['DELETE', /^\/api\/admin\/formlar\/(\d+)$/, ({ req, res, m }) => (deleteForm(num(m[1]), requireAdmin(req)), sendJson(res, 200, { ok: true }))],
  [
    'GET',
    /^\/api\/admin\/aboneler$/,
    ({ req, res, url }) => {
      requireUser(req);
      sendJson(res, 200, listSubscribers({ search: url.searchParams.get('ara') ?? '', limit: url.searchParams.get('limit') ?? 100, offset: url.searchParams.get('offset') ?? 0 }));
    },
  ],
  [
    'GET',
    /^\/api\/admin\/aboneler\.csv$/,
    ({ req, res }) => {
      const u = requireUser(req);
      audit(u, 'abone.disa_aktar', 'csv');
      sendText(res, 200, subscribersCsv(), 'text/csv; charset=utf-8', { 'Content-Disposition': 'attachment; filename="akort-aboneler.csv"', 'Cache-Control': 'no-store' });
    },
  ],
  [
    'PATCH',
    /^\/api\/admin\/aboneler\/(\d+)$/,
    async ({ req, res, m }) => {
      const u = requireUser(req);
      setSubscriberStatus(num(m[1]), (await readJson(req, 1024)).status, u);
      sendJson(res, 200, { ok: true });
    },
  ],
  ['DELETE', /^\/api\/admin\/aboneler\/(\d+)$/, ({ req, res, m }) => (deleteSubscriber(num(m[1]), requireAdmin(req)), sendJson(res, 200, { ok: true }))],

  /* ---------- medya ---------- */
  [
    'GET',
    /^\/api\/admin\/medya$/,
    ({ req, res, url }) => {
      requireUser(req);
      const p = url.searchParams;
      sendJson(res, 200, listMedia({ search: p.get('ara') ?? '', type: p.get('tur') ?? '', limit: p.get('limit') ?? 60, offset: p.get('offset') ?? 0 }));
    },
  ],
  [
    'POST',
    /^\/api\/admin\/medya$/,
    async ({ req, res, url }) => {
      const u = requireUser(req);
      const name = url.searchParams.get('ad') || 'dosya';
      const buf = await readBody(req, config.maxUploadMb * 1024 * 1024);
      if (!buf.length) throw new HttpError(400, 'Boş dosya');
      sendJson(res, 200, await uploadMedia(buf, name, u));
    },
  ],
  [
    'PATCH',
    /^\/api\/admin\/medya\/(\d+)$/,
    async ({ req, res, m }) => {
      const u = requireUser(req);
      sendJson(res, 200, updateMedia(num(m[1]), await readJson(req, 4 * 1024), u));
    },
  ],
  ['GET', /^\/api\/admin\/medya\/(\d+)\/kullanim$/, ({ req, res, m }) => (requireUser(req), sendJson(res, 200, { used: mediaUsage(getMedia(num(m[1])).filename) }))],
  ['DELETE', /^\/api\/admin\/medya\/(\d+)$/, ({ req, res, m }) => (deleteMedia(num(m[1]), requireUser(req)), sendJson(res, 200, { ok: true }))],

  /* ---------- kullanıcılar (yönetici) ---------- */
  [
    'GET',
    /^\/api\/admin\/kullanicilar$/,
    ({ req, res }) => {
      requireAdmin(req);
      sendJson(res, 200, { users: q.all('SELECT id, email, name, role, active, totp_enabled, created_at, last_login FROM users ORDER BY id') });
    },
  ],
  [
    'POST',
    /^\/api\/admin\/kullanicilar$/,
    async ({ req, res }) => {
      const u = requireAdmin(req);
      const b = await readJson(req, 4 * 1024);
      const id = createUser({ email: b.email, name: b.name, role: b.role, password: b.password });
      audit(u, 'kullanici.ekle', String(b.email).toLowerCase(), b.role, clientIp(req));
      sendJson(res, 200, { ok: true, id });
    },
  ],
  [
    'PATCH',
    /^\/api\/admin\/kullanicilar\/(\d+)$/,
    async ({ req, res, m }) => {
      const u = requireAdmin(req);
      const id = num(m[1]);
      const b = await readJson(req, 4 * 1024);
      const target = q.get('SELECT * FROM users WHERE id = ?', id);
      if (!target) throw new HttpError(404, 'Kullanıcı yok');
      const adminsLeft = q.get(`SELECT COUNT(*) AS n FROM users WHERE role = 'admin' AND active = 1 AND id != ?`, id).n;
      if (id === u.id && (b.active === false || (b.role && b.role !== 'admin'))) throw new HttpError(400, 'Kendi hesabınızı pasifleştiremez veya yetkisini düşüremezsiniz');
      if (target.role === 'admin' && adminsLeft === 0 && (b.active === false || (b.role && b.role !== 'admin'))) throw new HttpError(400, 'Son yöneticiyi değiştiremezsiniz');
      if (b.name !== undefined) q.run('UPDATE users SET name = ? WHERE id = ?', String(b.name).trim().slice(0, 80), id);
      if (b.role !== undefined) {
        if (!ROLE_IDS.includes(b.role)) throw new HttpError(400, 'Geçersiz rol');
        q.run('UPDATE users SET role = ? WHERE id = ?', b.role, id);
      }
      if (b.active !== undefined) {
        q.run('UPDATE users SET active = ? WHERE id = ?', b.active ? 1 : 0, id);
        if (!b.active) q.run('DELETE FROM sessions WHERE user_id = ?', id);
      }
      if (b.reset2fa === true) reset2fa(u, id, clientIp(req));
      if (b.password) {
        const err = validatePassword(b.password);
        if (err) throw new HttpError(400, err);
        q.run('UPDATE users SET pass_hash = ? WHERE id = ?', hashPassword(b.password), id);
        q.run('DELETE FROM sessions WHERE user_id = ?', id);
      }
      audit(u, 'kullanici.guncelle', target.email, Object.keys(b).filter((k) => k !== 'password').join(','), clientIp(req));
      sendJson(res, 200, { ok: true });
    },
  ],
  [
    'DELETE',
    /^\/api\/admin\/kullanicilar\/(\d+)$/,
    ({ req, res, m }) => {
      const u = requireAdmin(req);
      const id = num(m[1]);
      if (id === u.id) throw new HttpError(400, 'Kendi hesabınızı silemezsiniz');
      const t = q.get('SELECT email FROM users WHERE id = ?', id);
      if (!t) throw new HttpError(404, 'Kullanıcı yok');
      q.run('DELETE FROM users WHERE id = ?', id);
      audit(u, 'kullanici.sil', t.email, '', clientIp(req));
      sendJson(res, 200, { ok: true });
    },
  ],

  /* ---------- ayarlar (yönetici) ---------- */
  ['GET', /^\/api\/admin\/ayarlar$/,({ req, res }) => (requireAdmin(req), sendJson(res, 200, { smtp: smtpStatus(), recipients: getRecipients() }))],
  [
    'PUT',
    /^\/api\/admin\/ayarlar$/,
    async ({ req, res }) => {
      const u = requireAdmin(req);
      const b = await readJson(req, 4096);
      setRecipients(b.recipients ?? '', u);
      sendJson(res, 200, { ok: true, recipients: getRecipients() });
    },
  ],
  [
    'POST',
    /^\/api\/admin\/ayarlar\/test$/,
    async ({ req, res }) => {
      const u = requireAdmin(req);
      const to = getRecipients().length ? getRecipients() : [u.email];
      await sendMail({ to, subject: 'AKORT panel — test e-postası', text: 'Bu bir test e-postasıdır. SMTP ayarlarınız çalışıyor.' });
      audit(u, 'eposta.test', to.join(', '));
      sendJson(res, 200, { ok: true, to });
    },
  ],

  /* ---------- yönlendirmeler ---------- */
  ['GET', /^\/api\/admin\/yonlendirmeler$/, ({ req, res }) => (requireUser(req), sendJson(res, 200, { rows: listRedirects() }))],
  [
    'POST',
    /^\/api\/admin\/yonlendirmeler$/,
    async ({ req, res }) => {
      const u = requireUser(req);
      saveRedirect(0, await readJson(req, 4096), u);
      sendJson(res, 200, { ok: true });
    },
  ],
  [
    'PUT',
    /^\/api\/admin\/yonlendirmeler\/(\d+)$/,
    async ({ req, res, m }) => {
      const u = requireUser(req);
      saveRedirect(num(m[1]), await readJson(req, 4096), u);
      sendJson(res, 200, { ok: true });
    },
  ],
  ['DELETE', /^\/api\/admin\/yonlendirmeler\/(\d+)$/, ({ req, res, m }) => (deleteRedirect(num(m[1]), requireUser(req)), sendJson(res, 200, { ok: true }))],

  /* ---------- günlük ve yedek ---------- */
  [
    'GET',
    /^\/api\/admin\/gunluk$/,
    ({ req, res, url }) => {
      requireAdmin(req);
      const s = `%${(url.searchParams.get('ara') ?? '').replace(/[%_]/g, '')}%`;
      const limit = Math.min(Number(url.searchParams.get('limit')) || 50, 200);
      const offset = Number(url.searchParams.get('offset')) || 0;
      const total = q.get('SELECT COUNT(*) AS n FROM audit WHERE user_email LIKE ? OR action LIKE ? OR target LIKE ?', s, s, s).n;
      const rows = q.all('SELECT * FROM audit WHERE user_email LIKE ? OR action LIKE ? OR target LIKE ? ORDER BY id DESC LIMIT ? OFFSET ?', s, s, s, limit, offset);
      sendJson(res, 200, { total, rows });
    },
  ],
  ['GET', /^\/api\/admin\/roller$/, ({ req, res }) => (requireUser(req), sendJson(res, 200, { roles: Object.entries(ROLES).map(([id, r]) => ({ id, ...r })) }))],
  ['GET', /^\/api\/admin\/yedekler$/, ({ req, res }) => (requireAdmin(req), sendJson(res, 200, { backups: listBackups() }))],
  ['POST', /^\/api\/admin\/yedekler$/, ({ req, res }) => sendJson(res, 200, { name: createBackup(requireAdmin(req)) })],
  [
    'GET',
    /^\/api\/admin\/yedekler\/([\w.-]+)$/,
    ({ req, res, m }) => {
      const u = requireAdmin(req);
      const file = backupPath(m[1]);
      audit(u, 'yedek.indir', m[1]);
      res.writeHead(200, baseHeaders({ 'Content-Type': 'application/zip', 'Content-Length': fs.statSync(file).size, 'Content-Disposition': `attachment; filename="${m[1]}"`, 'Cache-Control': 'no-store' }));
      fs.createReadStream(file).pipe(res);
    },
  ],
];

export const dispatch = async (req, res, url) => {
  for (const [method, re, handler] of [...routes, ...extRoutes]) {
    if (req.method !== method && !(method === 'GET' && req.method === 'HEAD')) continue;
    const m = re.exec(url.pathname);
    if (!m) continue;
    // Merkezi rol denetimi (geçerli oturum varsa; yoksa ilgili işleyici 401 verir)
    if (url.pathname.startsWith('/api/admin/')) {
      const who = authenticate(req, { requireCsrf: false });
      const why = who && denyReason(who.role, req.method, url.pathname);
      if (why) throw new HttpError(403, why);
    }
    return handler({ req, res, url, m });
  }
  throw new HttpError(404, 'Uç nokta bulunamadı');
};
