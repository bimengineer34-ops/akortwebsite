// Marka Seti: GERÇEK marka verisi (site token'ları, logolar, ikonlar) + deterministik şablon oluşturucu.
// Marka metni/logo her zaman şablon katmanı olarak bindirilir — yapay zekâ logo/tipografi uydurmaz.
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { ROOT, config, paths } from '../config.mjs';
import { HttpError } from '../http.mjs';
import { mediaFilePath, uploadMedia, updateMedia, getMedia } from '../media.mjs';
import { audit } from '../db.mjs';

const tokensFile = path.join(ROOT, 'src', 'styles', 'tokens.css');
const brandDir = path.join(ROOT, 'src', 'assets', 'brand');

const PALETTE_KEYS = [
  ['navy-950', 'Koyu Lacivert', 'Footer, koyu zemin'], ['navy-900', 'Ana Lacivert', 'Vurgu bantları'], ['primary-700', 'Ana Mavi', 'Birincil renk, düğmeler'], ['primary-800', 'Koyu Mavi', 'Hover/aktif'],
  ['accent-600', 'Vurgu Mavisi', 'Simge çizgileri'], ['accent-500', 'Açık Vurgu', 'Bağlantı, CTA'], ['accent-400', 'Mavi Çizim', 'BIM wireframe'], ['cyan-300', 'Buz Mavisi', 'Başlık vurgusu'],
  ['step-bg', 'Süreç Turkuazı', 'Adım daireleri'], ['surface-soft', 'Açık Zemin', 'Bölüm zemini'], ['heading', 'Başlık Rengi', 'H1–H3'], ['body', 'Gövde Metni', 'Paragraf'], ['muted', 'Soluk Metin', 'Yardımcı metin'],
];

export const brandData = () => {
  const css = fs.existsSync(tokensFile) ? fs.readFileSync(tokensFile, 'utf8') : '';
  const val = (k) => new RegExp(`--color-${k}:\\s*(#[0-9a-fA-F]{3,8})`).exec(css)?.[1]?.toLowerCase() ?? null;
  const palette = PALETTE_KEYS.map(([k, name, use]) => ({ key: k, name, use, hex: val(k) })).filter((c) => c.hex);
  const sizes = [['display', 'Büyük Başlık'], ['h1', 'Başlık 1'], ['h2', 'Başlık 2'], ['h3', 'Başlık 3'], ['lead', 'Giriş Metni'], ['body', 'Gövde'], ['small', 'Küçük'], ['xs', 'Çok Küçük']].map(([k, label]) => {
    const m = new RegExp(`--text-${k}:\\s*([^;]+);`).exec(css);
    return m ? { key: k, label, value: m[1].replace(/\/\*.*$/, '').trim() } : null;
  }).filter(Boolean);
  const iconNames = [];
  const walk = (d, pre) => { if (!fs.existsSync(d)) return; for (const e of fs.readdirSync(d, { withFileTypes: true })) { if (e.isDirectory()) walk(path.join(d, e.name), `${pre}${e.name}/`); else if (e.name.endsWith('.svg')) iconNames.push(`${pre}${e.name.slice(0, -4)}`); } };
  walk(paths.iconsDir, '');
  return {
    palette, sizes, font: { family: 'Plus Jakarta Sans', license: 'OFL (SIL Open Font License)', note: 'Site yazı tipi; şablon çıktısında sunucuda yüklü sistem yazı tipi kullanılır.' },
    logos: [
      { key: 'horizontal', name: 'Ana Logo (Yatay)', note: 'Açık zemin', src: '/yonetim/img/logo-h.png', dark: false },
      { key: 'horizontal-dark', name: 'Alternatif Logo (Yatay, açık)', note: 'Koyu zemin', src: '/yonetim/img/logo-h-dark.png', dark: true },
      { key: 'mark', name: 'Sembol', note: 'Açık zemin', src: '/yonetim/img/logo-mark.png', dark: false },
      { key: 'mark-dark', name: 'Sembol (açık)', note: 'Koyu zemin', src: '/yonetim/img/logo-mark-dark.png', dark: true },
    ],
    icons: iconNames.sort(), templates: Object.entries(TEMPLATES).map(([key, t]) => ({ key, name: t.name, note: t.note, title: t.title, subtitle: t.subtitle, theme: t.theme })),
    formats: Object.entries(FORMATS).map(([key, f]) => ({ key, label: f.label, w: f.w, h: f.h })),
    themes: Object.entries(THEMES).map(([key, t]) => ({ key, label: t.label, colors: t.stops })),
    siteHost: new URL(config.siteUrl).hostname,
  };
};

