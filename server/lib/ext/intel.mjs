// Pazar ve Medya Takibi, Rakip izleme, Geri Bağlantı fırsatları.
// Yalnızca izinli RSS/herkese açık sayfalar; robots.txt'e uyulur, hız sınırı vardır, paywall/anti-bot aşılmaz, makale tam metni saklanmaz.
import crypto from 'node:crypto';
import dns from 'node:dns/promises';
import net from 'node:net';
import { q, audit } from '../db.mjs';
import { HttpError } from '../http.mjs';
import { config } from '../config.mjs';
import './schema.mjs';
import { autoDraftSpecialDays } from './social.mjs';

const UA = `AKORT-Panel/1.0 (+${config.siteUrl}; izinli RSS/izleme)`;

/* ---------- SSRF korumalı, sınırlı fetch ---------- */
const isPrivate = (ip) => {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split('.').map(Number);
    return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127);
  }
  const x = ip.toLowerCase();
  return x === '::1' || x === '::' || x.startsWith('fc') || x.startsWith('fd') || x.startsWith('fe80') || x.startsWith('::ffff:127.') || x.startsWith('::ffff:10.') || x.startsWith('::ffff:192.168.');
};
const assertPublicUrl = async (raw) => {
  let u;
  try { u = new URL(raw); } catch { throw new HttpError(400, 'Geçersiz URL'); }
  if (!['http:', 'https:'].includes(u.protocol)) throw new HttpError(400, 'Yalnızca http/https adresleri');
  if (u.username || u.password) throw new HttpError(400, 'URL içinde kimlik bilgisi olamaz');
  const host = u.hostname.replace(/^\[|\]$/g, '');
  const addrs = net.isIP(host) ? [{ address: host }] : await dns.lookup(host, { all: true }).catch(() => { throw new HttpError(400, `Alan adı çözümlenemedi: ${host}`); });
  if (addrs.some((a) => isPrivate(a.address))) throw new HttpError(400, 'Yerel/özel ağ adreslerine erişim engellendi');
  return u;
};

