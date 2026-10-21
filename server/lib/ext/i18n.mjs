// İngilizce site (/en): yayınlanan Türkçe sayfalar çeviri hafızası (TM) ile İngilizceye dönüştürülür.
// Yöntem: derlenmiş HTML okunur → metin blokları (satır içi etiketler yer tutucuya çevrilerek) çıkarılır → TM'de olanlar uygulanır,
// olmayanlar Yapay Zekâ ile (arka planda) çevrilip TM'ye yazılır → yalnızca TÜM metni çevrilmiş sayfalar /en altında yayınlanır.
// TR sayfalar yalnızca dil anahtarı + hreflang bağlantıları kadar değişir. Elle düzenlenen çeviriler asla ezilmez.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { parse, serialize } from 'parse5';
import { q, getSetting, setSetting, audit } from '../db.mjs';
import { config } from '../config.mjs';
import { HttpError } from '../http.mjs';
import { rawChat, providerStatus } from './ai.mjs';
import './schema.mjs';

/* ------------------------------ ayarlar ------------------------------ */
export const getMode = () => (getSetting('i18n.mode', 'kapali') === 'otomatik' ? 'otomatik' : 'kapali');
const DEFAULT_GLOSSARY = { keep: ['AKORT', 'AKORT Mühendislik', 'BIM', 'MEP', 'HVAC', 'IFC', 'ISO 19650', 'CDE', 'EIR', 'BEP', 'LOD', 'LEED', 'BREEAM', 'KVKK'], map: {} };
export const getGlossary = () => {
  try { const g = JSON.parse(getSetting('i18n.glossary', 'null')); if (g && Array.isArray(g.keep)) return { keep: g.keep, map: g.map ?? {} }; } catch { /* varsayılan */ }
  return structuredClone(DEFAULT_GLOSSARY);
};
export const setGlossary = (g, user) => {
  const keep = (Array.isArray(g.keep) ? g.keep : []).map((x) => String(x).trim()).filter(Boolean).slice(0, 200);
  const map = {};
  for (const [k, v] of Object.entries(g.map ?? {})) if (String(k).trim() && String(v).trim()) map[String(k).trim().slice(0, 120)] = String(v).trim().slice(0, 160);
  setSetting('i18n.glossary', JSON.stringify({ keep, map }));
  audit(user, 'i18n.sozluk', `${keep.length} korunan, ${Object.keys(map).length} eşleme`);
};
const siteOrigin = () => config.siteUrl.replace(/\/$/, '');

/* ------------------------------ İngilizce adres (slug) eşlemesi ------------------------------ */
const DEFAULT_SLUGS = {
  hizmetler: 'services', hakkimizda: 'about', iletisim: 'contact', projeler: 'projects', 'uzmanlik-alanlari': 'expertise',
  'calisma-modeli': 'work-model', 'gizlilik-politikasi': 'privacy-policy', 'cerez-tercihleri': 'cookie-preferences', arama: 'search',
};
const RESERVED_SEG = new Set(['en', 'api', 'yonetim', '_astro', 'medya', 'documents', 'bim-samples', 'favicon']);
export const getSlugs = () => {
  let custom = {};
  try { const c = JSON.parse(getSetting('i18n.slugs', '{}')); if (c && typeof c === 'object') custom = c; } catch { /* varsayılan */ }
  return { ...DEFAULT_SLUGS, ...custom };
};
/** m: { trSlug: enSlug } — yalnızca varsayılandan FARKLI/ek eşlemeler saklanır; boş değer = varsayılana dön */
export const setSlugs = (m, user) => {
  const out = {}, seen = new Map();
  for (const [k, v] of Object.entries(m ?? {})) {
    const tr = String(k).trim().toLowerCase(), en = String(v ?? '').trim().toLowerCase();
    if (!en || en === tr) { if (DEFAULT_SLUGS[tr]) out[tr] = tr; continue; }
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(tr) || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(en)) throw Object.assign(new Error(`Adresler yalnızca küçük harf, rakam ve tire içerebilir: ${tr} → ${en}`), { status: 400 });
    if (RESERVED_SEG.has(en)) throw Object.assign(new Error(`"${en}" ayrılmış bir adrestir`), { status: 400 });
    if (seen.has(en)) throw Object.assign(new Error(`"${en}" iki farklı adres için kullanılamaz (${seen.get(en)}, ${tr})`), { status: 400 });
    seen.set(en, tr); out[tr] = en;
  }
  // adresi değişen sayfaların ESKİ İngilizce adresini sakla → 301 yönlendirmesi için
  const before = getSlugs(), after = { ...DEFAULT_SLUGS, ...out }, prev = getPrevSlugs();
  for (const tr of new Set([...Object.keys(before), ...Object.keys(after)])) {
    const was = before[tr] ?? tr, now = after[tr] ?? tr;
    if (was !== now) prev[was] = tr;
  }
  const current = new Set(Object.values(after));
  for (const k of Object.keys(prev)) if (current.has(k)) delete prev[k];
  setSetting('i18n.slugs.prev', JSON.stringify(prev));
  setSetting('i18n.slugs', JSON.stringify(out));
  audit(user, 'i18n.slug', `${Object.keys(out).length} adres eşlemesi`);
};
const getPrevSlugs = () => { try { const p = JSON.parse(getSetting('i18n.slugs.prev', '{}')); return p && typeof p === 'object' ? p : {}; } catch { return {}; } };
/** Eski/Türkçe biçimli bir /en/... adresi için güncel adresi verir (yoksa null) — 301 için */
export const legacyEnRedirect = (pathname) => {
  if (!pathname.startsWith('/en/')) return null;
  const m = getSlugs(), prev = getPrevSlugs(), current = new Set(Object.values(m));
  const segs = pathname.split('/').slice(2).map((x) => (current.has(x) ? x : prev[x] ? (m[prev[x]] ?? prev[x]) : (m[x] ?? x)));
  const out = '/en/' + segs.join('/');
  return out === pathname ? null : out;
};
const segMap = () => { const m = getSlugs(); return (seg) => m[seg] ?? seg; };
/** '/hizmetler/bim' → '/en/services/bim'; '/' → '/en' */
export const enPath = (p, map = segMap()) => (p === '/' ? '/en' : `/en/${p.replace(/^\//, '').split('/').map((x) => map(x)).join('/')}`);
/** dosya yolu (hizmetler/bim.html) → EN dosya yolu (en/services/bim.html) */
const enRelOf = (rel, map = segMap()) => path.posix.join('en', ...rel.split('/').map((x, i, a) => (i === a.length - 1 ? (x.endsWith('.html') ? `${map(x.slice(0, -5))}.html` : map(x)) : map(x))));