export const FORMATS = {
  'ig-kare': { label: 'Instagram Gönderi (1080 × 1080)', w: 1080, h: 1080 },
  'ig-dikey': { label: 'Instagram Dikey (1080 × 1350)', w: 1080, h: 1350 },
  story: { label: 'Hikâye / Reels (1080 × 1920)', w: 1080, h: 1920 },
  link: { label: 'LinkedIn / Facebook Bağlantı (1200 × 628)', w: 1200, h: 628 },
  yatay: { label: 'YouTube / 16:9 (1600 × 900)', w: 1600, h: 900 },
};
const THEMES = {
  marka: { label: 'Marka Mavisi', stops: ['#08243a', '#0b4f80', '#2f86b7'], text: '#ffffff', accent: '#8fd3f5', dark: true },
  koyu: { label: 'Koyu Tema', stops: ['#050d17', '#0b1a2b', '#10263b'], text: '#ffffff', accent: '#55a9d9', dark: true },
  acik: { label: 'Açık Tema', stops: ['#ffffff', '#f3f7fa', '#e2ecf4'], text: '#0e1b2c', accent: '#0b4f80', dark: false },
  gri: { label: 'Gri Tema', stops: ['#e9edf2', '#d3dae3', '#bcc6d2'], text: '#0e1b2c', accent: '#0b4f80', dark: false },
};
const TEMPLATES = {
  'proje-tanitim': { name: 'Proje Tanıtım', note: 'Proje/çalışma duyurusu', title: 'DAHA İLERİYE', subtitle: 'Sürdürülebilir yapılarla daha güçlü bir gelecek.', theme: 'marka' },
  'blog-paylasimi': { name: 'Blog Paylaşımı', note: 'Yeni yazı duyurusu', title: 'YENİ BLOG YAZISI', subtitle: 'Yazının kısa özeti burada yer alır.', theme: 'acik' },
  duyuru: { name: 'Duyuru', note: 'Kurumsal duyuru', title: 'DUYURU', subtitle: 'Duyuru metnini yazın.', theme: 'koyu' },
  'sektor-bilgisi': { name: 'Sektör Bilgisi', note: 'Teknik bilgi kartı', title: 'TEKNİK BİLGİ', subtitle: 'Mühendislik bilgisini kısa ve net aktarın.', theme: 'gri' },
  'ozel-gun': { name: 'Özel Gün', note: 'Anma/kutlama', title: 'ÖZEL GÜN', subtitle: 'Anlamlı ve sade bir mesaj yazın.', theme: 'marka' },
};

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]));
const wrap = (text, maxChars) => {
  const words = String(text).split(/\s+/).filter(Boolean);
  const lines = [];
  let cur = '';
  for (const w of words) {
    if ((cur + ' ' + w).trim().length > maxChars && cur) { lines.push(cur); cur = w; } else cur = (cur + ' ' + w).trim();
  }
  if (cur) lines.push(cur);
  return lines;
};
const FONT = "'Segoe UI', 'Helvetica Neue', Arial, 'DejaVu Sans', sans-serif";

/** Tek görselli (JPEG) PDF — harici bağımlılık yok. Sayfa boyutu piksel×0,75 pt (96 dpi karşılığı). */
export const jpegToPdf = (jpeg, w, h) => {
  const pw = (w * 0.75).toFixed(2), ph = (h * 0.75).toFixed(2);
  const content = Buffer.from('q ' + pw + ' 0 0 ' + ph + ' 0 0 cm /Im0 Do Q');
  const parts = [];
  const offs = [];
  let len = 0;
  const push = (b) => { const buf = Buffer.isBuffer(b) ? b : Buffer.from(b, 'latin1'); parts.push(buf); len += buf.length; };
  const obj = (n, body) => { offs[n] = len; push(n + ' 0 obj\n'); push(body); push('\nendobj\n'); };
  push('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');
  obj(1, '<< /Type /Catalog /Pages 2 0 R >>');
  obj(2, '<< /Type /Pages /Kids [3 0 R] /Count 1 >>');
  obj(3, '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' + pw + ' ' + ph + '] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>');
  offs[4] = len; push('4 0 obj\n'); push('<< /Type /XObject /Subtype /Image /Width ' + w + ' /Height ' + h + ' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ' + jpeg.length + ' >>\nstream\n'); push(jpeg); push('\nendstream\nendobj\n');
  offs[5] = len; push('5 0 obj\n'); push('<< /Length ' + content.length + ' >>\nstream\n'); push(content); push('\nendstream\nendobj\n');
  const xref = len;
  push('xref\n0 6\n0000000000 65535 f \n' + [1, 2, 3, 4, 5].map((n) => String(offs[n]).padStart(10, '0') + ' 00000 n \n').join(''));
  push('trailer\n<< /Size 6 /Root 1 0 R /Info << /Title (AKORT sablon) /Producer (AKORT Yonetim) >> >>\nstartxref\n' + xref + '\n%%EOF\n');
  return Buffer.concat(parts);
};

