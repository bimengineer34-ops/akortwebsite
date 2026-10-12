// SEO Intelligence — derlenmiş siteyi (dist) tarayan GERÇEK teknik denetim. Puanlar Google skoru değildir.
import fs from 'node:fs';
import path from 'node:path';
import { config } from '../config.mjs';
import { q } from '../db.mjs';
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
  const noAlt = imgs.filter((t) => attr(t, 'alt') === undefined).length;
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
  if (!description) issues.push(['err', 'Meta açıklama yok']);
  else if (description.length > 175) issues.push(['warn', `Açıklama uzun (${description.length})`]);
  else if (description.length < 70) issues.push(['warn', `Açıklama kısa (${description.length})`]);
  if (!canonicalHref) issues.push(['err', 'Canonical bağlantı yok']);
  else if (!canonicalHref.startsWith(config.siteUrl.replace(/\/$/, ''))) issues.push(['warn', `Canonical farklı alan adına işaret ediyor: ${canonicalHref}`]);
  if (h1 !== 1) issues.push([h1 === 0 ? 'err' : 'warn', `H1 sayısı ${h1} (1 olmalı)`]);
  if (noAlt) issues.push(['err', `${noAlt} görselde alt özniteliği yok`]);
  if (!ogImage) issues.push(['warn', 'og:image yok (sosyal paylaşım önizlemesi)']);
  if (!jsonld.length) issues.push(['warn', 'Yapısal veri (JSON-LD) yok']);
  if (words < 120 && !robots.includes('noindex')) issues.push(['warn', `İçerik az (${words} kelime)`]);
  const score = Math.max(0, 100 - issues.reduce((s, [k]) => s + (k === 'err' ? 18 : 7), 0));
  return { url, title, description, canonical: canonicalHref, h1, images: imgs.length, imagesNoAlt: noAlt, ogImage: !!ogImage, noindex: robots.includes('noindex'), schema: [...new Set(jsonld)], words, issues, score };
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
    cdn: { available: false, reason: 'CDN/Proxy adaptörü bağlı değil. Veridyen planı veya Cloudflare gibi bir proxy ile sunucu düzeyinde etkinleştirilebilir.' },
    cwv: { available: false, reason: 'Alan verisi (CrUX/RUM) için Search Console / PageSpeed API anahtarı gerekir; sentetik ve alan verisi ayrı tutulur.' },
  };
};
