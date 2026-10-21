// Sosyal Medya Stüdyosu — editoryal takvim + onay iş akışı. Platform OAuth bağlantısı olmadığı için YAYIN adaptörleri kapalıdır
// (sahte "yayımlandı" yok); onaylı içerik hash ile mühürlenir, "yayımlandı" yalnızca elle veya gerçek adaptörle işaretlenir.
import crypto from 'node:crypto';
import { q, audit, getSetting, setSetting } from '../db.mjs';
import { listEntries, getEntry } from '../entries.mjs';
import { HttpError } from '../http.mjs';
import './schema.mjs';

export const PLATFORMS = {
  linkedin: { label: 'LinkedIn', limit: 3000, caps: { yazi: true, gorsel: true, carousel: true, zamanla: true, insights: true }, needs: 'LinkedIn Marketing/Community Management API onayı + OAuth' },
  instagram: { label: 'Instagram', limit: 2200, caps: { yazi: true, gorsel: true, carousel: true, zamanla: true, insights: true }, needs: 'Meta Graph API (Instagram İşletme hesabı + Facebook Sayfası) + OAuth' },
  facebook: { label: 'Facebook', limit: 63206, caps: { yazi: true, gorsel: true, carousel: true, zamanla: true, insights: true }, needs: 'Meta Graph API (Sayfa erişim belirteci) + OAuth' },
  x: { label: 'X (Twitter)', limit: 280, caps: { yazi: true, gorsel: true, carousel: false, zamanla: false, insights: false }, needs: 'X API (ücretli katman gerekebilir) + OAuth 2.0 PKCE' },
  youtube: { label: 'YouTube', limit: 5000, caps: { yazi: false, gorsel: false, carousel: false, zamanla: true, insights: true }, needs: 'YouTube Data API + OAuth (video yükleme kotası)' },
  threads: { label: 'Threads', limit: 500, caps: { yazi: true, gorsel: true, carousel: true, zamanla: false, insights: true }, needs: 'Threads API + OAuth' },
  pinterest: { label: 'Pinterest', limit: 500, caps: { yazi: false, gorsel: true, carousel: false, zamanla: false, insights: true }, needs: 'Pinterest API + OAuth' },
  tiktok: { label: 'TikTok', limit: 2200, caps: { yazi: false, gorsel: false, carousel: false, zamanla: false, insights: false }, needs: 'TikTok Content Posting API (denetim/onay gerektirir)' },
};

// Resmî geliştirici konsolu (hesap/uygulama oluşturma) ve API belgeleri
const LINKS = {
  linkedin: ['https://www.linkedin.com/developers/apps', 'https://learn.microsoft.com/linkedin/'],
  instagram: ['https://developers.facebook.com/apps/', 'https://developers.facebook.com/docs/instagram-platform'],
  facebook: ['https://developers.facebook.com/apps/', 'https://developers.facebook.com/docs/pages-api'],
  x: ['https://developer.x.com/en/portal/dashboard', 'https://docs.x.com/'],
  youtube: ['https://console.cloud.google.com/apis/library/youtube.googleapis.com', 'https://developers.google.com/youtube/v3'],
  threads: ['https://developers.facebook.com/apps/', 'https://developers.facebook.com/docs/threads'],
  pinterest: ['https://developers.pinterest.com/apps/', 'https://developers.pinterest.com/docs/'],
  tiktok: ['https://developers.tiktok.com/', 'https://developers.tiktok.com/doc/content-posting-api-get-started'],
};
for (const [k, [url, docs]] of Object.entries(LINKS)) Object.assign(PLATFORMS[k], { url, docs });

export const STATUSES = ['taslak', 'onay_bekliyor', 'onaylandi', 'planlandi', 'yayimlandi', 'hata', 'revizyon'];
// izinli geçişler (yalnızca bu yollar)
const FLOW = {
  taslak: ['onay_bekliyor'],
  revizyon: ['onay_bekliyor', 'taslak'],
  onay_bekliyor: ['onaylandi', 'revizyon', 'taslak'],
  onaylandi: ['planlandi', 'revizyon', 'taslak'],
  planlandi: ['yayimlandi', 'hata', 'revizyon'],
  hata: ['planlandi', 'revizyon'],
  yayimlandi: [],
};