const safeFetch = async (raw, { headers = {}, maxBytes = 1_500_000, redirects = 3 } = {}) => {
  let url = raw;
  for (let i = 0; i <= redirects; i++) {
    const u = await assertPublicUrl(url);
    const res = await fetch(u, { headers: { 'User-Agent': UA, Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml, text/html;q=0.8, */*;q=0.5', ...headers }, redirect: 'manual', signal: AbortSignal.timeout(15_000) });
    if ([301, 302, 303, 307, 308].includes(res.status) && res.headers.get('location')) { url = new URL(res.headers.get('location'), u).href; continue; }
    if (res.status === 304) return { status: 304, headers: res.headers, text: '', url };
    const reader = res.body.getReader();
    const chunks = [];
    let size = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > maxBytes) { await reader.cancel(); break; }
      chunks.push(value);
    }
    return { status: res.status, headers: res.headers, text: Buffer.concat(chunks).toString('utf8'), url };
  }
  throw new HttpError(502, 'Çok fazla yönlendirme');
};

/** robots.txt: User-agent: * için Disallow kuralları (basit, ihtiyatlı) */
const robotsAllows = async (pageUrl) => {
  try {
    const u = new URL(pageUrl);
    const r = await safeFetch(`${u.origin}/robots.txt`, { maxBytes: 200_000 });
    if (r.status !== 200) return true;
    let applies = false;
    const dis = [];
    for (const line of r.text.split(/\r?\n/)) {
      const m = /^\s*([a-z-]+)\s*:\s*(.*?)\s*(#.*)?$/i.exec(line);
      if (!m) continue;
      const k = m[1].toLowerCase();
      if (k === 'user-agent') applies = m[2] === '*' || /akort/i.test(m[2]);
      else if (applies && k === 'disallow' && m[2]) dis.push(m[2]);
    }
    return !dis.some((d) => u.pathname.startsWith(d.replace(/\*.*$/, '')));
  } catch {
    return true;
  }
};

/* ---------- metin yardımcıları ---------- */
const decode = (s) => String(s ?? '').replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#0?39;|&apos;/g, "'").replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n) || 32)).replace(/\s+/g, ' ').trim();
const tag = (block, name) => new RegExp(`<${name}\\b[^>]*>([\\s\\S]*?)</${name}>`, 'i').exec(block)?.[1] ?? '';
const canonicalUrl = (raw) => {
  try {
    const u = new URL(raw);
    u.hash = '';
    for (const k of [...u.searchParams.keys()]) if (/^(utm_|fbclid|gclid|mc_)/i.test(k)) u.searchParams.delete(k);
    return u.href.replace(/\/$/, '');
  } catch { return ''; }
};
const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');
const normTitle = (t) => t.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

const parseFeed = (xml) => {
  const items = [];
  const blocks = xml.match(/<item\b[\s\S]*?<\/item>/gi) ?? xml.match(/<entry\b[\s\S]*?<\/entry>/gi) ?? [];
  for (const b of blocks.slice(0, 60)) {
    const title = decode(tag(b, 'title'));
    let link = decode(tag(b, 'link'));
    if (!link) link = /<link\b[^>]*href=["']([^"']+)["']/i.exec(b)?.[1] ?? '';
    const date = decode(tag(b, 'pubDate') || tag(b, 'published') || tag(b, 'updated') || tag(b, 'dc:date'));
    const summary = decode(tag(b, 'description') || tag(b, 'summary') || tag(b, 'content')).slice(0, 400);
    if (title && link) items.push({ title: title.slice(0, 300), link, date: date && !isNaN(new Date(date)) ? new Date(date).toISOString() : null, summary });
  }
  return items;
};

const TOPICS = {
  MEP: ['mep', 'mekanik', 'elektrik tesisat', 'tesisat', 'yangın', 'sprinkler', 'havalandırma'],
  BIM: ['bim', 'ifc', 'revit', 'dijital ikiz', 'digital twin', 'iso 19650', 'cde', 'scan-to-bim'],
  HVAC: ['hvac', 'iklimlendirme', 'chiller', 'vrf', 'ısı pompası', 'heat pump', 'klima'],
  Enerji: ['enerji verimliliği', 'enerji kimlik', 'yalıtım', 'enerji performans', 'energy efficiency', 'epbd', 'sürdürülebilir', 'karbon', 'leed', 'breeam'],
  GES: ['güneş enerjisi', 'ges', 'solar', 'fotovoltaik', 'pv '],
  Yapı: ['inşaat', 'çelik', 'betonarme', 'deprem', 'yapı denetim', 'mimari', 'construction'],
  Yazılım: ['yapay zeka', 'ai ', 'otomasyon', 'veri analitiği', 'iot'],
};
const scoreItem = (title, summary) => {
  const t = `${title} ${summary}`.toLowerCase();
  const tags = [];
  let score = 0;
  for (const [tg, words] of Object.entries(TOPICS)) {
    const hits = words.filter((w) => t.includes(w)).length;
    if (hits) { tags.push(tg); score += Math.min(hits, 2) * 20; }
  }
  return { score: Math.min(100, score), tags: tags.join(',') };
};

/* ---------- kaynak defteri ---------- */
export const listSources = () => q.all(`SELECT s.*, (SELECT COUNT(*) FROM source_items i WHERE i.source_id = s.id) AS items FROM sources s ORDER BY s.id DESC`);
export const saveSource = (id, b, user) => {
  const name = String(b.name ?? '').trim().slice(0, 100);
  const url = String(b.url ?? '').trim().slice(0, 500);
  if (!name || !url) throw new HttpError(400, 'Ad ve URL zorunlu');
  try { const u = new URL(url); if (!['http:', 'https:'].includes(u.protocol)) throw 0; } catch { throw new HttpError(400, 'Geçerli bir http(s) adresi girin'); }
  const interval = Math.min(Math.max(Number(b.interval_min) || 360, 60), 10080);
  const rec = [name, ['rss', 'manuel'].includes(b.kind) ? b.kind : 'rss', url, String(b.country ?? 'TR').slice(0, 8), String(b.lang ?? 'tr').slice(0, 8), String(b.category ?? 'genel').slice(0, 40), String(b.license_note ?? '').slice(0, 300), interval, b.enabled === false ? 0 : 1];
  try {
    if (id) q.run('UPDATE sources SET name=?, kind=?, url=?, country=?, lang=?, category=?, license_note=?, interval_min=?, enabled=? WHERE id=?', ...rec, id);
    else q.run('INSERT INTO sources (name, kind, url, country, lang, category, license_note, interval_min, enabled) VALUES (?,?,?,?,?,?,?,?,?)', ...rec);
  } catch (e) { if (String(e.message).includes('UNIQUE')) throw new HttpError(409, 'Bu URL zaten kayıtlı'); throw e; }
  audit(user, id ? 'kaynak.guncelle' : 'kaynak.ekle', name);
};
export const deleteSource = (id, user) => { q.run('DELETE FROM sources WHERE id = ?', id); audit(user, 'kaynak.sil', String(id)); };

export const fetchSource = async (id) => {
  const s = q.get('SELECT * FROM sources WHERE id = ?', id);
  if (!s) throw new HttpError(404, 'Kaynak yok');
  if (s.kind !== 'rss') throw new HttpError(400, 'Bu kaynak elle takip edilir (RSS değil)');
  q.run(`UPDATE sources SET last_check = datetime('now') WHERE id = ?`, id);
  try {
    if (!(await robotsAllows(s.url))) throw new Error('robots.txt bu adrese erişime izin vermiyor');
    const r = await safeFetch(s.url, { headers: { ...(s.etag ? { 'If-None-Match': s.etag } : {}), ...(s.last_modified ? { 'If-Modified-Since': s.last_modified } : {}) } });
    if (r.status === 304) { q.run(`UPDATE sources SET last_success = datetime('now'), last_error = NULL WHERE id = ?`, id); return { added: 0, skipped: 0, notModified: true }; }
    if (r.status !== 200) throw new Error(`HTTP ${r.status}`);
    const items = parseFeed(r.text);
    if (!items.length) throw new Error('Beslemede okunabilir öğe bulunamadı (RSS/Atom değil mi?)');
    let added = 0, skipped = 0;
    for (const it of items) {
      const cu = canonicalUrl(it.link);
      if (!cu) { skipped++; continue; }
      const sum = sha(normTitle(it.title));
      if (q.get('SELECT 1 AS x FROM source_items WHERE canonical_url = ? OR checksum = ?', cu, sum)) { skipped++; continue; }
      const sc = scoreItem(it.title, it.summary);
      q.run('INSERT INTO source_items (source_id, canonical_url, title, summary, published_at, checksum, relevance, tags) VALUES (?,?,?,?,?,?,?,?)', id, cu, it.title, it.summary, it.date, sum, sc.score, sc.tags);
      added++;
    }
    q.run(`UPDATE sources SET last_success = datetime('now'), last_error = NULL, etag = ?, last_modified = ? WHERE id = ?`, r.headers.get('etag'), r.headers.get('last-modified'), id);
    return { added, skipped };
  } catch (e) {
    q.run('UPDATE sources SET last_error = ? WHERE id = ?', String(e.message).slice(0, 300), id);
    throw e instanceof HttpError ? e : new HttpError(502, `Kaynak okunamadı: ${e.message}`);
  }
};

export const listItems = ({ status = '', minRel = 0, search = '', limit = 60 } = {}) => {
  const where = ['i.relevance >= ?'];
  const args = [Number(minRel) || 0];
  if (status) { where.push('i.status = ?'); args.push(status); }
  if (search) { where.push('(i.title LIKE ? OR i.summary LIKE ?)'); const s = `%${search.replace(/[%_]/g, '')}%`; args.push(s, s); }
  return q.all(`SELECT i.id, i.title, i.summary, i.canonical_url, i.published_at, i.fetched_at, i.relevance, i.tags, i.status, i.method, s.name AS source, s.country, s.category, s.kind AS source_kind, s.lang, s.license_note FROM source_items i JOIN sources s ON s.id = i.source_id WHERE ${where.join(' AND ')} ORDER BY COALESCE(i.published_at, i.fetched_at) DESC LIMIT ?`, ...args, Math.min(Number(limit) || 60, 200));
};
export const setItemStatus = (id, status, user) => {
  if (!['yeni', 'ilgili', 'elendi', 'fikir'].includes(status)) throw new HttpError(400, 'Geçersiz durum');
  q.run('UPDATE source_items SET status = ? WHERE id = ?', status, id);
  audit(user, 'haber.durum', String(id), status);
};
export const trending = () => {
  const rows = q.all(`SELECT tags FROM source_items WHERE tags != '' AND fetched_at >= datetime('now','-30 days')`);
  const c = {};
  for (const r of rows) for (const t of r.tags.split(',')) c[t] = (c[t] ?? 0) + 1;
  return Object.entries(c).sort((a, b) => b[1] - a[1]).map(([tag, n]) => ({ tag, n }));
};

/** Haberden CRM'e yalnızca ÖNERİ amaçlı fırsat kaydı (kaynak URL zorunlu, doğrulanmamış işaretli) */
export const itemToLead = (id, user) => {
  const it = q.get('SELECT i.*, s.name AS source FROM source_items i JOIN sources s ON s.id = i.source_id WHERE i.id = ?', id);
  if (!it) throw new HttpError(404, 'Öğe yok');
  const r = q.run(`INSERT INTO forms (kind, name, email, subject, message, payload, consent, status, handled_by) VALUES ('firsat', ?, '', ?, ?, ?, 0, 'yeni', ?)`,
    it.source, `Fırsat önerisi: ${it.title}`.slice(0, 200), `Kaynak: ${it.canonical_url}\nTespit: ${it.fetched_at}\nYöntem: ${it.method}\nDURUM: DOĞRULANMADI — iletişim kurmadan önce kaynağı doğrulayın. Bu kayıt otomatik oluşturulmuş bir öneridir.`,
    JSON.stringify({ kaynak_url: it.canonical_url, guven: 'düşük (otomatik)' }), user.email);
  audit(user, 'firsat.crm_oneri', String(id));
  return { id: Number(r.lastInsertRowid) };
};

/* ---------- rakip izleme ---------- */
export const listCompetitors = () => q.all('SELECT * FROM competitors ORDER BY id DESC');
export const saveCompetitor = (id, b, user) => {
  const name = String(b.name ?? '').trim().slice(0, 100);
  let url = String(b.url ?? '').trim();
  if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
  try { new URL(url); } catch { throw new HttpError(400, 'Geçerli bir adres girin'); }
  if (!name) throw new HttpError(400, 'Ad zorunlu');
  try {
    const region = b.region === 'GLOBAL' ? 'GLOBAL' : 'TR';
    if (id) q.run('UPDATE competitors SET name=?, url=?, sector=?, note=?, region=? WHERE id=?', name, url, String(b.sector ?? '').slice(0, 60), String(b.note ?? '').slice(0, 300), region, id);
    else q.run('INSERT INTO competitors (name, url, sector, note, region) VALUES (?,?,?,?,?)', name, url, String(b.sector ?? '').slice(0, 60), String(b.note ?? '').slice(0, 300), region);
  } catch (e) { if (String(e.message).includes('UNIQUE')) throw new HttpError(409, 'Bu adres zaten kayıtlı'); throw e; }
  audit(user, id ? 'rakip.guncelle' : 'rakip.ekle', name);
};
export const deleteCompetitor = (id, user) => { q.run('DELETE FROM competitors WHERE id = ?', id); audit(user, 'rakip.sil', String(id)); };
export const checkCompetitor = async (id, user) => {
  const c = q.get('SELECT * FROM competitors WHERE id = ?', id);
  if (!c) throw new HttpError(404, 'Rakip yok');
  try {
    if (!(await robotsAllows(c.url))) throw new Error('robots.txt bu sayfanın izlenmesine izin vermiyor — izlenmedi');
    const r = await safeFetch(c.url);
    const html = r.text;
    const title = decode(tag(html, 'title')).slice(0, 200);
    const body = decode(html.replace(/<(script|style|noscript)[\s\S]*?<\/\1>/gi, ' '));
    const hash = sha(body.replace(/\d{1,2}[./]\d{1,2}[./]\d{2,4}/g, ''));
    const words = body.split(' ').filter(Boolean).length;
    const changed = c.last_hash && c.last_hash !== hash ? 1 : 0;
    q.run('INSERT INTO competitor_checks (competitor_id, status, title, hash, words, changed) VALUES (?,?,?,?,?,?)', id, r.status, title, hash, words, changed);
    q.run(`UPDATE competitors SET last_check = datetime('now'), last_status = ?, last_title = ?, last_hash = ?, last_error = NULL, last_change = CASE WHEN ? = 1 THEN datetime('now') ELSE last_change END WHERE id = ?`, r.status, title, hash, changed, id);
    audit(user, 'rakip.kontrol', c.name, changed ? 'DEĞİŞİKLİK' : 'değişiklik yok');
    return { status: r.status, title, words, changed: !!changed, first: !c.last_hash };
  } catch (e) {
    q.run(`UPDATE competitors SET last_check = datetime('now'), last_error = ? WHERE id = ?`, String(e.message).slice(0, 300), id);
    q.run('INSERT INTO competitor_checks (competitor_id, error) VALUES (?,?)', id, String(e.message).slice(0, 300));
    throw e instanceof HttpError ? e : new HttpError(502, `Kontrol başarısız: ${e.message}`);
  }
};
export const competitorHistory = (id) => q.all('SELECT ts, status, title, words, changed, error FROM competitor_checks WHERE competitor_id = ? ORDER BY id DESC LIMIT 30', id);

/* ---------- backlink fırsatları ---------- */
const BL_STATUS = ['aday', 'taslak', 'onay_bekliyor', 'gonderildi', 'yanitlandi', 'kazanildi', 'reddedildi', 'kayip'];
export const listBacklinks = () => q.all('SELECT * FROM backlink_opps ORDER BY id DESC');
export const saveBacklink = (id, b, user) => {
  const name = String(b.name ?? '').trim().slice(0, 120);
  const url = String(b.url ?? '').trim().slice(0, 500);
  if (!name || !/^https?:\/\//i.test(url)) throw new HttpError(400, 'Ad ve geçerli http(s) adresi zorunlu');
  const status = b.status ?? 'aday';
  if (!BL_STATUS.includes(status)) throw new HttpError(400, 'Geçersiz durum');
  if (status === 'kazanildi') throw new HttpError(409, '"Kazanıldı" durumu yalnızca bağlantı doğrulaması ile verilir');
  const rec = [name, url, ['dizin', 'yayin', 'dernek', 'referans', 'diger'].includes(b.kind) ? b.kind : 'dizin', Math.min(5, Math.max(1, Number(b.relevance) || 3)), ['dusuk', 'orta', 'yuksek'].includes(b.risk) ? b.risk : 'dusuk', String(b.reason ?? '').slice(0, 400), status, String(b.outreach_draft ?? '').slice(0, 3000), String(b.link_url ?? '').slice(0, 500)];
  if (id) q.run(`UPDATE backlink_opps SET name=?, url=?, kind=?, relevance=?, risk=?, reason=?, status=?, outreach_draft=?, link_url=?, updated_at=datetime('now') WHERE id=?`, ...rec, id);
  else q.run('INSERT INTO backlink_opps (name, url, kind, relevance, risk, reason, status, outreach_draft, link_url, created_by) VALUES (?,?,?,?,?,?,?,?,?,?)', ...rec, user.email);
  audit(user, id ? 'backlink.guncelle' : 'backlink.ekle', name);
};
export const deleteBacklink = (id, user) => { q.run('DELETE FROM backlink_opps WHERE id = ?', id); audit(user, 'backlink.sil', String(id)); };
/** Dış sayfada AKORT alan adına gerçek bir <a href> bağlantısı var mı? Varsa kazanıldı, daha önce kazanıldıysa ve yoksa kayıp. */
export const verifyBacklink = async (id, user) => {
  const o = q.get('SELECT * FROM backlink_opps WHERE id = ?', id);
  if (!o) throw new HttpError(404, 'Kayıt yok');
  const target = o.link_url || o.url;
  if (!(await robotsAllows(target))) throw new HttpError(409, 'robots.txt bu sayfanın taranmasına izin vermiyor');
  const r = await safeFetch(target);
  const host = new URL(config.siteUrl).hostname.replace(/^www\./, '');
  const m = [...r.text.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>/gi)].some((x) => { try { return new URL(x[1], target).hostname.replace(/^www\./, '') === host; } catch { return false; } });
  const status = m ? 'kazanildi' : o.status === 'kazanildi' ? 'kayip' : o.status;
  q.run(`UPDATE backlink_opps SET status = ?, verified_at = datetime('now'), updated_at = datetime('now') WHERE id = ?`, status, id);
  audit(user, 'backlink.dogrula', o.name, m ? 'bağlantı bulundu' : 'bağlantı bulunamadı');
  return { found: m, status, httpStatus: r.status };
};

/* ---------- zamanlayıcı (iş kuyruğu: idempotent, üstel geri çekilme) ---------- */
const enqueue = (type, payload, key) => { try { q.run('INSERT INTO jobs (type, payload, idempotency_key) VALUES (?,?,?)', type, JSON.stringify(payload), key); return true; } catch { return false; } };
export const runDueSources = async () => {
  const due = q.all(`SELECT id, interval_min FROM sources WHERE enabled = 1 AND kind = 'rss' AND (last_check IS NULL OR last_check <= datetime('now', '-' || interval_min || ' minutes'))`);
  for (const s of due) {
    const slot = Math.floor(Date.now() / (s.interval_min * 60_000));
    if (!enqueue('source.fetch', { id: s.id }, `source:${s.id}:${slot}`)) continue;
  }
  const jobs = q.all(`SELECT * FROM jobs WHERE state IN ('bekliyor','hata') AND run_at <= datetime('now') ORDER BY id LIMIT 5`);
  for (const j of jobs) {
    q.run(`UPDATE jobs SET state = 'calisiyor', attempts = attempts + 1 WHERE id = ?`, j.id);
    try {
      if (j.type === 'source.fetch') await fetchSource(JSON.parse(j.payload).id);
      q.run(`UPDATE jobs SET state = 'tamam', finished_at = datetime('now'), last_error = NULL WHERE id = ?`, j.id);
    } catch (e) {
      const dead = j.attempts + 1 >= 5;
      q.run(`UPDATE jobs SET state = ?, last_error = ?, run_at = datetime('now', ?) WHERE id = ?`, dead ? 'olu' : 'hata', String(e.message).slice(0, 300), `+${5 * 2 ** (j.attempts + 1)} minutes`, j.id);
    }
    await new Promise((r) => setTimeout(r, 1500)); // kaynaklar arası nezaket aralığı
  }
};
export const startScheduler = () => {
  const t = setInterval(() => { runDueSources().catch(() => {}); try { autoDraftSpecialDays(); } catch { /* sonraki turda */ } }, 5 * 60_000);
  t.unref();
};
export const listJobs = () => q.all('SELECT id, type, payload, state, attempts, run_at, last_error, finished_at FROM jobs ORDER BY id DESC LIMIT 30');

/* ---------- genel bakış toplulaştırmaları (referans ekranlar için) ---------- */
const dayKeys = (n) => Array.from({ length: n }, (_, i) => new Date(Date.now() - (n - 1 - i) * 86_400_000).toLocaleDateString('sv-SE', { timeZone: 'Europe/Istanbul' }));

export const competitorOverview = (n = 30) => {
  const rows = q.all(`SELECT c.*, (SELECT COUNT(*) FROM competitor_checks k WHERE k.competitor_id = c.id AND k.changed = 1 AND k.ts >= datetime('now', ?)) AS changes,
    (SELECT words FROM competitor_checks k WHERE k.competitor_id = c.id AND k.words IS NOT NULL ORDER BY k.id DESC LIMIT 1) AS words FROM competitors c ORDER BY c.id DESC`, `-${n} days`);
  const events = q.all(`SELECT k.ts, k.changed, k.error, c.name, c.url FROM competitor_checks k JOIN competitors c ON c.id = k.competitor_id WHERE (k.changed = 1 OR k.error IS NOT NULL) AND k.ts >= datetime('now', ?) ORDER BY k.id DESC LIMIT 12`, `-${n} days`);
  const days = dayKeys(n);
  const byDay = new Map(q.all(`SELECT date(ts, '+3 hours') AS day, COUNT(*) AS v FROM competitor_checks WHERE changed = 1 AND ts >= datetime('now', ?) GROUP BY 1`, `-${n} days`).map((r) => [r.day, r.v]));
  return { range: n, rows, events, changeSeries: days.map((d) => byDay.get(d) ?? 0), sectors: [...new Set(rows.map((r) => r.sector).filter(Boolean))] };
};

export const marketOverview = (n = 30) => {
  const days = dayKeys(n);
  const since = days[0];
  const byDay = new Map(q.all(`SELECT date(fetched_at, '+3 hours') AS day, COUNT(*) AS v FROM source_items WHERE date(fetched_at, '+3 hours') >= ? GROUP BY 1`, since).map((r) => [r.day, r.v]));
  const prev = q.get(`SELECT COUNT(*) AS n FROM source_items WHERE fetched_at >= datetime('now', ?) AND fetched_at < datetime('now', ?)`, `-${2 * n} days`, `-${n} days`).n;
  const cur = q.get(`SELECT COUNT(*) AS n FROM source_items WHERE fetched_at >= datetime('now', ?)`, `-${n} days`).n;
  // konu trendleri: etiket × gün
  const tagRows = q.all(`SELECT date(fetched_at, '+3 hours') AS day, tags FROM source_items WHERE tags != '' AND date(fetched_at, '+3 hours') >= ?`, since);
  const totals = {}, per = {};
  for (const r of tagRows) for (const t of r.tags.split(',')) { totals[t] = (totals[t] ?? 0) + 1; (per[t] ??= {})[r.day] = (per[t][r.day] ?? 0) + 1; }
  const top = Object.entries(totals).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([t]) => t);
  return {
    range: n,
    sources: { total: q.get('SELECT COUNT(*) AS n FROM sources').n, active: q.get('SELECT COUNT(*) AS n FROM sources WHERE enabled = 1').n, failing: q.get('SELECT COUNT(*) AS n FROM sources WHERE last_error IS NOT NULL').n },
    news: { cur, prev, series: days.map((d) => byDay.get(d) ?? 0) },
    ideas: q.get(`SELECT COUNT(*) AS n FROM source_items WHERE relevance >= 60 OR status = 'fikir'`).n,
    leads: q.get(`SELECT COUNT(*) AS n FROM forms WHERE kind = 'firsat'`).n,
    labels: days.map((d) => d.slice(8) + '/' + d.slice(5, 7)),
    trends: top.map((t) => ({ tag: t, total: totals[t], values: days.map((d) => per[t]?.[d] ?? 0) })),
    categories: [...new Set(q.all('SELECT DISTINCT category FROM sources').map((r) => r.category))],
    countries: [...new Set(q.all('SELECT DISTINCT country FROM sources').map((r) => r.country))],
    ranking: q.all(`SELECT i.id, i.title, i.canonical_url, i.relevance, i.tags, i.status, s.name AS source FROM source_items i JOIN sources s ON s.id = i.source_id WHERE i.relevance >= 20 AND i.status != 'elendi' ORDER BY i.relevance DESC, i.id DESC LIMIT 6`),
    changeEvents: q.all(`SELECT k.ts, c.name, c.url FROM competitor_checks k JOIN competitors c ON c.id = k.competitor_id WHERE k.changed = 1 ORDER BY k.id DESC LIMIT 20`),
  };
};