export const renderBrand = async (o) => {
  const f = FORMATS[o.format] ?? FORMATS['ig-kare'];
  const th = THEMES[o.theme] ?? THEMES.marka;
  const W = f.w, H = f.h;
  const pad = Math.round(W * 0.07);
  const align = ['left', 'center', 'right'].includes(o.align) ? o.align : 'left';
  const logoPos = ['left', 'center', 'right'].includes(o.logoPos) ? o.logoPos : 'left';
  const title = String(o.title ?? '').trim().slice(0, 90) || 'BAŞLIK';
  const sub = String(o.subtitle ?? '').trim().slice(0, 200);
  const hasBg = !!o.bg;
  const textColor = hasBg ? '#ffffff' : th.text;
  const accent = hasBg ? '#8fd3f5' : th.accent;
  const anchor = align === 'left' ? 'start' : align === 'center' ? 'middle' : 'end';
  const x = align === 'left' ? pad : align === 'center' ? W / 2 : W - pad;
  const maxW = W - pad * 2;

  // başlık: logo ile alt bant arasındaki alana sığana kadar küçült; son satır vurgu rengi
  const top = Math.round(H * 0.2), bottom = Math.round(H * 0.1);
  const availH = H - top - bottom;
  const subFs = Math.round(Math.max(22, W * (H > W ? 0.03 : 0.026)));
  const subLine = Math.round(subFs * 1.4);
  const sl = wrap(sub, Math.floor(maxW / (subFs * 0.52))).slice(0, H > W ? 5 : 3);
  const subH = sl.length ? Math.round(subFs * 0.9) + sl.length * subLine : 0;
  const TITLE = title.toLocaleUpperCase('tr');
  let fsz = Math.round(W * 0.085), tl;
  for (; fsz > 26; fsz -= 3) { tl = wrap(TITLE, Math.floor(maxW / (fsz * 0.68))); if (tl.length * Math.round(fsz * 1.08) + subH <= availH && tl.length <= 5) break; }
  const lh = Math.round(fsz * 1.08);
  const blockH = tl.length * lh + subH;
  const y0 = Math.round(top + (availH - blockH) / 2) + Math.round(lh * 0.82);
  const tspans = tl.map((ln, i) => `<text x="${x}" y="${y0 + i * lh}" text-anchor="${anchor}" font-family="${FONT}" font-weight="800" font-size="${fsz}" fill="${i === tl.length - 1 && tl.length > 1 ? accent : textColor}" letter-spacing="-1">${esc(ln)}</text>`).join('');
  const subY = y0 + tl.length * lh + Math.round(subFs * 0.5);
  const subSvg = sl.map((ln, i) => `<text x="${x}" y="${subY + i * Math.round(subFs * 1.4)}" text-anchor="${anchor}" font-family="${FONT}" font-weight="500" font-size="${subFs}" fill="${textColor}" opacity="0.92">${esc(ln)}</text>`).join('');
  const [c1, c2, c3] = th.stops;
  const grid = Array.from({ length: 7 }, (_, i) => `<line x1="${W * 0.1 * i}" y1="${H}" x2="${W * 0.1 * i + W * 0.5}" y2="${H * 0.35}" stroke="${accent}" stroke-opacity="0.10" stroke-width="2"/>`).join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c1}"/><stop offset="0.55" stop-color="${c2}"/><stop offset="1" stop-color="${c3}"/></linearGradient>
    <linearGradient id="shade" x1="0" y1="0" x2="${align === 'right' ? 1 : 0}" y2="1"><stop offset="0" stop-color="#050d17" stop-opacity="0.78"/><stop offset="0.55" stop-color="#08243a" stop-opacity="0.55"/><stop offset="1" stop-color="#08243a" stop-opacity="0.82"/></linearGradient>
  </defs>
  ${hasBg ? `<rect width="${W}" height="${H}" fill="url(#shade)"/>` : `<rect width="${W}" height="${H}" fill="url(#bg)"/>${grid}`}
  <rect x="${align === 'right' ? W - pad - 90 : align === 'center' ? W / 2 - 45 : pad}" y="${y0 - fsz - 22}" width="90" height="8" rx="4" fill="${accent}"/>
  ${tspans}${subSvg}
  <rect x="0" y="${H - Math.round(H * 0.07)}" width="${W}" height="${Math.round(H * 0.07)}" fill="${hasBg || th.dark ? '#ffffff' : '#0b4f80'}" opacity="${hasBg || th.dark ? 0.12 : 0.92}"/>
  <text x="${W / 2}" y="${H - Math.round(H * 0.07) / 2 + 9}" text-anchor="middle" font-family="${FONT}" font-weight="600" font-size="${Math.max(18, Math.round(W * 0.019))}" fill="${hasBg || th.dark ? '#ffffff' : '#ffffff'}" letter-spacing="2">${esc(new URL(config.siteUrl).hostname.replace(/^www\./, '').toUpperCase())}</text>
