// SEO Analizi — derlenmiş siteyi (dist) tarayan GERÇEK teknik denetim. Puanlar Google skoru değildir.
import fs from 'node:fs';
import path from 'node:path';
import { config } from '../config.mjs';
import { q } from '../db.mjs';
import { getStats } from '../stats.mjs';
import { listEntries, getEntry } from '../entries.mjs';
import './schema.mjs';

const attr = (tag, name) => new RegExp(`${name}\\s*=\\s*("([^"]*)"|'([^']*)')`, 'i').exec(tag)?.slice(2).find((x) => x !== undefined);
const meta = (html, key, by = 'name') => {
  for (const t of html.match(/<meta\b[^>]*>/gi) ?? []) if (attr(t, by)?.toLowerCase() === key) return attr(t, 'content') ?? '';
  return null;
};
const decode = (s) => String(s ?? '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;|&#x27;/g, "'").replace(/\s+/g, ' ').trim();

const walk = (dir, out = []) => {
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (!['_astro', 'medya', 'bim'].includes(e.name)) walk(p, out); } else if (e.name.endsWith('.html')) out.push(p);
  }
  return out;
};

export const analyzePage = (html, url) => {
  const title = decode(/<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1]);
  const description = decode(meta(html, 'description'));
  const robots = (meta(html, 'robots') ?? '').toLowerCase();
  const canonical = (/<link\b[^>]*rel=["']canonical["'][^>]*>/i.exec(html) ?? [''])[0];
  const canonicalHref = canonical ? attr(canonical, 'href') ?? '' : '';
  const h1 = (html.match(/<h1\b/gi) ?? []).length;
  const imgs = html.match(/<img\b[^>]*>/gi) ?? [];
  // Astro HTML'i küçültür: boş alt (dekoratif görsel) çıplak "alt" olarak yazılır — bu geçerlidir
  const noAlt = imgs.filter((t) => !/[\s"']alt(?=[\s=>/])/i.test(t)).length;
  const ogImage = meta(html, 'og:image', 'property');
  const jsonld = [...html.matchAll(/<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)].flatMap((m) => {
    try { const j = JSON.parse(m[1]); return (Array.isArray(j) ? j : [j]).flatMap((x) => x['@graph'] ?? [x]).map((x) => x['@type']).flat(); } catch { return ['(bozuk JSON-LD)']; }
  });
  const text = decode(html.replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ').replace(/<[^>]+>/g, ' '));
  const words = text.split(' ').filter(Boolean).length;
  const issues = [];
  if (!title) issues.push(['err', 'Başlık (title) yok']);
  else if (title.length > 65) issues.push(['warn', `Başlık uzun (${title.length}); ~60 karakter önerilir`]);
  else if (title.length < 20) issues.push(['warn', `Başlık kısa (${title.length})`]);
  if (!description) issues.push(['err', 'Arama açıklaması yok']);
  else if (description.length > 175) issues.push(['warn', `Açıklama uzun (${description.length})`]);
  else if (description.length < 70) issues.push(['warn', `Açıklama kısa (${description.length})`]);
  if (!canonicalHref) issues.push(['err', 'Canonical bağlantı yok']);
  else if (!canonicalHref.startsWith(config.siteUrl.replace(/\/$/, ''))) issues.push(['warn', `Canonical farklı alan adına işaret ediyor: ${canonicalHref}`]);
  if (h1 !== 1) issues.push([h1 === 0 ? 'err' : 'warn', `H1 sayısı ${h1} (1 olmalı)`]);
  if (noAlt) issues.push(['err', `${noAlt} görselde alt özniteliği yok`]);
  if (!ogImage) issues.push(['info', 'og:image yok (sosyal paylaşım önizlemesi)']);
  if (!jsonld.length) issues.push(['info', 'Yapısal veri (JSON-LD) yok']);
  if (words < 120 && !robots.includes('dizin dışı')) issues.push(['info', `İçerik az (${words} kelime)`]);
  const score = Math.max(0, 100 - issues.reduce((s, [k]) => s + (k === 'err' ? 18 : k === 'warn' ? 7 : 3), 0));
  return { url, title, description, canonical: canonicalHref, h1, images: imgs.length, imagesNoAlt: noAlt, ogImage: !!ogImage, noindex: robots.includes('dizin dışı'), schema: [...new Set(jsonld)], words, issues, score };
};

let cache = { at: 0, data: null };
export const scanSite = (force = false) => {
  if (!force && cache.data && Date.now() - cache.at < 60_000) return cache.data;
  const root = config.siteDir;
  const files = walk(root);
  const pages = files.map((f) => {
    const rel = path.relative(root, f).replace(/\\/g, '/').replace(/\.html$/, '');
    const url = rel === 'index' ? '/' : `/${rel.replace(/\/index$/, '')}`;
    return analyzePage(fs.readFileSync(f, 'utf8'), url);
  }).filter((p) => p.url !== '/404');
  // sitemap karşılaştırması
  const sm = [];
  for (const n of fs.existsSync(root) ? fs.readdirSync(root).filter((f) => /^sitemap.*\.xml$/.test(f)) : []) {
    for (const m of fs.readFileSync(path.join(root, n), 'utf8').matchAll(/<loc>([^<]+)<\/loc>/g)) sm.push(m[1]);
  }
  const smPaths = new Set(sm.map((u) => { try { return new URL(u).pathname.replace(/\/$/, '') || '/'; } catch { return u; } }).filter((u) => !u.endsWith('.xml')));
  const indexable = pages.filter((p) => !p.noindex);
  const notInSitemap = indexable.filter((p) => !smPaths.has(p.url)).map((p) => p.url);
  const sitemapOrphans = [...smPaths].filter((u) => !pages.some((p) => p.url === u));
  const robotsTxt = fs.existsSync(path.join(root, 'robots.txt')) ? fs.readFileSync(path.join(root, 'robots.txt'), 'utf8') : null;
  const dup = (key) => {
    const m = new Map();
    for (const p of pages) if (p[key]) m.set(p[key], [...(m.get(p[key]) ?? []), p.url]);
    return [...m.entries()].filter(([, v]) => v.length > 1).map(([value, urls]) => ({ value, urls }));
  };
  const data = {
    scannedAt: new Date().toISOString(),
    siteDir: fs.existsSync(root),
    total: pages.length,
    avgScore: pages.length ? Math.round(pages.reduce((s, p) => s + p.score, 0) / pages.length) : 0,
    errors: pages.reduce((s, p) => s + p.issues.filter(([k]) => k === 'err').length, 0),
    warnings: pages.reduce((s, p) => s + p.issues.filter(([k]) => k === 'warn').length, 0),
    infos: pages.reduce((s, p) => s + p.issues.filter(([k]) => k === 'info').length, 0),
    checksTotal: pages.length * 9,
    sitemap: { urls: smPaths.size, indexableNotInSitemap: notInSitemap, orphans: sitemapOrphans },
    robots: { present: robotsTxt !== null, hasSitemapLine: /sitemap:/i.test(robotsTxt ?? ''), adminBlocked: /disallow:\s*\/yonetim/i.test(robotsTxt ?? '') },
    duplicateTitles: dup('title'),
    duplicateDescriptions: dup('description'),
    pages: pages.sort((a, b) => a.score - b.score || a.url.localeCompare(b.url)),
    notes: ['Bu skor Google sıralama skoru DEĞİLDİR; yalnızca açıklanabilir teknik kontrollerin özetidir.', 'Arama sonuçlarında görsel gösterimi garanti edilemez.'],
  };
  cache = { at: Date.now(), data };
  return data;
};

export const getFocus = (kind, slug) => q.get('SELECT focus FROM seo_focus WHERE kind = ? AND slug = ?', kind, slug)?.focus ?? '';
export const setFocus = (kind, slug, focus) =>
  q.run(`INSERT INTO seo_focus (kind, slug, focus) VALUES (?,?,?) ON CONFLICT(kind, slug) DO UPDATE SET focus = excluded.focus, updated_at = datetime('now')`, kind, slug, String(focus ?? '').slice(0, 120));

/* ---------- Hız motoru: gerçek ölçümler (önbellek başlıkları, ağırlık) ---------- */
export const speedReport = () => {
  const root = config.siteDir;
  if (!fs.existsSync(root)) return { available: false };
  const sizeOf = (f) => fs.statSync(f).size;
  const all = [];
  const w = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) w(p); else all.push(p); } };
  w(root);
  const by = (re) => all.filter((f) => re.test(f));
  const sum = (a) => a.reduce((s, f) => s + sizeOf(f), 0);
  const htmls = by(/\.html$/);
  const top = (a, n = 8) => a.map((f) => ({ file: path.relative(root, f).replace(/\\/g, '/'), kb: Math.round(sizeOf(f) / 1024) })).sort((x, y) => y.kb - x.kb).slice(0, n);
  const imgs = by(/\.(png|jpe?g|webp|avif|gif)$/i);
  return {
    available: true,
    files: all.length,
    html: { count: htmls.length, totalKb: Math.round(sum(htmls) / 1024), avgKb: htmls.length ? Math.round(sum(htmls) / htmls.length / 1024) : 0 },
    js: { count: by(/\.js$/).length, totalKb: Math.round(sum(by(/\.js$/)) / 1024) },
    css: { count: by(/\.css$/).length, totalKb: Math.round(sum(by(/\.css$/)) / 1024) },
    images: { count: imgs.length, totalKb: Math.round(sum(imgs) / 1024), heaviest: top(imgs), modern: imgs.filter((f) => /\.(webp|avif)$/i.test(f)).length },
    fonts: { count: by(/\.(woff2?|ttf|otf)$/i).length, totalKb: Math.round(sum(by(/\.(woff2?|ttf|otf)$/i)) / 1024) },
    heavyAssets: top(all.filter((f) => !/\.(html)$/.test(f))),
    caching: {
      static: 'Sunucu: HTML için ETag + no-cache (her seferinde yeniden doğrulama, değişmediyse 304); diğer statik varlıklar için ETag ve uzun ömürlü Cache-Control (server/lib/static.mjs).',
      adminNoStore: 'Yönetim ve API yanıtları Cache-Control: no-store — oturumlu içerik herkese açık önbelleğe girmez.',
    },
    cdn: { available: false, reason: 'CDN/vekil sunucu adaptörü bağlı değil. Veridyen planı veya Cloudflare gibi bir vekil sunucu ile sunucu düzeyinde etkinleştirilebilir.' },
    cwv: { available: false, reason: 'Alan verisi (gerçek kullanıcı) için Google Arama Konsolu / Sayfa Hızı API anahtarı gerekir; sentetik ve alan verisi ayrı tutulur.' },
  };
};

/* ---------- SEO Analizi genel bakış: yalnızca gerçek veriler ---------- */
export const seoOverview = (n = 30) => {
  const scan = scanSite();
  const st = getStats(n);
  const prev = getStats(2 * n);
  const cur = st.total, before = prev.total - st.total;
  const indexable = scan.pages.filter((p) => !p.noindex);
  const home = scan.pages.find((p) => p.url === '/') ?? scan.pages[0] ?? null;
  const typeCount = {};
  for (const p of scan.pages) for (const t of p.schema) typeCount[t] = (typeCount[t] ?? 0) + 1;
  const imgs = scan.pages.reduce((a, p) => a + p.images, 0);
  const noAlt = scan.pages.reduce((a, p) => a + p.imagesNoAlt, 0);
  let speed = null;
  try { speed = speedReport(); } catch { /* derleme yok */ }
  const passed = Math.max(0, scan.checksTotal - scan.errors - scan.warnings - scan.infos);

  // fırsatlar: içerik kayıtlarındaki gerçek eksikler
  const opps = [];
  const rows = [];
  for (const kind of ['blog', 'projects']) for (const e of listEntries(kind)) rows.push({ kind, ...e });
  const noDesc = [], noFocus = [], noLink = [];
  for (const r of rows.filter((x) => !x.draft)) {
    try {
      const e = getEntry(r.kind, r.slug);
      const d = e.data;
      const desc = d.seo?.description ?? d.description ?? d.summary ?? '';
      if (desc.length < 120) noDesc.push(r);
      if (!getFocus(r.kind, r.slug)) noFocus.push(r);
      if (!/\]\(\//.test(e.body)) noLink.push(r);
    } catch { /* bozuk kayıt */ }
  }
  const first = (arr) => (arr[0] ? `/seo/editor/${arr[0].kind}/${arr[0].slug}` : '/seo/editor');
  if (noDesc.length) opps.push({ icon: 'edit', color: '#f79009', title: `${noDesc.length} içerikte meta açıklama kısa/eksik`, sub: 'İdeal uzunluk 120–160 karakter', to: first(noDesc) });
  if (noFocus.length) opps.push({ icon: 'search', color: '#0b7bd6', title: `${noFocus.length} içerik için odak sorgu tanımlı değil`, sub: 'Canlı SEO editöründe odak sorgu girin', to: first(noFocus) });
  if (noLink.length) opps.push({ icon: 'link', color: '#8b5cf6', title: `${noLink.length} içerikte iç bağlantı yok`, sub: 'İlgili hizmet/yazılara bağlantı ekleyin', to: first(noLink) });
  if (scan.duplicateTitles.length) opps.push({ icon: 'alert', color: '#f04438', title: `${scan.duplicateTitles.length} yinelenen sayfa başlığı`, sub: 'Her sayfa için benzersiz başlık kullanın', to: '/seo' });
  if (scan.sitemap.indexableNotInSitemap.length) opps.push({ icon: 'doc', color: '#12b76a', title: `${scan.sitemap.indexableNotInSitemap.length} sayfa sitemap'te yok`, sub: scan.sitemap.indexableNotInSitemap.slice(0, 2).join(', '), to: '/seo' });
  const noOg = scan.pages.filter((p) => !p.ogImage && !p.noindex).length;
  if (noOg) opps.push({ icon: 'image', color: '#06b6d4', title: `${noOg} sayfada og:image yok`, sub: 'Sosyal paylaşım önizlemesi için görsel ekleyin', to: '/seo' });

  const top = st.topPages.slice(0, 8).map((p) => {
    const pg = scan.pages.find((x) => x.url === p.path);
    return { path: p.path, title: pg?.title ?? p.path, views: p.views, score: pg?.score ?? null };
  });
  const totalTop = Math.max(...top.map((x) => x.views), 1);
  return {
    range: n,
    scannedAt: scan.scannedAt,
    kpi: { indexed: scan.sitemap.urls, pages: scan.total, excluded: scan.pages.length - indexable.length, avgScore: scan.avgScore, visits: cur, visitsDelta: before > 0 ? ((cur - before) / before) * 100 : null, visitSeries: st.daily.map((d) => d.views) },
    labels: st.daily.map((d) => `${d.day.slice(8)}/${d.day.slice(5, 7)}`),
    health: { critical: scan.errors, important: scan.warnings, improve: scan.infos, passed, score: scan.avgScore },
    opportunities: opps.slice(0, 6),
    sitemap: { urls: scan.sitemap.urls, indexable: indexable.length, excluded: scan.pages.length - indexable.length, notInSitemap: scan.sitemap.indexableNotInSitemap.length, orphans: scan.sitemap.orphans.length, robots: scan.robots },
    schema: { typeCount, typeKinds: Object.keys(typeCount).length, pagesWithSchema: scan.pages.filter((p) => p.schema.length).length, pages: scan.total, images: imgs, imagesNoAlt: noAlt, altPct: imgs ? Math.round(((imgs - noAlt) / imgs) * 100) : 100, modernPct: speed?.available && speed.images.count ? Math.round((speed.images.modern / speed.images.count) * 100) : null },
    serp: home ? { url: home.url, title: home.title, description: home.description, canonical: home.canonical } : null,
    topPages: top.map((x) => ({ ...x, pct: Math.round((x.views / totalTop) * 100) })),
    siteUrl: process.env.PUBLIC_SITE_URL || '',
  };
};

/* ---------- İç bağlantı önerileri: gerçek sayfa başlıkları ile kelime örtüşmesi ---------- */
const STOP = new Set('ve veya ile için bir bu şu da de mi mı mu mü olarak daha çok en gibi ise ama fakat the and for of to in a is'.split(' '));
const words = (t) => String(t).toLocaleLowerCase('tr').replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter((w) => w.length > 3 && !STOP.has(w));
export const internalLinkSuggestions = (kind, slug) => {
  const e = getEntry(kind, slug);
  const body = e.body ?? '';
  const mine = new Set([...words(e.data.title ?? ''), ...words(body).slice(0, 400)]);
  const selfUrl = kind === 'blog' ? `/blog/${slug}` : `/projeler/${slug}`;
  const scan = scanSite();
  const out = [];
  for (const p of scan.pages) {
    if (p.noindex || p.url === selfUrl || p.url === '/' || /^\/(blog\/(etiket|sayfa)|arama|404)/.test(p.url) || !p.title) continue;
    if (body.includes(`](${p.url})`)) continue;
    const tw = words(p.title.replace(/\|.*$/, ''));
    if (!tw.length) continue;
    const hit = tw.filter((w) => mine.has(w)).length;
    if (!hit) continue;
    out.push({ title: p.title.replace(/\s*[|—-]\s*AKORT.*$/i, ''), url: p.url, score: Math.round((hit / tw.length) * 100) });
  }
  return out.sort((a, b) => b.score - a.score).slice(0, 5);
};
