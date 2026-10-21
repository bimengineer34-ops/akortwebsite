// Yapay Zekâ Orkestrası araçları — ajanlara YALNIZCA bu sunucu tarafı, salt-okunur araçlar verilir (yetki listesi ajan ayarındadır).
// Dış sistemi değiştiren araç yoktur; yazan eylemler (blog/sosyal taslağı) engine.mjs içinde onaydan sonra çalışır.
import fs from 'node:fs';
import path from 'node:path';
import { q } from '../../db.mjs';
import '../../stats.mjs'; // pageviews/referrers tablolarının varlığını garanti eder
import { config } from '../../config.mjs';
import { ENTRY_KINDS, listEntries, getEntry } from '../../entries.mjs';
import { scanSite, internalLinkSuggestions } from '../seo.mjs';
import { brandData } from '../brand.mjs';
import { cleanExternal, looksLikeInjection, scanRiskyClaims } from './safety.mjs';

const fold = (s) => String(s).toLocaleLowerCase('tr').replace(/ç/g, 'c').replace(/ğ/g, 'g').replace(/ı/g, 'i').replace(/ö/g, 'o').replace(/ş/g, 's').replace(/ü/g, 'u');
/** Türkçe ek çeşitliliği için basit önek eşleştirme: "koordinasyonu" ↔ "koordinasyon", "çelik" ↔ "celik" (harf katlama) */
const wordsOf = (t) => fold(t).split(/[^a-z0-9]+/).filter(Boolean);
const stemOf = (w) => (w.length >= 8 ? w.slice(0, 6) : w.length >= 6 ? w.slice(0, 5) : w);
const STOP = new Set(['ile', 'icin', 'gibi', 'olan', 'bir', 'bu', 'ama', 'veya', 'daha', 'cok', 'her', 'hem', 'ise', 'kadar', 'sonra', 'ancak']);
/** 3 harfli teknik kısaltmalar (BIM, MEP, CDE, LOD…) dahil; sık geçen bağlaçlar hariç */
export const termsOf = (topic, n = 6) => [...new Set(wordsOf(topic).filter((w) => w.length >= 3 && !STOP.has(w)))].slice(0, n);
/** Metindeki sözcüklerden kaç konu terimi eşleşiyor (önek iki yönlü) */
export const matchScore = (terms, text) => {
  const toks = wordsOf(text);
  return terms.reduce((a, w) => a + (toks.some((tk) => tk.startsWith(stemOf(w)) || (tk.length >= 4 && w.startsWith(tk))) ? 1 : 0), 0);
};

/* ------------------------------ site içeriği ------------------------------ */
export const siteIndex = () => {
  try { return JSON.parse(fs.readFileSync(path.join(config.siteDir, 'arama-index.json'), 'utf8')).filter((d) => d?.url && d?.title && !String(d.url).startsWith('/en')); } catch { return []; }
};
/** Konuyla ilgili mevcut sayfalar (çift içerik önleme + iç bağlantı için GERÇEK adresler) */
export const siteContext = (topic, limit = 25) => {
  const all = siteIndex();
  const terms = termsOf(topic);
  const scored = all.map((d) => ({ d, s: matchScore(terms, d.title) * 3 + matchScore(terms, String(d.text ?? '').slice(0, 600)) }));
  const pages = scored.sort((a, b) => b.s - a.s).slice(0, limit).map(({ d }) => ({ title: cleanExternal(d.title, 120), url: d.url, type: d.type ?? '' }));
  return { pages, urls: new Set(all.map((d) => d.url)), total: all.length };
};
export const blogCategories = () => (ENTRY_KINDS.blog.fields().find((f) => f.name === 'category')?.options ?? []).map((o) => o.value);