</svg>`;

  const layers = [];
  let base;
  if (hasBg) {
    const file = mediaFilePath(String(o.bg).replace(/^\/medya\//, ''));
    if (!file) throw new HttpError(400, 'Arka plan görseli bulunamadı');
    base = sharp(file).resize(W, H, { fit: 'cover', position: 'attention' });
  } else base = sharp({ create: { width: W, height: H, channels: 4, background: c1 } });
  layers.push({ input: Buffer.from(svg), top: 0, left: 0 });
  // logo: koyu zemin (veya fotoğraf) → açık logo; açık zemin → koyu logo (deterministik katman)
  const useLight = hasBg || th.dark;
  const logoFile = path.join(brandDir, useLight ? 'akort-logo-horizontal-dark.png' : 'akort-logo-horizontal.png');
  if (fs.existsSync(logoFile)) {
    const lw = Math.round(W * 0.34);
    const logo = await sharp(logoFile).resize({ width: lw }).png().toBuffer();
    const lm = await sharp(logo).metadata();
    const lx = logoPos === 'left' ? pad : logoPos === 'center' ? Math.round((W - lw) / 2) : W - pad - lw;
    layers.push({ input: logo, top: Math.round(H * 0.045), left: lx });
    void lm;
  }
  const fmt = ['png', 'jpg', 'webp', 'svg', 'pdf'].includes(o.out) ? o.out : 'png';
  if (fmt === 'svg') {
    // Düzenlenebilir SVG: metinler canlı <text> (yazı tipi: sistemde yüklü olana düşer), görsel/logo gömülü
    const parts = [];
    if (hasBg) parts.push(`<image x="0" y="0" width="${W}" height="${H}" preserveAspectRatio="xMidYMid slice" href="data:image/jpeg;base64,${(await base.clone().jpeg({ quality: 88 }).toBuffer()).toString('base64')}"/>`);
    const bgNode = parts.join('');
    let doc = svg.replace('</defs>', () => `</defs>${bgNode}`);
    const logoLayer = layers.find((l) => l.input !== layers[0].input);
    if (logoLayer) doc = doc.replace(/<\/svg>\s*$/,() => `<image x="${logoLayer.left}" y="${logoLayer.top}" width="${Math.round(W * 0.34)}" href="data:image/png;base64,${logoLayer.input.toString('base64')}"/></svg>`);
    return { buf: Buffer.from(doc, 'utf8'), mime: 'image/svg+xml', ext: 'svg', w: W, h: H };
  }
  const out = base.composite(layers);
  if (fmt === 'pdf') return { buf: jpegToPdf(await out.flatten({ background: '#ffffff' }).jpeg({ quality: 92 }).toBuffer(), W, H), mime: 'application/pdf', ext: 'pdf', w: W, h: H };
  const buf = fmt === 'jpg' ? await out.jpeg({ quality: 90 }).toBuffer() : fmt === 'webp' ? await out.webp({ quality: 90 }).toBuffer() : await out.png().toBuffer();
  return { buf, mime: fmt === 'jpg' ? 'image/jpeg' : `image/${fmt}`, ext: fmt, w: W, h: H };
};

export const saveRender = async (o, user) => {
  if (o.out === 'svg') throw new HttpError(400, 'SVG medya kitaplığına kaydedilmez (güvenlik); "SVG" düğmesiyle indirin');
  const r = await renderBrand(o);
  const name = `sosyal-${String(o.template ?? 'sablon').replace(/[^a-z0-9-]/g, '')}-${Date.now().toString(36)}.${r.ext}`;
  const rec = await uploadMedia(r.buf, name, user);
  audit(user, 'marka.sablon_kaydet', name);
  return rec;
};

/** Yapay Zekâ ile üretilmiş görseli medya kitaplığına kaydeder; başlıkta "Yapay Zekâ görseli" etiketi (şeffaflık) */
export const saveAiImage = async ({ data, title, alt }, user) => {
  const buf = Buffer.from(String(data ?? ''), 'base64');
  if (buf.length < 100 || buf.length > 14 * 1024 * 1024) throw new HttpError(400, 'Geçersiz görsel verisi');
  const rec = await uploadMedia(buf, `ai-gorsel-${Date.now().toString(36)}.png`, user);
  const t = `Yapay Zekâ görseli: ${String(title ?? '').trim().slice(0, 80) || 'Marka görseli'}`;
  updateMedia(rec.id, { title: t, alt: String(alt ?? '').trim().slice(0, 200) || 'Yapay zekâ ile üretilmiş görsel' }, user);
  audit(user, 'marka.ai_gorsel_kaydet', rec.filename);
  return getMedia(rec.id);
};
