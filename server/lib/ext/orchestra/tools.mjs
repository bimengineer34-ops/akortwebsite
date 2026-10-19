// AI Orchestra araçları — ajanlara YALNIZCA bu sunucu tarafı, salt-okunur araçlar verilir (yetki listesi ajan ayarındadır).
// Dış sistemi değiştiren araç yoktur; yazan eylemler (blog/sosyal taslağı) engine.mjs içinde onaydan sonra çalışır.
import fs from 'node:fs';
import path from 'node:path';
import { q } from '../../db.mjs';
import '../../stats.mjs'; // pageviews/referrers tablolarının varlığını garanti eder
import { config } from '../../config.mjs';
import { ENTRY_KINDS } from '../../entries.mjs';
import { cleanExternal, looksLikeInjection, scanRiskyClaims } from './safety.mjs';

const fold = (s) => String(s).toLocaleLowerCase('tr').replace(/ç/g, 'c').replace(/ğ/g, 'g').replace(/ı/g, 'i').replace(/ö/g, 'o').replace(/ş/g, 's').replace(/ü/g, 'u');
export const termsOf = (topic, n = 6) => [...new Set(fold(topic).split(/[^a-z0-9]+/).filter((w) => w.length >= 4))].slice(0, n);

/* ------------------------------ site içeriği ------------------------------ */
export const siteIndex = () => {
  try { return JSON.parse(fs.readFileSync(path.join(config.siteDir, 'arama-index.json'), 'utf8')).filter((d) => d?.url && d?.title && !String(d.url).startsWith('/en')); } catch { return []; }
};
/** Konuyla ilgili mevcut sayfalar (çift içerik önleme + iç bağlantı için GERÇEK adresler) */
export const siteContext = (topic, limit = 25) => {
  const all = siteIndex();
  const terms = termsOf(topic);
  const scored = all.map((d) => ({ d, s: terms.reduce((a, t) => a + (fold(d.title).includes(t) ? 3 : 0) + (fold(`${d.text ?? ''}`).includes(t) ? 1 : 0), 0) }));
  const pages = scored.sort((a, b) => b.s - a.s).slice(0, limit).map(({ d }) => ({ title: cleanExternal(d.title, 120), url: d.url, type: d.type ?? '' }));
  return { pages, urls: new Set(all.map((d) => d.url)), total: all.length };
};
export const blogCategories = () => (ENTRY_KINDS.blog.fields().find((f) => f.name === 'category')?.options ?? []).map((o) => o.value);