const hashOf = (p) => crypto.createHash('sha256').update(JSON.stringify([p.title, p.body, p.hashtags, p.media, p.platforms, p.scheduled_at ?? ''])).digest('hex');
const parse = (r) => (r ? { ...r, platforms: JSON.parse(r.platforms || '[]'), platform_post_ids: JSON.parse(r.platform_post_ids || '{}'), sealed: !!r.approved_hash && r.approved_hash === r.content_hash } : r);

export const listPosts = ({ status = '', from = '', to = '' } = {}) => {
  const where = [];
  const args = [];
  if (status) { where.push('status = ?'); args.push(status); }
  if (from) { where.push('COALESCE(scheduled_at, created_at) >= ?'); args.push(from); }
  if (to) { where.push('COALESCE(scheduled_at, created_at) < ?'); args.push(to); }
  return q.all(`SELECT * FROM social_posts ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY COALESCE(scheduled_at, created_at) DESC LIMIT 500`, ...args).map(parse);
};
export const getPost = (id) => {
  const r = parse(q.get('SELECT * FROM social_posts WHERE id = ?', id));
  if (!r) throw new HttpError(404, 'Gönderi bulunamadı');
  return r;
};

const clean = (b) => {
  const platforms = Array.isArray(b.platforms) ? [...new Set(b.platforms.filter((p) => PLATFORMS[p]))] : [];
  const out = {
    title: String(b.title ?? '').trim().slice(0, 140),
    body: String(b.body ?? '').slice(0, 6000),
    hashtags: String(b.hashtags ?? '').trim().slice(0, 300),
    media: String(b.media ?? '').trim().slice(0, 300),
    category: String(b.category ?? '').trim().slice(0, 60),
    campaign: String(b.campaign ?? '').trim().slice(0, 80),
    platforms,
    scheduled_at: b.scheduled_at ? String(b.scheduled_at).slice(0, 16) : null,
  };
  if (!out.title) throw new HttpError(400, 'Başlık zorunlu');
  if (out.scheduled_at && !/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}$/.test(out.scheduled_at)) throw new HttpError(400, 'Zaman biçimi YYYY-AA-GGTSS:DD olmalı');
  return out;
};

/** Platform başına doğrulama: karakter sınırı + desteklenmeyen medya */
export const validatePost = (p) => {
  const issues = [];
  if (!p.platforms.length) issues.push('En az bir platform seçin');
  for (const id of p.platforms) {
    const pl = PLATFORMS[id];
    const len = `${p.body}${p.hashtags ? '\n' + p.hashtags : ''}`.length;
    if (len > pl.limit) issues.push(`${pl.label}: metin ${len}/${pl.limit} karakter`);
    if (!pl.caps.yazi && !p.media) issues.push(`${pl.label}: yalnızca medya ile paylaşılabilir`);
  }
  if (!p.body.trim()) issues.push('Metin boş');
  return issues;
};

export const savePost = (id, b, user) => {
  const p = clean(b);
  if (!id) {
    const key = crypto.randomUUID();
    const r = q.run('INSERT INTO social_posts (title, body, hashtags, media, category, campaign, platforms, scheduled_at, content_hash, idempotency_key, created_by, source_ref) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)',
      p.title, p.body, p.hashtags, p.media, p.category, p.campaign, JSON.stringify(p.platforms), p.scheduled_at, hashOf(p), key, user.email, String(b.source_ref ?? '').slice(0, 200));
    audit(user, 'sosyal.olustur', String(r.lastInsertRowid), p.title);
    return getPost(Number(r.lastInsertRowid));
  }
  const cur = getPost(id);
  if (cur.status === 'yayimlandi') throw new HttpError(409, 'Yayımlanmış gönderi düzenlenemez');
  const h = hashOf(p);
  // içerik onaylı sürümden farklıysa mühür düşer ve yeniden onay gerekir
  let status = cur.status;
  if (cur.approved_hash && cur.approved_hash !== h && ['onaylandi', 'planlandi', 'onay_bekliyor'].includes(cur.status)) status = 'revizyon';
  q.run(`UPDATE social_posts SET title=?, body=?, hashtags=?, media=?, category=?, campaign=?, platforms=?, scheduled_at=?, content_hash=?, status=?, approved_hash=CASE WHEN ? = approved_hash THEN approved_hash ELSE NULL END, updated_at=datetime('now') WHERE id=?`,
    p.title, p.body, p.hashtags, p.media, p.category, p.campaign, JSON.stringify(p.platforms), p.scheduled_at, h, status, h, id);
  audit(user, 'sosyal.guncelle', String(id), status !== cur.status ? `${cur.status}→${status} (içerik değişti, yeniden onay gerekir)` : '');
  return getPost(id);
};

