// Canlıya geçiş denetimi (yalnızca GET, çalışan sunucuya karşı): node scripts/launch-audit.mjs [http://localhost:4332]
// Sitemap'teki her sayfayı tarar; içerik/SEO/güvenlik/erişilebilirlik bulgularını "kritik" ve "uyarı" olarak raporlar.
const base = (process.argv[2] ?? 'http://localhost:4332').replace(/\/$/, '');
const crit = [], warn = [], info = [];
const add = (arr, where, msg) => arr.push(`${where}: ${msg}`);

const get = async (p, opt = {}) => { const r = await fetch(base + p, { redirect: 'manual', ...opt }); return { r, t: await r.text() }; };

// sitemap
const sm = await get('/sitemap-0.xml');
const urls = [...sm.t.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => new URL(m[1]).pathname.replace(/\/$/, '') || '/');
info.push(`sitemap: ${urls.length} adres`);
if (!urls.length) add(crit, 'sitemap', 'boş veya okunamadı');

const titles = new Map(), descs = new Map();
const BAD_TEXT = /\bTODO\b|TodoAsset|lorem ipsum|\bundefined\b|\[object|yakında aktif|hazırlanıyor|örnek proje|placeholder/i;
let total = 0, maxSize = 0, bigPages = [];
for (const u of urls) {
  const { r, t } = await get(u);
  total++;
  if (r.status !== 200) { add(crit, u, `HTTP ${r.status}`); continue; }
  const size = Buffer.byteLength(t); maxSize = Math.max(maxSize, size); if (size > 400_000) bigPages.push(`${u} (${Math.round(size / 1024)} KB)`);
  const title = /<title>([^<]*)<\/title>/.exec(t)?.[1]?.trim() ?? '';
  const desc = /<meta[^>]+name="description"[^>]+content="([^"]*)"/.exec(t)?.[1] ?? /<meta[^>]+content="([^"]*)"[^>]+name="description"/.exec(t)?.[1] ?? '';
  const canon = /<link[^>]+rel="canonical"[^>]+href="([^"]+)"/.exec(t)?.[1] ?? '';
  const robots = /<meta[^>]+name="robots"[^>]+content="([^"]*)"/.exec(t)?.[1] ?? '';
  const h1s = (t.match(/<h1[\s>]/g) ?? []).length;
  if (!title) add(crit, u, 'title yok'); else { if (title.length > 70) add(warn, u, `title uzun (${title.length})`); if (title.length < 15) add(warn, u, `title kısa (${title.length})`); titles.set(title, [...(titles.get(title) ?? []), u]); }
  if (!desc) add(crit, u, 'meta description yok'); else { if (desc.length > 175) add(warn, u, `description uzun (${desc.length})`); if (desc.length < 60) add(warn, u, `description kısa (${desc.length})`); descs.set(desc, [...(descs.get(desc) ?? []), u]); }
  if (!canon) add(crit, u, 'canonical yok'); else if (new URL(canon).pathname.replace(/\/$/, '') !== (u === '/' ? '' : u) && !(u === '/' && new URL(canon).pathname === '/')) add(warn, u, `canonical farklı: ${canon}`);
  if (/noindex/i.test(robots)) add(crit, u, `sitemap'te ama noindex (${robots})`);
  if (h1s !== 1) add(warn, u, `h1 sayısı ${h1s}`);
  if (!/<html[^>]+lang="/.test(t)) add(crit, u, 'html lang yok');
  if (!/property="og:image"/.test(t)) add(warn, u, 'og:image yok');
  if (!/name="viewport"/.test(t)) add(crit, u, 'viewport yok');
  // görünür metin
  const text = t.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<svg[\s\S]*?<\/svg>|<!--[\s\S]*?-->/g, ' ').replace(/<[^>]+>/g, ' ');
  const m = BAD_TEXT.exec(text) ?? /(?<![\p{L}])NaN(?![\p{L}])/u.exec(text); if (m) add(crit, u, `yer tutucu/hatalı metin: "${m[0]}" …${text.slice(Math.max(0, m.index - 40), m.index + 50).replace(/\s+/g, ' ')}`);
  // erişilebilirlik
  const noAlt = (t.match(/<img\b(?![^>]*\balt\b)[^>]*>/g) ?? []).length; if (noAlt) add(crit, u, `${noAlt} görselde alt yok`);
  const emptyLinks = (t.match(/<a\b[^>]*>\s*<\/a>/g) ?? []).length; if (emptyLinks) add(warn, u, `${emptyLinks} boş bağlantı`);
  const hashLinks = (t.match(/<a\b[^>]*href="#"[^>]*>/g) ?? []).length; if (hashLinks) add(warn, u, `${hashLinks} href="#" bağlantı`);
  const btnNoName = (t.match(/<button\b(?![^>]*aria-label)[^>]*>\s*<svg(?:(?!<\/svg>|<\/button>)[\s\S])*<\/svg>\s*<\/button>/g) ?? []).length; if (btnNoName) add(warn, u, `${btnNoName} simge-düğmede aria-label yok`);
  // JSON-LD
  for (const j of t.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) { try { JSON.parse(j[1]); } catch { add(crit, u, 'JSON-LD geçersiz'); } }
  // mailto / tel
  for (const mm of t.matchAll(/href="(mailto:[^"]*|tel:[^"]*)"/g)) add(info, u, `iletişim bağlantısı: ${mm[1]}`);
}
for (const [k, v] of titles) if (v.length > 1) add(warn, 'yinelenen title', `"${k.slice(0, 60)}" → ${v.slice(0, 3).join(', ')}${v.length > 3 ? ` (+${v.length - 3})` : ''}`);
for (const [k, v] of descs) if (v.length > 1) add(warn, 'yinelenen description', `"${k.slice(0, 50)}…" → ${v.slice(0, 3).join(', ')}${v.length > 3 ? ` (+${v.length - 3})` : ''}`);
if (bigPages.length) add(warn, 'sayfa boyutu', bigPages.slice(0, 5).join('; '));