/* ------------------------------ Pazar & Medya kaynakları (RSS vb.) ------------------------------ */
/** Kaynak öğeleri: HTML temizlenir, talimat enjeksiyonu şüphelileri bağlama ALINMAZ. */
export const sourceItems = (topic, limit = 12) => {
  const terms = termsOf(topic);
  const where = ["i.status != 'elendi'"];
  const args = [];
  if (terms.length) {
    where.push(`(${terms.map(() => '(i.title LIKE ? OR i.summary LIKE ?)').join(' OR ')})`);
    for (const t of terms) { const s = `%${t}%`; args.push(s, s); }
  }
  const rows = q.all(`SELECT i.id, i.title, i.summary, i.canonical_url, i.published_at, i.fetched_at, i.relevance, s.name AS source FROM source_items i JOIN sources s ON s.id = i.source_id WHERE ${where.join(' AND ')} ORDER BY i.relevance DESC, i.id DESC LIMIT ?`, ...args, limit * 3);
  const items = [];
  const blocked = [];
  for (const r of rows) {
    const title = cleanExternal(r.title, 200), summary = cleanExternal(r.summary, 600);
    if (looksLikeInjection(`${title} ${summary}`)) { blocked.push({ id: r.id, url: r.canonical_url }); continue; }
    if (!/^https?:\/\//.test(r.canonical_url)) continue;
    items.push({ id: r.id, url: r.canonical_url, title, summary, source: cleanExternal(r.source, 80), date: String(r.published_at ?? r.fetched_at ?? '').slice(0, 10) });
    if (items.length >= limit) break;
  }
  return { items, blocked, terms };
};

/* ------------------------------ izlenen rakipler (yalnızca bizim tarama kayıtlarımız) ------------------------------ */
export const competitorsInfo = () => {
  const rows = q.all('SELECT id, name, url, sector, last_check, last_title, last_change, last_status FROM competitors ORDER BY id DESC LIMIT 15');
  return rows.map((r) => ({ name: cleanExternal(r.name, 80), url: r.url, sector: cleanExternal(r.sector, 60), lastCheck: r.last_check, title: cleanExternal(r.last_title, 150), lastChange: r.last_change, status: r.last_status }));
};

/* ------------------------------ ziyaret ve kullanım istatistikleri (kişisel veri yok) ------------------------------ */
export const statsInfo = () => {
  const safe = (fn, d) => { try { return fn(); } catch { return d; } };
  const total = safe(() => q.get(`SELECT COALESCE(SUM(views),0) AS v FROM pageviews WHERE day >= date('now','-30 days')`).v, 0);
  const top = safe(() => q.all(`SELECT path, SUM(views) AS v FROM pageviews WHERE day >= date('now','-30 days') GROUP BY path ORDER BY v DESC LIMIT 10`), []);
  const ref = safe(() => q.all(`SELECT host, SUM(views) AS v FROM referrers WHERE day >= date('now','-30 days') GROUP BY host ORDER BY v DESC LIMIT 8`), []);
  const forms = safe(() => q.all(`SELECT kind, COUNT(*) AS n FROM forms WHERE created_at >= datetime('now','-30 days') GROUP BY kind`), []);
  const ai = safe(() => q.get(`SELECT COALESCE(SUM(input_tokens),0) AS i, COALESCE(SUM(output_tokens),0) AS o FROM ai_usage WHERE ok = 1 AND ts >= date('now','start of month')`), { i: 0, o: 0 });
  return { last30dViews: total, topPages: top, referrers: ref, formsLast30d: forms, aiTokensThisMonth: { input: ai.i, output: ai.o } };
};

/* ------------------------------ deterministik SEO kontrolü ------------------------------ */
const words = (s) => String(s).split(/\s+/).filter(Boolean).length;
export const seoCheck = ({ title = '', description = '', body = '', focus = '', slug = '' }) => {
  const f = fold(focus.trim());
  const first = fold(body).split(/\s+/).slice(0, 120).join(' ');
  const h2 = (body.match(/^##\s+\S/gm) ?? []).length;
  const links = (body.match(/\]\((\/[^)\s]*|https?:[^)\s]*)\)/g) ?? []).length;
  const checks = [
    { id: 'title_len', ok: title.length >= 30 && title.length <= 60, note: `Başlık ${title.length} karakter (ideal 30–60)` },
    { id: 'desc_len', ok: description.length >= 120 && description.length <= 160, note: `Meta açıklama ${description.length} karakter (ideal 120–160)` },
    { id: 'h2', ok: h2 >= 3, note: `${h2} adet H2 ara başlık (en az 3)` },
    { id: 'words', ok: words(body) >= 600, note: `${words(body)} sözcük (öneri ≥ 600)` },
    { id: 'no_h1', ok: !/^#\s+\S/m.test(body), note: 'Gövdede ikinci bir H1 olmamalı (başlık H1 sayılır)' },
    { id: 'links', ok: links >= 2, note: `${links} bağlantı (en az 2 iç bağlantı önerilir)` },
    { id: 'slug', ok: /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) && slug.length <= 80, note: 'Adres (slug) küçük harf-tire biçiminde, ≤ 80 karakter olmalı' },
  ];
  if (f) {
    checks.push({ id: 'focus_title', ok: fold(title).includes(f), note: `Odak ifade "${focus}" başlıkta geçmeli` });
    checks.push({ id: 'focus_first', ok: first.includes(f), note: 'Odak ifade ilk paragraflarda geçmeli' });
    checks.push({ id: 'focus_desc', ok: fold(description).includes(f), note: 'Odak ifade meta açıklamada geçmeli' });
  }
  const score = Math.round((100 * checks.filter((c) => c.ok).length) / checks.length);
  return { checks, score };
};

export const riskScan = (text) => scanRiskyClaims(String(text ?? ''));