/** Durum geçişi: onay yalnızca yönetici/editör ≠ yazar kuralıyla değil, açık eylemle ve doğrulama sonrası yapılır */
export const transition = (id, to, user, note = '') => {
  const p = getPost(id);
  if (!FLOW[p.status]?.includes(to)) throw new HttpError(409, `"${p.status}" durumundan "${to}" durumuna geçilemez`);
  if (to === 'onay_bekliyor' || to === 'onaylandi') {
    const issues = validatePost(p);
    if (issues.length) throw new HttpError(422, 'Doğrulama hatası', { errors: issues });
  }
  if (to === 'onaylandi' && user.role !== 'admin') throw new HttpError(403, 'Onay için yönetici yetkisi gerekir');
  if (to === 'planlandi' && !p.scheduled_at) throw new HttpError(422, 'Planlamak için tarih/saat seçin');
  if (to === 'planlandi' && (!p.approved_hash || p.approved_hash !== p.content_hash)) throw new HttpError(409, 'Onaylı sürümle içerik eşleşmiyor; yeniden onaylayın');
  if (to === 'yayimlandi') throw new HttpError(409, 'Yayımlandı durumu yalnızca bağlı bir platform adaptörü veya "elle yayımlandı" işaretiyle verilir');
  if (to === 'onaylandi') q.run(`UPDATE social_posts SET approved_hash = content_hash, approved_by = ?, approved_at = datetime('now') WHERE id = ?`, user.email, id);
  q.run(`UPDATE social_posts SET status = ?, review_note = ?, updated_at = datetime('now') WHERE id = ?`, to, note.slice(0, 500) || p.review_note, id);
  audit(user, `sosyal.${to}`, String(id), note.slice(0, 120));
  return getPost(id);
};

/** Platformda elle yayımlandıktan sonra (kopyala-yapıştır) kayıt altına alma — idempotent: ikinci kez işaretlenemez */
export const markManuallyPublished = (id, platform, postRef, user) => {
  const p = getPost(id);
  if (p.status !== 'planlandi' && p.status !== 'onaylandi') throw new HttpError(409, 'Yalnızca onaylı/planlı gönderi işaretlenebilir');
  if (!PLATFORMS[platform] || !p.platforms.includes(platform)) throw new HttpError(400, 'Geçersiz platform');
  if (p.platform_post_ids[platform]) throw new HttpError(409, 'Bu platform için zaten yayımlandı olarak işaretli');
  const ids = { ...p.platform_post_ids, [platform]: String(postRef || 'elle').slice(0, 200) };
  const allDone = p.platforms.every((x) => ids[x]);
  q.run(`UPDATE social_posts SET platform_post_ids = ?, status = ?, updated_at = datetime('now') WHERE id = ?`, JSON.stringify(ids), allDone ? 'yayimlandi' : p.status, id);
  audit(user, 'sosyal.elle_yayimlandi', String(id), platform);
  return getPost(id);
};

export const deletePost = (id, user) => {
  const p = getPost(id);
  if (p.status === 'yayimlandi') throw new HttpError(409, 'Yayımlanmış kayıt silinemez');
  q.run('DELETE FROM social_posts WHERE id = ?', id);
  audit(user, 'sosyal.sil', String(id), p.title);
};

export const socialSummary = () => {
  const by = Object.fromEntries(q.all('SELECT status, COUNT(*) AS n FROM social_posts GROUP BY status').map((r) => [r.status, r.n]));
  return {
    byStatus: by,
    total: Object.values(by).reduce((a, b) => a + b, 0),
    upcoming: q.all(`SELECT id, title, platforms, scheduled_at, status FROM social_posts WHERE scheduled_at >= datetime('now') AND status IN ('onaylandi','planlandi') ORDER BY scheduled_at LIMIT 8`).map((r) => ({ ...r, platforms: JSON.parse(r.platforms) })),
    byPlatform: Object.keys(PLATFORMS).map((id) => ({ id, label: PLATFORMS[id].label, count: q.all('SELECT platforms FROM social_posts').filter((r) => JSON.parse(r.platforms).includes(id)).length })),
  };
};