// güvenlik başlıkları + kritik uçlar
const h = async (p) => (await get(p)).r.headers;
const hm = await h('/');
for (const k of ['x-content-type-options', 'referrer-policy', 'content-security-policy']) if (!hm.get(k)) add(warn, '/', `${k} başlığı yok`);
if (!hm.get('strict-transport-security')) add(info, '/', 'HSTS yok (HTTPS sağlayıcıda — Vercel/Veridyen — eklenir)');
const ha = await h('/yonetim/');
for (const k of ['content-security-policy', 'x-content-type-options', 'x-frame-options']) if (!ha.get(k)) add(warn, '/yonetim/', `${k} başlığı yok`);
const nf = await get('/bu-sayfa-yok-12345'); if (nf.r.status !== 404) add(crit, '404', `var olmayan sayfa ${nf.r.status} döndürüyor`);
const hint = await get('/api/admin/durum'); const hintJ = (() => { try { return JSON.parse(hint.t); } catch { return {}; } })();
if (hintJ.loginHint) add(info, '/api/admin/durum', 'loginHint yalnızca geliştirme (loopback + NODE_ENV!=production); canlıda NODE_ENV=production ve TRUST_PROXY=true ayarlayın');
for (const p of ['/.env', '/data/akort.db', '/server/index.mjs', '/package.json', '/.git/config', '/api/admin/kullanicilar', '/api/admin/yedekler']) {
  const x = await get(p); if (x.r.status === 200 && !/<html/i.test(x.t.slice(0, 300)) || (p.startsWith('/api/admin') && x.r.status === 200)) add(crit, p, `erişilebilir! (HTTP ${x.r.status})`);
}
// form uç noktaları (boş istek; 4xx beklenir, 5xx hata)
for (const p of ['/api/iletisim', '/api/bulten']) { const x = await get(p, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: base }, body: '{}' }); if (x.r.status >= 500) add(crit, p, `sunucu hatası ${x.r.status}`); else info.push(`${p}: boş istek → ${x.r.status}`); }
// robots / sitemap-index
const rb = await get('/robots.txt'); if (!/Disallow: \/yonetim/.test(rb.t)) add(crit, '/robots.txt', 'yönetim paneli engellenmemiş');
if (/localhost|example\./.test(rb.t + sm.t)) add(crit, 'robots/sitemap', 'localhost/example adresi var');
const si = await get('/sitemap-index.xml'); if (si.r.status !== 200) add(crit, '/sitemap-index.xml', `HTTP ${si.r.status}`);
if (/localhost/.test(sm.t)) add(crit, 'sitemap', 'localhost adresi var');
info.push(`sitemap alan adı: ${[...new Set([...sm.t.matchAll(/<loc>https?:\/\/([^/]+)/g)].map((m) => m[1]))].join(', ')}`);

console.log(`${total} sayfa tarandı · en büyük HTML ${Math.round(maxSize / 1024)} KB`);
console.log(`\n=== KRİTİK (${crit.length}) ===`); crit.slice(0, 60).forEach((x) => console.log(' ✗', x));
console.log(`\n=== UYARI (${warn.length}) ===`); warn.slice(0, 60).forEach((x) => console.log(' !', x));
console.log(`\n=== BİLGİ ===`); [...new Set(info)].slice(0, 25).forEach((x) => console.log(' ·', x));
process.exit(crit.length ? 1 : 0);