/* ------------------------------ Pazar & Medya kaynakları (RSS vb.) ------------------------------ */
/** Kaynak öğeleri: HTML temizlenir, talimat enjeksiyonu şüphelileri bağlama ALINMAZ. */
export const sourceItems = (topic, limit = 12) => {
  const terms = termsOf(topic);
  const rows = q.all(`SELECT i.id, i.title, i.summary, i.canonical_url, i.published_at, i.fetched_at, i.relevance, s.name AS source FROM source_items i JOIN sources s ON s.id = i.source_id WHERE i.status != 'elendi' ORDER BY i.relevance DESC, i.id DESC LIMIT 600`);
  const scored = rows
    .map((r) => ({ r, s: terms.length ? matchScore(terms, r.title) * 2 + matchScore(terms, r.summary) : 1 }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s || b.r.relevance - a.r.relevance || b.r.id - a.r.id);
  const items = [];
  const blocked = [];
  for (const { r } of scored) {
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
    { id: 'desc_len', ok: description.length >= 120 && description.length <= 160, note: `Arama açıklaması ${description.length} karakter (ideal 120–160)` },
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

/* ------------------------------ mevcut sayfaların SEO taraması (salt okunur) ------------------------------ */
export const siteSeoInfo = () => {
  const scan = scanSite();
  const pages = scan.pages.filter((p) => !p.noindex);
  const bad = [...pages].sort((a, b) => a.score - b.score).slice(0, 14).map((p) => ({
    url: p.url, title: cleanExternal(p.title, 120), titleLen: (p.title ?? '').length, descLen: (p.description ?? '').length, score: p.score, h1: p.h1,
    issues: (p.issues ?? []).slice(0, 5).map(([sev, text]) => `${sev}: ${cleanExternal(text, 90)}`),
  }));
  // içerik kayıtlarındaki gerçek eksikler (yayındaki blog/proje)
  const gaps = { shortMeta: [], noInternalLink: [] };
  for (const kind of ['blog', 'projects']) {
    for (const r of listEntries(kind).filter((x) => !x.draft)) {
      try {
        const e = getEntry(kind, r.slug);
        const desc = e.data.seo?.description ?? e.data.description ?? e.data.summary ?? '';
        const url = kind === 'blog' ? `/blog/${r.slug}` : `/projeler/${r.slug}`;
        if (desc.length < 120) gaps.shortMeta.push({ url, len: desc.length });
        if (!/\]\(\//.test(e.body)) {
          const sug = (() => { try { return internalLinkSuggestions(kind, r.slug).slice(0, 3).map((x) => ({ to: x.url, title: cleanExternal(x.title, 80) })); } catch { return []; } })();
          gaps.noInternalLink.push({ url, suggestions: sug });
        }
      } catch { /* bozuk kayıt */ }
    }
  }
  return {
    total: scan.total, errors: scan.errors, warnings: scan.warnings, infos: scan.infos, avgScore: scan.avgScore,
    duplicateTitles: (scan.duplicateTitles ?? []).slice(0, 5), notInSitemap: (scan.sitemap?.indexableNotInSitemap ?? []).slice(0, 8),
    worstPages: bad, shortMeta: gaps.shortMeta.slice(0, 8), noInternalLink: gaps.noInternalLink.slice(0, 6),
    urls: new Set(scan.pages.map((p) => p.url)),
  };
};

/* ------------------------------ müşteri talebi (KİŞİSEL VERİLER MASKELİ: ad/e-posta/telefon/IP/UA modele gitmez) ------------------------------ */
/** Serbest metindeki e-posta, telefon, IBAN ve TC kimlik benzeri değerleri maskeler (ad/soyad gibi serbest metin kimlikleri maskelenemez) */
export const scrubPII = (t) => String(t ?? '')
  .replace(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g, '[e-posta]')
  .replace(/\bTR\d{2}(?:\s?\d{4}){5}\s?\d{2}\b/gi, '[iban]')
  .replace(/\b\d{11}\b/g, '[no]')
  .replace(/(?:\+?\d{1,3}[\s.-]?)?(?:\(?\d{3}\)?[\s.-]?)\d{3}[\s.-]?\d{2}[\s.-]?\d{2}\b/g, '[telefon]');
const PII_KEY = /mail|posta|telefon|phone|\btel\b|gsm|mobil|ad_?soyad|soyad|\bad\b|name|adres|address|ip|\bua\b|kvkk|consent|onay|website|unvan|firma|sirket|company|kurum/i;
export const formInfo = (formId) => {
  const r = q.get('SELECT id, kind, created_at, company, subject, message, payload, status FROM forms WHERE id = ?', Number(formId));
  if (!r) return null;
  let payload = {};
  try { payload = JSON.parse(r.payload || '{}'); } catch { /* */ }
  const safe = {};
  for (const [k, v] of Object.entries(payload)) {
    if (PII_KEY.test(k)) continue;
    const val = Array.isArray(v) ? v.map((x) => scrubPII(cleanExternal(x, 80))).join(', ') : scrubPII(cleanExternal(v, 200));
    safe[cleanExternal(k, 40)] = val;
  }
  const message = scrubPII(cleanExternal(r.message, 1500));
  return { id: r.id, kind: r.kind, date: String(r.created_at).slice(0, 10), corporate: !!(r.company && String(r.company).trim()), subject: scrubPII(cleanExternal(r.subject, 160)), message, details: safe, status: r.status, suspicious: looksLikeInjection(`${r.subject} ${r.message}`) };
};

/* ------------------------------ Marka Seti seçenekleri ------------------------------ */
export const brandKitInfo = () => {
  const b = brandData();
  return { templates: b.templates.map((t) => ({ key: t.key, name: t.name, note: t.note })), themes: b.themes.map((t) => ({ key: t.key, label: t.label })), formats: b.formats.map((f) => ({ key: f.key, label: f.label })) };
};