/* Özel günler: yalnızca RESMİ SABİT tarihli günler (takvim kaynağı belirtilir); hareketli günler (bayramlar) dahil edilmez. */
const FIXED_DAYS = [
  ['01-01', 'Yılbaşı'], ['04-23', 'Ulusal Egemenlik ve Çocuk Bayramı'], ['05-01', 'Emek ve Dayanışma Günü'], ['05-19', 'Atatürk\'ü Anma, Gençlik ve Spor Bayramı'],
  ['06-05', 'Dünya Çevre Günü'], ['08-30', 'Zafer Bayramı'], ['10-29', 'Cumhuriyet Bayramı'], ['11-10', 'Atatürk\'ü Anma Günü'], ['12-05', 'Dünya Gönüllüler Günü'],
  ['03-22', 'Dünya Su Günü'], ['10-31', 'Dünya Şehircilik Günü'], ['04-22', 'Dünya Günü (Earth Day)'],
];
export const upcomingSpecialDays = () => {
  const now = new Date();
  const y = now.getFullYear();
  const out = [];
  for (const [md, name] of FIXED_DAYS) for (const yy of [y, y + 1]) {
    const d = new Date(`${yy}-${md}T00:00:00`);
    const days = Math.ceil((d - now) / 86_400_000);
    if (days >= 0 && days <= 90) out.push({ date: `${yy}-${md}`, name, inDays: days });
  }
  return out.sort((a, b) => a.date.localeCompare(b.date)).slice(0, 8).map((x) => ({ ...x, source: 'Resmî sabit tarihli gün / uluslararası anma günü — kullanmadan önce doğrulayın; otomatik yayın kapalıdır' }));
};

/* ---------- Genel bakış (referans ekran): yalnızca gerçek kayıtlar ---------- */
const dayKeys = (n) => Array.from({ length: n }, (_, i) => new Date(Date.now() - (n - 1 - i) * 86_400_000).toLocaleDateString('sv-SE', { timeZone: 'Europe/Istanbul' }));

export const autoKey = (date) => `social.auto.${date.slice(5)}`;
export const setAutoDay = (date, on, user) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new HttpError(400, 'Geçersiz tarih');
  setSetting(autoKey(date), on ? '1' : '0');
  audit(user, 'sosyal.ozelgun_otomasyon', date, on ? 'açık' : 'kapalı');
};

/** Etkin özel günler için (7 gün kala) TASLAK açar — yayınlamaz, onay gerekir. Aynı gün için ikinci taslak açılmaz (idempotent). */
export const autoDraftSpecialDays = () => {
  let made = 0;
  for (const d of upcomingSpecialDays()) {
    if (d.inDays > 7 || getSetting(autoKey(d.date), '0') !== '1') continue;
    const ref = `ozelgun/${d.date}`;
    if (q.get('SELECT 1 AS x FROM social_posts WHERE source_ref = ?', ref)) continue;
    savePost(0, { title: d.name, body: `${d.name} için paylaşım taslağı — metni düzenleyin veya Yapay Zekâ İçerik Stüdyosu'nda üretin.`, category: 'Özel Gün', platforms: ['linkedin'], scheduled_at: `${d.date}T10:00`, source_ref: ref }, { email: 'sistem' });
    made++;
  }
  return made;
};