/* ------------------------------ HTML ağacı yardımcıları ------------------------------ */
const SKIP = new Set(['script', 'style', 'noscript', 'svg', 'math', 'code', 'pre', 'kbd', 'samp', 'textarea', 'iframe', 'template', 'object', 'embed', 'canvas', 'video', 'audio']);
const INLINE = new Set(['a', 'abbr', 'b', 'bdi', 'bdo', 'cite', 'data', 'dfn', 'em', 'i', 'mark', 'q', 's', 'small', 'span', 'strong', 'sub', 'sup', 'time', 'u', 'var', 'font']);
const OPAQUE = new Set(['img', 'picture', 'input', 'br', 'wbr', 'source', 'hr', ...SKIP]);
const ATTRS = ['alt', 'title', 'aria-label', 'placeholder'];
const META_TEXT = new Set(['description', 'og:title', 'og:description', 'twitter:title', 'twitter:description', 'og:image:alt', 'twitter:image:alt']);
const JSONLD_KEYS = new Set(['name', 'description', 'headline', 'text', 'alternateName', 'articleBody', 'abstract', 'caption', 'jobTitle', 'slogan', 'serviceType', 'keywords', 'about']);

const isEl = (n) => !!n.tagName;
const hasBlockDesc = (el) => (el.childNodes ?? []).some((c) => isEl(c) && !(INLINE.has(c.tagName) && !hasBlockDesc(c)) && !OPAQUE.has(c.tagName));
const isInline = (el) => INLINE.has(el.tagName) && !hasBlockDesc(el);
const attrOf = (el, n) => el.attrs?.find((a) => a.name === n)?.value;
const setAttr = (el, n, v) => { const a = el.attrs.find((x) => x.name === n); if (a) a.value = v; else el.attrs.push({ name: n, value: v }); };
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const unesc = (s) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
const collapse = (s) => s.replace(/\s+/g, ' ').trim();
const hasLetters = (s) => /\p{L}/u.test(s.replace(/<\/?\d+\/?>/g, ''));
export const hashOf = (key) => crypto.createHash('sha1').update(key).digest('hex').slice(0, 24);

const textNode = (value, parent) => ({ nodeName: '#text', value, parentNode: parent });

