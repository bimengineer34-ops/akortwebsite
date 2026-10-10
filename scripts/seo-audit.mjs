// SEO denetimi — production build (dist/) üzerinde çalışır, bağımlılık yok.
// Kullanım: npm run build && node scripts/seo-audit.mjs
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const dist = new URL('../dist/', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const files = [];
const walk = (dir) => {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) walk(p);
    else if (p.endsWith('.html')) files.push(p);
  }
};
walk(dist);

const sitemapXml = existsSync(join(dist, 'sitemap-0.xml')) ? readFileSync(join(dist, 'sitemap-0.xml'), 'utf8') : '';
const sitemapUrls = new Set([...sitemapXml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => new URL(m[1]).pathname.replace(/\/$/, '') || '/'));

const decode = (s) => s.replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
const attr = (html, re) => {
  const m = html.match(re);
  return m ? decode(m[1]) : undefined;
};

const rows = [];
const titles = new Map();
const descs = new Map();
let issueCount = 0;

for (const file of files) {
  const html = readFileSync(file, 'utf8');
  const route = '/' + relative(dist, file).split(sep).join('/').replace(/\.html$/, '').replace(/(^|\/)index$/, '');
  const path = route === '/' ? '/' : route.replace(/\/$/, '');
  const issues = [];

  const title = attr(html, /<title>([^<]*)<\/title>/);
  const desc = attr(html, /<meta name="description" content="([^"]*)"/);
  const canonical = attr(html, /<link rel="canonical" href="([^"]*)"/);
  const robots = attr(html, /<meta name="robots" content="([^"]*)"/) ?? '';
  const lang = attr(html, /<html lang="([^"]*)"/);
  const noindex = robots.includes('noindex');

  if (!lang) issues.push('html lang yok');
  if (!title) issues.push('title yok');
  else {
    if (title.length > 65) issues.push(`title uzun (${title.length})`);
    titles.set(title, [...(titles.get(title) ?? []), path]);
  }
  if (!desc) issues.push('description yok');
  else {
    if (desc.length < 70 || desc.length > 165) issues.push(`description uzunluğu ${desc.length}`);
    if (!noindex) descs.set(desc, [...(descs.get(desc) ?? []), path]);
  }
  if (!canonical) issues.push('canonical yok');
  else if (path !== '/404' && new URL(canonical).pathname.replace(/\/$/, '') !== (path === '/' ? '' : path)) issues.push(`canonical uyumsuz: ${canonical}`);

  const h1s = (html.match(/<h1[\s>]/g) ?? []).length;
  if (h1s !== 1) issues.push(`h1 sayısı ${h1s}`);

  // Başlık sırası (görünmeyen asistan paneli hariç)
  const body = html.replace(/<section[^>]*data-assistant-panel[\s\S]*?<\/section>/, '');
  const levels = [...body.matchAll(/<h([1-6])[\s>]/g)].map((m) => +m[1]);
  levels.forEach((l, i) => {
    if (i > 0 && l - levels[i - 1] > 1) issues.push(`başlık atlaması h${levels[i - 1]}→h${l}`);
  });

  // Boş alt (dekoratif) HTML'de `alt` veya `alt=""` olarak çıkabilir — ikisi de geçerli
  const imgsNoAlt = [...html.matchAll(/<img\b(?![^>]*\salt(?:[\s=>]|$))[^>]*>/g)].length;
  if (imgsNoAlt) issues.push(`${imgsNoAlt} img alt yok`);

  for (const p of ['og:title', 'og:description', 'og:url', 'og:locale']) if (!html.includes(`property="${p}"`)) issues.push(`${p} yok`);
  if (!html.includes('name="twitter:card"')) issues.push('twitter:card yok');

  const ldBlocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
  const types = [];
  for (const b of ldBlocks) {
    try {
      const j = JSON.parse(b[1]);
      (Array.isArray(j) ? j : [j]).forEach((o) => types.push(o['@type']));
    } catch {
      issues.push('JSON-LD parse hatası');
    }
  }
  if (!types.includes('Organization')) issues.push('Organization şeması yok');
  if (path !== '/' && path !== '/404' && !types.includes('BreadcrumbList')) issues.push('BreadcrumbList yok');

  const inSitemap = sitemapUrls.has(path);
  if (noindex && inSitemap) issues.push('noindex ama sitemap\'te');
  if (!noindex && !inSitemap && path !== '/404') issues.push('index ama sitemap\'te yok');

  issueCount += issues.length;
  rows.push({ path, title: title?.slice(0, 48), noindex, sitemap: inSitemap, ld: [...new Set(types)].join(','), issues });
}

for (const [t, paths] of titles) if (paths.length > 1) { console.log(`TEKRAR EDEN TITLE "${t}": ${paths.join(', ')}`); issueCount++; }
for (const [d, paths] of descs) if (paths.length > 1) { console.log(`TEKRAR EDEN DESCRIPTION: ${paths.join(', ')}`); issueCount++; }

rows.sort((a, b) => a.path.localeCompare(b.path));
for (const r of rows) {
  console.log(`${r.issues.length ? '✗' : '✓'} ${r.path.padEnd(34)} ${r.noindex ? 'noindex' : 'index  '} ${r.sitemap ? 'sitemap' : '       '} [${r.ld}]`);
  r.issues.forEach((i) => console.log(`    - ${i}`));
}
console.log(`\n${rows.length} sayfa, ${issueCount} sorun`);
process.exit(issueCount ? 1 : 0);