export const socialOverview = (n = 30) => {
  const days = dayKeys(n);
  const ist = "date(created_at, '+3 hours')";
  const created = new Map(q.all(`SELECT ${ist} AS day, COUNT(*) AS v FROM social_posts WHERE ${ist} >= ? GROUP BY 1`, days[0]).map((r) => [r.day, r.v]));
  const planned = new Map(q.all("SELECT date(scheduled_at) AS day, COUNT(*) AS v FROM social_posts WHERE scheduled_at IS NOT NULL AND date(scheduled_at) >= ? GROUP BY 1", days[0]).map((r) => [r.day, r.v]));
  const all = q.all('SELECT * FROM social_posts').map(parse);
  const live = all.filter((p) => p.status !== 'yayimlandi' || true);
  const n30 = Date.now() - 30 * 86_400_000;
  const crit = (label, ok, total) => ({ label, score: total ? Math.round((ok / total) * 100) : null });
  const withMedia = live.filter((p) => p.media).length, withTags = live.filter((p) => p.hashtags).length;
  const valid = live.filter((p) => validatePost(p).length === 0).length;
  const sealed = live.filter((p) => ['onaylandi', 'planlandi', 'yayimlandi'].includes(p.status));
  const recent = live.filter((p) => new Date(String(p.created_at).replace(' ', 'T') + 'Z').getTime() >= n30).length;
  const criteria = [crit('Görsel kullanımı', withMedia, live.length), crit('Etiket stratejisi', withTags, live.length), crit('Platform uyumu (karakter sınırı)', valid, live.length), crit('Onay disiplini (mühürlü)', sealed.filter((p) => p.sealed || p.status === 'yayimlandi').length, sealed.length), { label: 'Yayın sıklığı (30 günde ≥ 4)', score: live.length ? Math.min(100, Math.round((recent / 4) * 100)) : null }];
  const scored = criteria.filter((c) => c.score !== null);
  const used = new Set(all.map((p) => p.source_ref).filter(Boolean));
  const ideas = [];
  try {
    for (const e of listEntries('blog').filter((x) => !x.draft).slice(0, 12)) {
      if (used.has(`blog/${e.slug}`)) continue;
      const d = getEntry('blog', e.slug).data;
      ideas.push({ kind: 'blog', slug: e.slug, title: d.title, text: d.excerpt ?? d.description ?? '' });
      if (ideas.length >= 3) break;
    }
  } catch { /* içerik okunamadı */ }
  const byStatus = Object.fromEntries(q.all('SELECT status, COUNT(*) AS n FROM social_posts GROUP BY status').map((r) => [r.status, r.n]));
  return {
    range: n,
    kpi: { total: all.length, planned: (byStatus.onaylandi ?? 0) + (byStatus.planlandi ?? 0), awaiting: byStatus.onay_bekliyor ?? 0, published: byStatus.yayimlandi ?? 0, drafts: byStatus.taslak ?? 0, createdSeries: days.map((d) => created.get(d) ?? 0) },
    byStatus,
    byPlatform: Object.keys(PLATFORMS).map((id) => ({ id, label: PLATFORMS[id].label, count: all.filter((p) => p.platforms.includes(id)).length })),
    perfLabels: days.map((d) => d.slice(8) + '/' + d.slice(5, 7)), perfCreated: days.map((d) => created.get(d) ?? 0), perfPlanned: days.map((d) => planned.get(d) ?? 0),
    upcoming: q.all("SELECT id, title, platforms, scheduled_at, status, media FROM social_posts WHERE scheduled_at >= datetime('now','-1 day') AND status IN ('onaylandi','planlandi') ORDER BY scheduled_at LIMIT 6").map((r) => ({ ...r, platforms: JSON.parse(r.platforms) })),
    consistency: { score: scored.length ? Math.round(scored.reduce((a, c) => a + c.score, 0) / scored.length) : null, criteria },
    ideas,
    specialDays: upcomingSpecialDays().map((d) => ({ ...d, auto: getSetting(autoKey(d.date), '0') === '1' })),
    platforms: Object.entries(PLATFORMS).map(([id, p]) => ({ id, label: p.label, limit: p.limit, caps: p.caps, needs: p.needs, url: p.url, docs: p.docs, connected: false })),
  };
};

/** Etiket önerisi: sitenin gerçek etiketleri + hizmet/sektör terimleri (uydurma popülerlik verisi yok) */
export const hashtagSuggestions = (text = '') => {
  const pool = new Set(['#AKORTMühendislik', '#Mühendislik', '#BIM', '#EnerjiVerimliliği', '#MEP', '#Sürdürülebilirlik', '#YapıTeknolojisi', '#DijitalDönüşüm']);
  try { for (const e of listEntries('blog')) { const d = getEntry('blog', e.slug).data; for (const t of d.tags ?? []) pool.add(`#${String(t).replace(/[^\p{L}\p{N}]+/gu, '')}`); } } catch { /* */ }
  const t = String(text).toLocaleLowerCase('tr');
  return [...pool].filter((h) => h.length > 3).sort((a, b) => Number(t.includes(b.slice(1).toLocaleLowerCase('tr'))) - Number(t.includes(a.slice(1).toLocaleLowerCase('tr')))).slice(0, 12);
};