/** Ağaçtaki çevrilecek öğeleri toplar: run (metin bloğu), attr, json-ld, meta */
const collect = (doc) => {
  const items = [];
  const makeRun = (parent, run) => {
    const tokens = [];
    const ser = (nodes) => {
      let s = '';
      for (const n of nodes) {
        if (n.nodeName === '#text') s += esc(n.value);
        else if (n.nodeName === '#comment' || (isEl(n) && OPAQUE.has(n.tagName))) { tokens.push(n); s += `<${tokens.length}/>`; }
        else if (isEl(n)) { tokens.push(n); const id = tokens.length; s += `<${id}>${ser(n.childNodes)}</${id}>`; }
      }
      return s;
    };
    const src = ser(run);
    const key = collapse(src);
    if (!hasLetters(key)) return;
    items.push({ kind: 'run', parent, nodes: run, tokens, key, lead: /^\s*/.exec(src)[0], trail: /\s*$/.exec(src)[0] });
  };
  const children = (parent) => {
    let run = [];
    const flush = () => { if (run.length) makeRun(parent, run); run = []; };
    for (const n of [...(parent.childNodes ?? [])]) {
      if (n.nodeName === '#text' || n.nodeName === '#comment') run.push(n);
      else if (isEl(n)) {
        if (OPAQUE.has(n.tagName) || isInline(n)) run.push(n);
        else { flush(); element(n); }
      }
    }
    flush();
  };
  const element = (el) => {
    if (SKIP.has(el.tagName)) return;
    if (attrOf(el, 'translate') === 'no' || /\bnotranslate\b/.test(attrOf(el, 'class') ?? '')) return;
    children(el);
  };
  const html = doc.childNodes.find((n) => n.tagName === 'html');
  const head = html?.childNodes.find((n) => n.tagName === 'head');
  const body = html?.childNodes.find((n) => n.tagName === 'body');
  for (const n of head?.childNodes ?? []) if (n.tagName === 'title') children(n);
  if (body) element(body);

  // öznitelikler + meta + json-ld (tüm ağaç)
  const walk = (n) => {
    if (!isEl(n)) { for (const c of n.childNodes ?? []) walk(c); return; }
    if (n.tagName === 'svg' || n.tagName === 'style') return;
    if (n.tagName === 'script') {
      if ((attrOf(n, 'type') ?? '') === 'application/ld+json' && n.childNodes[0]) items.push({ kind: 'jsonld', node: n.childNodes[0], strings: [] });
      return;
    }
    if (attrOf(n, 'translate') === 'no') return;
    if (n.tagName === 'meta') {
      const k = attrOf(n, 'name') ?? attrOf(n, 'property');
      const v = attrOf(n, 'content');
      if (k && META_TEXT.has(k) && v && hasLetters(v)) items.push({ kind: 'attr', el: n, name: 'content', key: collapse(v) });
    } else {
      for (const a of ATTRS) { const v = attrOf(n, a); if (v && hasLetters(v) && !/^https?:|^\//.test(v.trim())) items.push({ kind: 'attr', el: n, name: a, key: collapse(v) }); }
      const dm = attrOf(n, 'data-messages');
      if (dm) {
        try {
          const obj = JSON.parse(dm);
          const strings = Object.values(obj).filter((s) => typeof s === 'string' && hasLetters(s)).map(collapse);
          if (strings.length) items.push({ kind: 'attrjson', el: n, obj, strings });
        } catch { /* geçersiz JSON */ }
      }
      if (n.tagName === 'input' && ['submit', 'button'].includes(attrOf(n, 'type'))) { const v = attrOf(n, 'value'); if (v && hasLetters(v)) items.push({ kind: 'attr', el: n, name: 'value', key: collapse(v) }); }
    }
    for (const c of n.childNodes ?? []) walk(c);
  };
  walk(doc);
  // json-ld: çevrilecek dizeleri çıkar
  for (const it of items.filter((x) => x.kind === 'jsonld')) {
    try {
      it.data = JSON.parse(it.node.value);
      const visit = (v, key) => {
        if (typeof v === 'string') { if (JSONLD_KEYS.has(key) && hasLetters(v)) it.strings.push(collapse(v)); }
        else if (Array.isArray(v)) v.forEach((x) => visit(x, key));
        else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) visit(x, k);
      };
      visit(it.data, '');
    } catch { it.data = null; }
  }
  return items;
};

/** Bir öğenin gereksinim duyduğu tüm kaynak dizeleri */
const keysOf = (items) => {
  const out = [];
  for (const it of items) {
    if (it.kind === 'jsonld' || it.kind === 'attrjson') for (const s of it.strings) out.push(s);
    else out.push(it.key);
  }
  return out;
};

/* ------------------------------ URL yeniden yazma ------------------------------ */
const NO_REWRITE = /^\/(api|yonetim|_astro|medya|favicon|documents|bim-samples|bim\/|en(\/|$))/;
export const toEnUrl = (u) => {
  if (!u) return u;
  const origin = siteOrigin();
  let rest = u;
  let abs = '';
  if (u.startsWith(origin)) { abs = origin; rest = u.slice(origin.length) || '/'; }
  else if (/^[a-z][a-z0-9+.-]*:|^\/\/|^#|^\?/i.test(u)) return u;
  if (!rest.startsWith('/')) return u;
  const [p, ...tail] = rest.split(/(?=[?#])/);
  if (NO_REWRITE.test(p) || /\.[a-z0-9]{2,5}$/i.test(p.replace(/\.html$/, '')) && !p.endsWith('.html')) return u;
  const en = enPath(p.replace(/\/$/, '') || '/');
  return abs + en + tail.join('');
};
const rewriteJsonUrls = (v) => {
  if (Array.isArray(v)) return v.map(rewriteJsonUrls);
  if (v && typeof v === 'object') { const o = {}; for (const [k, x] of Object.entries(v)) o[k] = ['url', '@id', 'item', 'target'].includes(k) && typeof x === 'string' ? toEnUrl(x) : rewriteJsonUrls(x); return o; }
  return v;
};

/* ------------------------------ çeviri hafızası ------------------------------ */
const loadTm = () => {
  const m = new Map();
  for (const r of q.all("SELECT hash, en, status FROM i18n_tm WHERE status != 'hata' AND en != ''")) m.set(r.hash, r.en);
  return m;
};
const tagSig = (s) => (s.match(/<\/?\d+\/?>/g) ?? []).sort().join('');
export const validTranslation = (src, en) => typeof en === 'string' && en.trim().length > 0 && tagSig(src) === tagSig(en);

/** TM'den dize al (token sağlam değilse null) */
const lookup = (tm, key) => { const en = tm.get(hashOf(key)); return en && validTranslation(key, en) ? en : null; };

/* ------------------------------ uygulama ------------------------------ */
const buildNodes = (str, tokens) => {
  const root = { childNodes: [] };
  const stack = [root];
  const re = /<(\/)?(\d+)(\/)?>/g;
  let last = 0, m;
  const push = (n) => { const top = stack.at(-1); n.parentNode = top.el ?? null; top.childNodes.push(n); };
  while ((m = re.exec(str))) {
    const txt = str.slice(last, m.index);
    if (txt) push(textNode(unesc(txt)));
    last = re.lastIndex;
    const tok = tokens[Number(m[2]) - 1];
    if (!tok) throw new Error('bilinmeyen etiket');
    if (m[3]) push(tok);
    else if (m[1]) { if (stack.length < 2 || stack.at(-1).id !== Number(m[2])) throw new Error('etiket sırası'); stack.pop(); }
    else { const el = { nodeName: tok.nodeName, tagName: tok.tagName, attrs: tok.attrs.map((a) => ({ ...a })), namespaceURI: tok.namespaceURI, childNodes: [] }; push(el); stack.push({ el, id: Number(m[2]), childNodes: el.childNodes }); }
  }
  const tail = str.slice(last);
  if (tail) push(textNode(unesc(tail)));
  if (stack.length !== 1) throw new Error('kapanmamış etiket');
  return root.childNodes;
};

const applyItems = (items, tm) => {
  for (const it of items) {
    if (it.kind === 'run') {
      const en = lookup(tm, it.key);
      if (!en) continue;
      const nodes = buildNodes(en, it.tokens);
      if (it.lead) nodes.unshift(textNode(it.lead));
      if (it.trail) nodes.push(textNode(it.trail));
      const parent = it.parent;
      const idx = parent.childNodes.indexOf(it.nodes[0]);
      if (idx < 0) continue;
      parent.childNodes.splice(idx, it.nodes.length, ...nodes);
      for (const n of nodes) n.parentNode = parent;
    } else if (it.kind === 'attr') {
      const en = lookup(tm, it.key);
      if (en) setAttr(it.el, it.name, en);
    } else if (it.kind === 'attrjson') {
      const o = {};
      for (const [k, v] of Object.entries(it.obj)) o[k] = typeof v === 'string' && hasLetters(v) ? (lookup(tm, collapse(v)) ?? v) : v;
      setAttr(it.el, 'data-messages', JSON.stringify(o));
    } else if (it.kind === 'jsonld' && it.data) {
      const walkSet = (v, key) => {
        if (typeof v === 'string') return JSONLD_KEYS.has(key) && hasLetters(v) ? (lookup(tm, collapse(v)) ?? v) : v;
        if (Array.isArray(v)) return v.map((x) => walkSet(x, key));
        if (v && typeof v === 'object') { const o = {}; for (const [k, x] of Object.entries(v)) o[k] = walkSet(x, k); return o; }
        return v;
      };
      it.node.value = JSON.stringify(rewriteJsonUrls(walkSet(it.data, '')));
    }
  }
};

const rewriteLinks = (n) => {
  if (isEl(n)) {
    if (n.tagName === 'a' || n.tagName === 'link' || n.tagName === 'area') { const h = attrOf(n, 'href'); if (h && !(n.tagName === 'link' && /icon|manifest|stylesheet|preload|modulepreload|preconnect|dns-prefetch|apple-touch/.test(attrOf(n, 'rel') ?? ''))) setAttr(n, 'href', toEnUrl(h)); }
    if (n.tagName === 'meta' && (attrOf(n, 'property') === 'og:url')) setAttr(n, 'content', toEnUrl(attrOf(n, 'content')));
    if (n.tagName === 'form') { const a = attrOf(n, 'action'); if (a) setAttr(n, 'action', toEnUrl(a)); }
  }
  for (const c of n.childNodes ?? []) rewriteLinks(c);
};

const pageUrlOf = (rel) => { const p = '/' + rel.replace(/\\/g, '/').replace(/\.html$/, '').replace(/(^|\/)index$/, ''); return p === '/' ? '/' : p.replace(/\/$/, ''); };

const LANG_SW = (to, label, aria, lang) => {
  // lang = HEDEF dil. Hedef EN ise sayfa TR'dir: [TR (geçerli)] [EN bağlantı]; hedef TR ise: [TR bağlantı] [EN (geçerli)]
  const opt = `<a href="${to}" hreflang="${lang}" lang="${lang}" class="lang-opt" aria-label="${aria}">${label}</a>`;
  const cur = (l) => `<span class="lang-cur" lang="${l}" aria-current="true">${l.toUpperCase()}</span>`;
  return `<span data-lang-switch class="lang-slot">${lang === 'en' ? cur('tr') + opt : opt + cur('en')}</span>`;
};
const SW_RE = /<span\b[^>]*data-lang-switch[^>]*>(?:<span\b[^>]*>[^<]*<\/span>|<a\b[^>]*>[^<]*<\/a>)*<\/span>/g;
const EMPTY_SW = '<span data-lang-switch hidden></span>';
const ALT_RE = /<link\b[^>]*rel=["']?alternate["']?[^>]*hreflang=[^>]*>/gi;

/** Önceki üretimden kalan dil anahtarı/hreflang izlerini temizler (idempotent) */
const clean = (html) => html.replace(ALT_RE, '').replace(SW_RE, () => EMPTY_SW);

const decorateTr = (html, url, hasEn) => {
  let out = html.replace(ALT_RE, '');
  if (hasEn) {
    const o = siteOrigin();
    const tr = o + (url === '/' ? '/' : url), en = o + enPath(url);
    out = out.replace(SW_RE, () => LANG_SW(enPath(url), 'EN', 'View this page in English', 'en'));
    out = out.replace('</head>', () => `<link rel="alternate" hreflang="tr" href="${tr}"><link rel="alternate" hreflang="en" href="${en}"><link rel="alternate" hreflang="x-default" href="${tr}"></head>`);
  } else out = out.replace(SW_RE, () => EMPTY_SW);
  return out;
};

const atomicWrite = (file, data) => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp-${process.pid}`;
  fs.writeFileSync(tmp, data);
  fs.renameSync(tmp, file);
};
const SKIP_ROOT_DIRS = new Set(['en', '_astro', 'bim-samples', 'bim', 'documents', 'favicon']);
const walkHtml = (dir, rel = '', out = []) => {
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) { if (!rel && SKIP_ROOT_DIRS.has(e.name)) continue; walkHtml(path.join(dir, e.name), path.posix.join(rel, e.name), out); }
    else if (e.name.endsWith('.html')) out.push(path.posix.join(rel, e.name));
  }
  return out;
};

/* ------------------------------ üretim ------------------------------ */
let writing = Promise.resolve();
export const idle = () => writing;
const mapReport = new Map();

export const removeEnglish = (distDir) => {
  fs.rmSync(path.join(distDir, 'en'), { recursive: true, force: true });
  for (const rel of walkHtml(distDir)) {
    const f = path.join(distDir, rel);
    const html = fs.readFileSync(f, 'utf8');
    const out = html.replace(ALT_RE, '').replace(SW_RE, () => EMPTY_SW);
    if (out !== html) atomicWrite(f, out);
  }
  const bak = path.join(distDir, 'sitemap-0.tr.xml');
  if (fs.existsSync(bak)) { fs.copyFileSync(bak, path.join(distDir, 'sitemap-0.xml')); fs.rmSync(bak, { force: true }); }
};

/** Arama indeksi (EN) */
const buildEnIndex = (distDir, tm) => {
  const f = path.join(distDir, 'arama-index.json');
  if (!fs.existsSync(f)) return { keys: [], docs: null };
  let docs;
  try { docs = JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return { keys: [], docs: null }; }
  const keys = [];
  for (const d of docs) for (const k of ['title', 'text', 'type']) if (d[k] && hasLetters(String(d[k]))) keys.push(collapse(String(d[k])));
  return { keys, docs, build: () => docs.map((d) => ({ ...d, title: lookup(tm, collapse(d.title ?? '')) ?? d.title, text: d.text ? (lookup(tm, collapse(d.text)) ?? d.text) : d.text, type: d.type ? (lookup(tm, collapse(d.type)) ?? d.type) : d.type, url: toEnUrl(d.url) })) };
};

/**
 * distDir içindeki TR sayfalardan /en çıktısını üretir. Tam çevrilmemiş sayfalar atlanır (fallbackDir'de varsa eski EN kopyası taşınır).
 * @returns rapor { pages:[{url,total,missing,published}], missingKeys:Set }
 */
export const generate = async (distDir, { fallbackDir = null, log = () => {} } = {}) => {
  const run = async () => {
    if (getMode() === 'kapali') { removeEnglish(distDir); return { pages: [], missing: [], published: 0, mode: 'kapali' }; }
    const tm = loadTm();
    const files = walkHtml(distDir);
    const pages = [];
    const missing = new Set();
    const enRoot = path.join(distDir, 'en');
    const keepEn = new Set();
    // 1) çıkarım ve eksik tespiti
    const plan = [];
    for (const rel of files) {
      const raw = fs.readFileSync(path.join(distDir, rel), 'utf8');
      const html = clean(raw);
      const doc = parse(html);
      const items = collect(doc);
      const keys = keysOf(items);
      const miss = keys.filter((k) => !lookup(tm, k));
      for (const k of miss) missing.add(k);
      plan.push({ rel, raw, html, total: keys.length, miss: miss.length });
    }
    const idx = buildEnIndex(distDir, tm);
    for (const k of idx.keys) if (!lookup(tm, k)) missing.add(k);
    // 2) yazım
    let published = 0;
    for (const p of plan) {
      const url = pageUrlOf(p.rel);
      const enRel = enRelOf(p.rel);
      let hasEn = false;
      if (p.miss === 0) {
        const doc = parse(p.html);
        const items = collect(doc);
        applyItems(items, tm);
        rewriteLinks(doc);
        const htmlEl = doc.childNodes.find((n) => n.tagName === 'html');
        if (htmlEl) setAttr(htmlEl, 'lang', 'en');
        let out = serialize(doc);
        const o = siteOrigin();
        const trUrl = o + (url === '/' ? '/' : url), enUrl = o + enPath(url);
        out = out.replace(ALT_RE, '').replace(SW_RE, () => LANG_SW(url === '/' ? '/' : url, 'TR', 'Bu sayfayı Türkçe görüntüle', 'tr'));
        out = out.replace('</head>', () => `<link rel="alternate" hreflang="tr" href="${trUrl}"><link rel="alternate" hreflang="en" href="${enUrl}"><link rel="alternate" hreflang="x-default" href="${trUrl}"></head>`);
        atomicWrite(path.join(distDir, enRel), out);
        keepEn.add(enRel);
        hasEn = true;
        published++;
      } else if (fallbackDir && fs.existsSync(path.join(fallbackDir, enRel))) {
        fs.mkdirSync(path.dirname(path.join(distDir, enRel)), { recursive: true });
        fs.copyFileSync(path.join(fallbackDir, enRel), path.join(distDir, enRel));
        keepEn.add(enRel);
        hasEn = true;
      } else {
        fs.rmSync(path.join(distDir, enRel), { force: true });
      }
      // TR sayfa: dil anahtarı + hreflang (dize düzeyinde, diğer baytlar korunur)
      const trFile = path.join(distDir, p.rel);
      const trOut = decorateTr(p.html, url, hasEn);
      if (trOut !== p.raw) atomicWrite(trFile, trOut);
      pages.push({ url, total: p.total, missing: p.miss, published: hasEn && p.miss === 0, stale: hasEn && p.miss > 0 });
    }
    // arama indeksi
    if (idx.docs && idx.keys.every((k) => lookup(tm, k))) atomicWrite(path.join(enRoot, 'arama-index.json'), JSON.stringify(idx.build()));
    // sitemap
    const smPath = path.join(distDir, 'sitemap-0.xml');
    const bak = path.join(distDir, 'sitemap-0.tr.xml');
    if (fs.existsSync(smPath)) {
      if (!fs.existsSync(bak)) fs.copyFileSync(smPath, bak);
      const src = fs.readFileSync(bak, 'utf8');
      const o = siteOrigin();
      const have = new Set(pages.filter((p) => p.published || p.stale).map((p) => p.url));
      const entries = [...src.matchAll(/<url>([\s\S]*?)<\/url>/g)].map((m) => ({ loc: /<loc>([^<]+)<\/loc>/.exec(m[1])?.[1], raw: m[0] })).filter((e) => e.loc);
      const body = entries.map((e) => {
        const pth = new URL(e.loc).pathname.replace(/\/$/, '') || '/';
        if (!have.has(pth)) return e.raw;
        const enLoc = o + enPath(pth);
        const alt = `<xhtml:link rel="alternate" hreflang="tr" href="${e.loc}"/><xhtml:link rel="alternate" hreflang="en" href="${enLoc}"/>`;
        return `<url><loc>${e.loc}</loc>${alt}</url><url><loc>${enLoc}</loc>${alt}</url>`;
      }).join('');
      let head = /^[\s\S]*?<urlset[^>]*>/.exec(src)[0];
      if (!head.includes('xmlns:xhtml')) head = head.replace('<urlset', '<urlset xmlns:xhtml="http://www.w3.org/1999/xhtml"');
      atomicWrite(smPath, `${head}${body}</urlset>`);
    }
    // artık TR karşılığı olmayan / geçersiz EN dosyalarını temizle
    const stale = walkHtmlAll(enRoot).filter((r) => !keepEn.has(path.posix.join('en', r)));
    for (const r of stale) fs.rmSync(path.join(enRoot, r), { force: true });
    const report = { at: new Date().toISOString(), published, total: pages.length, pages, missingCount: missing.size };
    mapReport.set('last', report);
    setSetting('i18n.last', JSON.stringify({ at: report.at, published, total: pages.length, missingCount: missing.size, pages: pages.map((p) => [p.url, p.total, p.missing, p.published ? 1 : p.stale ? 2 : 0]) }));
    log(`[i18n] ${published}/${pages.length} sayfa İngilizce yayınlandı, ${missing.size} çevrilmemiş metin\n`);
    return { ...report, missing: [...missing], mode: 'otomatik' };
  };
  const next = writing.then(run, run);
  writing = next.catch(() => {});
  return next;
};
const walkHtmlAll = (dir, rel = '', out = []) => {
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) walkHtmlAll(path.join(dir, e.name), path.posix.join(rel, e.name), out);
    else if (e.name.endsWith('.html')) out.push(path.posix.join(rel, e.name));
  }
  return out;
};

/** Yalnızca tarama: eksik dizeleri (benzersiz) döndürür */
export const scanMissing = (distDir) => {
  const tm = loadTm();
  const missing = new Map();
  for (const rel of walkHtml(distDir)) {
    const items = collect(parse(clean(fs.readFileSync(path.join(distDir, rel), 'utf8'))));
    for (const k of keysOf(items)) if (!lookup(tm, k)) missing.set(hashOf(k), k);
  }
  const idx = buildEnIndex(distDir, tm);
  for (const k of idx.keys) if (!lookup(tm, k)) missing.set(hashOf(k), k);
  return missing;
};

/* ------------------------------ AI çevirisi ------------------------------ */
const pickProvider = () => {
  const want = getSetting('i18n.provider', '');
  const list = providerStatus().filter((p) => p.connected);
  return list.find((p) => p.id === want)?.id ?? list[0]?.id ?? null;
};

const systemPrompt = () => {
  const g = getGlossary();
  return `You are a professional Turkish→English translator for the corporate website of AKORT Mühendislik, an engineering consultancy (MEP, BIM, energy efficiency, cost estimation, software).
Rules:
- Translate faithfully into natural, concise, professional business English. Never add claims, numbers, names or promises that are not in the source; never remove information.
- The source strings may contain numbered tags such as <1>, </1> and <2/> . Keep EVERY tag exactly as is (same ids, same count, properly nested) and move them to the natural position in the English sentence. Never translate or alter tag ids.
- Keep these terms unchanged: ${g.keep.join(', ') || '(none)'}.
${Object.keys(g.map).length ? `- Use these fixed translations: ${Object.entries(g.map).map(([k, v]) => `"${k}" → "${v}"`).join('; ')}.` : ''}
- Preserve numbers, units, standards (ISO, EN, TS), URLs and e-mail addresses as they are.
- Output ONLY a valid JSON array of strings, with exactly the same length and order as the input array. No commentary, no code fences.`;
};

let job = { running: false, phase: '', total: 0, done: 0, failed: 0, error: '', startedAt: null, finishedAt: null };
export const jobState = () => ({ ...job });

const FAKE = process.env.I18N_FAKE === '1' && process.env.NODE_ENV !== 'production';
const fakeTranslate = (s) => s.replace(/([^<>]+)(?=<|$)/g, (m) => (/\p{L}/u.test(m) ? `[EN] ${m}` : m));

const parseJsonArray = (txt) => {
  let t = String(txt).trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
  const a = t.indexOf('['), b = t.lastIndexOf(']');
  if (a >= 0 && b > a) t = t.slice(a, b + 1);
  const v = JSON.parse(t);
  if (!Array.isArray(v)) throw new Error('dizi değil');
  return v;
};

const saveRow = (key, en, status, extra = {}) => {
  q.run(`INSERT INTO i18n_tm (hash, src, en, status, provider, model, attempts, error, updated_by) VALUES (?,?,?,?,?,?,?,?,?)
         ON CONFLICT(hash) DO UPDATE SET en = excluded.en, status = excluded.status, provider = excluded.provider, model = excluded.model, attempts = excluded.attempts, error = excluded.error, updated_at = datetime('now')
         WHERE i18n_tm.status NOT IN ('elle','onayli')`, hashOf(key), key, en, status, extra.provider ?? null, extra.model ?? null, extra.attempts ?? 0, extra.error ?? null, 'sistem');
};

const translateBatch = async (provider, keys) => {
  if (FAKE) return keys.map(fakeTranslate);
  const prompt = JSON.stringify(keys);
  const chars = keys.reduce((a, k) => a + k.length, 0);
  const r = await rawChat({ provider, system: systemPrompt(), prompt, max: Math.min(8000, Math.max(800, Math.round(chars / 2) + 600)), task: 'ceviri' }, { email: 'sistem' });
  const arr = parseJsonArray(r.text);
  if (arr.length !== keys.length) throw new Error(`beklenen ${keys.length}, gelen ${arr.length} öğe`);
  return arr.map(String);
};

/** Eksik dizeleri çevirir (toplu, 2 paralel). İlerleme jobState() ile izlenir. */
export const translateMissing = async (missing, { provider } = {}) => {
  const list = [...missing.values()];
  const prov = FAKE ? 'fake' : (provider ?? pickProvider());
  if (!prov && list.length) throw new HttpError(409, 'İngilizce çeviri için bir Yapay Zekâ sağlayıcısı bağlı değil (Entegrasyonlar sayfasından anahtar ekleyin).');
  job.total += list.length;
  const batches = [];
  let cur = [], size = 0;
  for (const k of list) { if (cur.length >= 25 || size + k.length > 5000) { batches.push(cur); cur = []; size = 0; } cur.push(k); size += k.length; }
  if (cur.length) batches.push(cur);
  let bi = 0;
  const worker = async () => {
    while (bi < batches.length) {
      const batch = batches[bi++];
      try {
        const out = await translateBatch(prov, batch);
        const retry = [];
        batch.forEach((k, i) => { if (validTranslation(k, out[i])) { saveRow(k, out[i].trim(), 'otomatik', { provider: prov }); job.done++; } else retry.push(k); });
        for (const k of retry) {
          try {
            const [one] = await translateBatch(prov, [k]);
            if (validTranslation(k, one)) { saveRow(k, one.trim(), 'otomatik', { provider: prov }); job.done++; } else throw new Error('etiketler korunmadı');
          } catch (e) {
            const att = (q.get('SELECT attempts FROM i18n_tm WHERE hash = ?', hashOf(k))?.attempts ?? 0) + 1;
            saveRow(k, '', att >= 3 ? 'hata' : 'otomatik', { attempts: att, error: String(e.message).slice(0, 200) });
            if (att >= 3) job.failed++;
          }
        }
      } catch (e) {
        job.error = e.message;
        if (/bağlantı gerekli|bütçe|devre dışı|401/i.test(e.message)) { bi = batches.length; throw e; }
        for (const k of batch) job.failed++, void k;
      }
    }
  };
  await Promise.all([worker(), worker()]);
};

let pendingGen = null;
/** Arka plan: tarama → çeviri → canlı dist'e üretim. Aynı anda tek iş. */
export const startBackground = (distDir = config.siteDir, { provider } = {}) => {
  if (getMode() === 'kapali') return { started: false, reason: 'kapalı' };
  if (job.running) return { started: false, reason: 'sürüyor' };
  job = { running: true, phase: 'tarama', total: 0, done: 0, failed: 0, error: '', startedAt: new Date().toISOString(), finishedAt: null };
  (async () => {
    try {
      const missing = scanMissing(distDir);
      job.phase = missing.size ? 'çeviri' : 'üretim';
      if (missing.size) await translateMissing(missing, { provider });
      job.phase = 'üretim';
      await generate(config.siteDir);
    } catch (e) { job.error = e.message; } finally { job.running = false; job.phase = ''; job.finishedAt = new Date().toISOString(); }
  })();
  return { started: true };
};

/** TM düzenlemesinden sonra gecikmeli (offline) yeniden üretim */
export const scheduleGenerate = () => {
  clearTimeout(pendingGen);
  pendingGen = setTimeout(() => { generate(config.siteDir).catch(() => {}); }, 1500);
  pendingGen.unref?.();
};

/* ------------------------------ panel verileri ------------------------------ */
export const stats = () => {
  const by = Object.fromEntries(q.all('SELECT status, COUNT(*) AS n FROM i18n_tm GROUP BY status').map((r) => [r.status, r.n]));
  let last = null;
  try { last = JSON.parse(getSetting('i18n.last', 'null')); } catch { /* */ }
  return { tm: { otomatik: by.otomatik ?? 0, onayli: by.onayli ?? 0, elle: by.elle ?? 0, hata: by.hata ?? 0, toplam: Object.values(by).reduce((a, b) => a + b, 0) }, last };
};
export const estimate = () => {
  const dist = config.siteDir;
  if (!fs.existsSync(dist)) return { segments: 0, chars: 0 };
  const m = scanMissing(dist);
  const chars = [...m.values()].reduce((a, k) => a + k.length, 0);
  return { segments: m.size, chars, tokens: Math.round(chars / 3.2 * 2.2) };
};
export const listTm = ({ status = '', search = '', limit = 50, offset = 0 } = {}) => {
  const w = [], a = [];
  if (status) { w.push('status = ?'); a.push(status); }
  if (search) { w.push('(src LIKE ? OR en LIKE ?)'); const s = `%${search.replace(/[%_]/g, '')}%`; a.push(s, s); }
  const where = w.length ? `WHERE ${w.join(' AND ')}` : '';
  return { total: q.get(`SELECT COUNT(*) AS n FROM i18n_tm ${where}`, ...a).n, rows: q.all(`SELECT hash, src, en, status, attempts, error, updated_at, updated_by FROM i18n_tm ${where} ORDER BY updated_at DESC LIMIT ? OFFSET ?`, ...a, Math.min(Number(limit) || 50, 200), Number(offset) || 0) };
};
export const editTm = (hash, en, approve, user) => {
  const row = q.get('SELECT src FROM i18n_tm WHERE hash = ?', hash);
  if (!row) throw new HttpError(404, 'Kayıt yok');
  en = String(en ?? '').trim();
  if (!validTranslation(row.src, en)) throw new HttpError(422, 'Çeviri boş olamaz ve kaynaktaki <1>, </1>, <2/> gibi etiketleri aynen içermelidir');
  q.run(`UPDATE i18n_tm SET en = ?, status = ?, error = NULL, updated_at = datetime('now'), updated_by = ? WHERE hash = ?`, en, approve ? 'onayli' : 'elle', user.email, hash);
  audit(user, 'i18n.duzenle', hash, approve ? 'onaylandı' : 'elle');
  scheduleGenerate();
};
export const deleteTm = (hash, user) => { q.run('DELETE FROM i18n_tm WHERE hash = ?', hash); audit(user, 'i18n.sil', hash); };

export const setMode = (mode, provider, user) => {
  const m = mode === 'otomatik' ? 'otomatik' : 'kapali';
  const was = getMode();
  setSetting('i18n.mode', m);
  if (typeof provider === 'string') setSetting('i18n.provider', provider);
  audit(user, 'i18n.mod', m);
  if (m === 'kapali' && was !== 'kapali') writing = writing.then(() => removeEnglish(config.siteDir)).catch(() => {});
};
