// Markdown içerik girdileri: blog, projeler, yasal metinler (src/content/**) — okuma/yazma/doğrulama
import fs from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';
import { q, audit, setSetting, getSetting } from './db.mjs';
import { paths, ROOT } from './config.mjs';
import { HttpError } from './http.mjs';
import { mediaFilePath } from './media.mjs';

const dirs = {
  blog: paths.contentBlog,
  projects: paths.contentProjects,
  legal: path.join(ROOT, 'src', 'content', 'legal'),
};
const uploadsDir = path.join(ROOT, 'src', 'assets', 'images', 'uploads');
const UPLOAD_REL = '../../assets/images/uploads/';

/** Kategori ve sektör listeleri kaynak dosyalardan okunur (tek doğruluk kaynağı). */
const quotedList = (file, name) => {
  const src = fs.readFileSync(path.join(ROOT, 'src', 'data', file), 'utf8');
  const m = src.match(new RegExp(`export const ${name}\\s*=\\s*\\[([\\s\\S]*?)\\]`));
  return m ? [...m[1].matchAll(/['"]([^'"]+)['"]/g)].map((x) => x[1]) : [];
};
const sectorOptions = () => {
  const src = fs.readFileSync(path.join(ROOT, 'src', 'data', 'sectors.ts'), 'utf8');
  return [...src.matchAll(/key:\s*'([a-z]+)'[\s\S]*?title:\s*'([^']+)'/g)].map((m) => ({ value: m[1], label: m[2] }));
};

const seoFields = [
  { name: 'seo.title', label: 'SEO başlığı (isteğe bağlı)', type: 'text', max: 70, hint: 'Boşsa sayfa başlığı kullanılır. En çok 60 karakter önerilir.' },
  { name: 'seo.description', label: 'SEO açıklaması (isteğe bağlı)', type: 'textarea', max: 170, rows: 3, hint: 'Arama sonuçlarında görünür. 120–160 karakter ideal.' },
  { name: 'seo.noindex', label: 'Arama motorlarından gizle (noindex)', type: 'bool' },
];

export const ENTRY_KINDS = {
  blog: {
    label: 'Blog Yazısı',
    plural: 'Blog',
    canCreate: true,
    fields: () => [
      { name: 'title', label: 'Başlık', type: 'text', required: true, max: 110 },
      { name: 'description', label: 'Meta açıklaması', type: 'textarea', required: true, min: 50, max: 170, rows: 3, hint: '50–170 karakter; arama sonuçlarında görünür.' },
      { name: 'excerpt', label: 'Kart özeti (isteğe bağlı)', type: 'textarea', max: 260, rows: 3 },
      { name: 'pubDate', label: 'Yayın tarihi', type: 'date', required: true },
      { name: 'updatedDate', label: 'Güncelleme tarihi', type: 'date' },
      { name: 'category', label: 'Kategori', type: 'select', required: true, options: quotedList('blog.ts', 'blogCategories').map((c) => ({ value: c, label: c })) },
      { name: 'tags', label: 'Etiketler', type: 'tags' },
      { name: 'cover', label: 'Kapak görseli', type: 'media' },
      { name: 'coverAlt', label: 'Kapak alt metni', type: 'text', max: 200, hint: 'Kapak görseli seçildiğinde zorunludur.' },
      { name: 'author', label: 'Yazar', type: 'text', max: 80 },
      { name: 'featured', label: 'Blog sayfasında "Öne Çıkan Yazı"', type: 'bool' },
      { name: 'popular', label: 'Yan panelde "Popüler Yazılar"', type: 'bool' },
      { name: 'draft', label: 'Taslak (yayınlanmaz)', type: 'bool' },
      ...seoFields,
    ],
    defaults: { author: 'AKORT Mühendislik', tags: [], featured: false, popular: false, draft: true },
    order: ['title', 'description', 'excerpt', 'pubDate', 'updatedDate', 'category', 'tags', 'cover', 'coverAlt', 'author', 'featured', 'popular', 'draft', 'seo'],
  },
  projects: {
    label: 'Proje',
    plural: 'Projeler',
    canCreate: true,
    fields: () => [
      { name: 'title', label: 'Proje adı', type: 'text', required: true, max: 120 },
      { name: 'summary', label: 'Özet', type: 'textarea', required: true, max: 240, rows: 3 },
      { name: 'sector', label: 'Sektör', type: 'select', required: true, options: sectorOptions() },
      {
        name: 'serviceGroup',
        label: 'Hizmet grubu (ilgili hizmet sayfasında listelenir)',
        type: 'select',
        options: [
          { value: 'yazilim', label: 'Yazılım & Dijital Çözümler' },
          { value: 'bim', label: 'BIM & Dijital Mühendislik' },
          { value: 'muhendislik', label: 'Mühendislik Danışmanlığı' },
          { value: 'enerji', label: 'Enerji & Bina Performansı' },
          { value: 'maliyet', label: 'Maliyet & Teknik Danışmanlık' },
        ],
        hint: 'Yazılım projeleri için "Yazılım" seçin; proje, Yazılım hizmet sayfasında kartla görünür (taslak değilse).',
      },
      { name: 'location', label: 'Konum', type: 'verifiable', hint: 'Doğrulanmadıkça yayında gösterilmez.' },
      { name: 'year', label: 'Proje dönemi', type: 'verifiable' },
      { name: 'area', label: 'Alan', type: 'verifiable' },
      { name: 'capacity', label: 'Kapasite', type: 'verifiable' },
      { name: 'role', label: 'AKORT rolü', type: 'text', max: 200 },
      { name: 'problem', label: 'Problem / ihtiyaç', type: 'textarea', rows: 4 },
      { name: 'challenge', label: 'Zorluk', type: 'textarea', rows: 4 },
      { name: 'approach', label: 'Yaklaşım', type: 'textarea', rows: 4 },
      { name: 'solution', label: 'Çözüm', type: 'textarea', rows: 4 },
      { name: 'bimScope', label: 'BIM kapsamı', type: 'textarea', rows: 3 },
      { name: 'energyScope', label: 'Enerji kapsamı', type: 'textarea', rows: 3 },
      { name: 'costScope', label: 'Maliyet kapsamı', type: 'textarea', rows: 3 },
      { name: 'results', label: 'Sonuçlar', type: 'verifiable-list', hint: 'Her sonuç doğrulama işaretiyle yayınlanır.' },
      { name: 'outputs', label: 'Teslimatlar', type: 'tags' },
      { name: 'cover', label: 'Kapak görseli', type: 'media' },
      { name: 'coverAlt', label: 'Kapak alt metni', type: 'text', max: 200 },
      { name: 'gallery', label: 'Galeri', type: 'gallery' },
      { name: 'featured', label: 'Ana sayfada "Öne Çıkan Projeler"', type: 'bool' },
      { name: 'spotlight', label: 'Projeler sayfasında koyu "Öne Çıkan Proje" bandı (tek proje)', type: 'bool' },
      { name: 'sample', label: 'Örnek çalışma (kurgusal senaryo; gerçek müşteri projesi DEĞİL — kart ve sayfada "Örnek Çalışma" olarak işaretlenir)', type: 'bool' },
      { name: 'order', label: 'Sıra numarası', type: 'number' },
      { name: 'draft', label: 'Taslak (yayınlanmaz)', type: 'bool' },
      ...seoFields,
    ],
    defaults: { featured: false, spotlight: false, draft: true, order: 0, results: [], outputs: [], gallery: [], bimModel: { enabled: false } },
    order: ['title', 'summary', 'sector', 'serviceGroup', 'location', 'year', 'area', 'capacity', 'role', 'problem', 'challenge', 'approach', 'solution', 'bimScope', 'energyScope', 'costScope', 'results', 'outputs', 'cover', 'coverAlt', 'gallery', 'bimModel', 'featured', 'spotlight', 'sample', 'draft', 'order', 'seo'],
  },
  legal: {
    label: 'Yasal Metin',
    plural: 'Yasal Metinler',
    canCreate: false,
    fields: () => [
      { name: 'title', label: 'Başlık', type: 'text', required: true, max: 120 },
      { name: 'description', label: 'Meta açıklaması', type: 'textarea', required: true, max: 170, rows: 3 },
      { name: 'updatedDate', label: 'Son güncelleme tarihi', type: 'date' },
      { name: 'approved', label: 'Hukuken onaylandı (işaretlenmezse sayfa "hazırlanıyor" gösterir ve arama motorlarına kapalı kalır)', type: 'bool' },
    ],
    defaults: { approved: false },
    order: ['title', 'description', 'updatedDate', 'approved'],
  },
};

const kindOf = (kind) => {
  if (!ENTRY_KINDS[kind]) throw new HttpError(404, 'Bilinmeyen tür');
  return ENTRY_KINDS[kind];
};

const parseFile = (file) => {
  const raw = fs.readFileSync(file, 'utf8').replace(/^﻿/, '');
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!m) return { data: {}, body: raw };
  let data = {};
  try {
    data = YAML.parse(m[1]) ?? {};
  } catch {
    data = {};
  }
  return { data, body: m[2].replace(/^\r?\n/, '') };
};

const dateStr = (d) => (d instanceof Date ? d.toISOString().slice(0, 10) : d == null ? '' : String(d).slice(0, 10));

const normalizeOut = (data) => {
  const out = { ...data };
  for (const k of ['pubDate', 'updatedDate']) if (k in out) out[k] = dateStr(out[k]);
  return out;
};

const fileFor = (kind, slug) => {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 100) throw new HttpError(400, 'Adres (slug) yalnızca küçük harf, rakam ve tire içerebilir');
  return path.join(dirs[kind], `${slug}.md`);
};

export const listEntries = (kind) => {
  kindOf(kind);
  if (!fs.existsSync(dirs[kind])) return [];
  return fs
    .readdirSync(dirs[kind])
    .filter((f) => f.endsWith('.md') && !f.startsWith('_'))
    .map((f) => {
      const slug = f.slice(0, -3);
      const { data } = parseFile(path.join(dirs[kind], f));
      const d = normalizeOut(data);
      return {
        slug,
        title: d.title ?? slug,
        draft: kind === 'legal' ? !d.approved : d.draft !== false,
        date: d.pubDate ?? d.updatedDate ?? '',
        category: d.category ?? d.sector ?? '',
        featured: !!d.featured,
        updatedAt: fs.statSync(path.join(dirs[kind], f)).mtime.toISOString(),
      };
    })
    .sort((a, b) => (b.date || b.updatedAt).localeCompare(a.date || a.updatedAt));
};

const coverPreview = (v) => (typeof v === 'string' && v.startsWith(UPLOAD_REL) ? `/medya/${v.slice(UPLOAD_REL.length)}` : '');

export const getEntry = (kind, slug) => {
  const meta = kindOf(kind);
  const file = fileFor(kind, slug);
  if (!fs.existsSync(file)) throw new HttpError(404, 'Girdi bulunamadı');
  const { data, body } = parseFile(file);
  const d = normalizeOut(data);
  return { kind, slug, data: d, body, fields: meta.fields(), canCreate: meta.canCreate, label: meta.label, previews: { cover: coverPreview(d.cover) } };
};

/* ------------------------------ doğrulama ------------------------------ */

const isStr = (v) => typeof v === 'string';
const check = (kind, data) => {
  const errs = [];
  for (const f of ENTRY_KINDS[kind].fields()) {
    if (f.name.includes('.')) continue;
    const v = data[f.name];
    const empty = v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0 && f.required);
    if (f.required && empty) {
      errs.push(`${f.label}: zorunlu`);
      continue;
    }
    if (empty) continue;
    if (['text', 'textarea', 'select', 'date', 'media'].includes(f.type)) {
      if (!isStr(v)) errs.push(`${f.label}: metin olmalı`);
      else {
        if (f.max && v.length > f.max) errs.push(`${f.label}: en çok ${f.max} karakter (şu an ${v.length})`);
        if (f.min && v.length < f.min) errs.push(`${f.label}: en az ${f.min} karakter (şu an ${v.length})`);
      }
    }
    if (f.type === 'date' && isStr(v) && !/^\d{4}-\d{2}-\d{2}$/.test(v)) errs.push(`${f.label}: tarih biçimi YYYY-AA-GG olmalı`);
    if (f.type === 'select' && !f.options.some((o) => o.value === v)) errs.push(`${f.label}: geçersiz seçim`);
    if (f.type === 'bool' && typeof v !== 'boolean') errs.push(`${f.label}: evet/hayır olmalı`);
    if (f.type === 'number' && typeof v !== 'number') errs.push(`${f.label}: sayı olmalı`);
    if (f.type === 'tags' && !(Array.isArray(v) && v.every(isStr))) errs.push(`${f.label}: liste olmalı`);
  }
  if (kind === 'blog' && data.cover && !data.coverAlt) errs.push('Kapak görseli seçildiğinde alt metni zorunludur');
  if (data.seo && (data.seo.title?.length > 70 || data.seo.description?.length > 170)) errs.push('SEO alanları çok uzun');
  return errs;
};

const verifiableOk = (v) => v === undefined || (v && typeof v === 'object' && typeof v.value === 'string' && typeof v.verified === 'boolean');

const useMediaForAsset = (value) => {
  // Medya kütüphanesinden seçilen /medya/<dosya> → Astro görsel işlem hattına girmesi için src/assets/images/uploads altına kopyalanır
  if (typeof value !== 'string' || !value) return value;
  const m = value.match(/^\/medya\/([a-z0-9][a-z0-9._-]*)$/);
  if (!m) return value;
  const src = mediaFilePath(m[1]);
  if (!src) throw new HttpError(400, 'Seçilen medya bulunamadı');
  fs.mkdirSync(uploadsDir, { recursive: true });
  const dest = path.join(uploadsDir, m[1]);
  if (!fs.existsSync(dest)) fs.copyFileSync(src, dest);
  return UPLOAD_REL + m[1];
};

export const markDirty = () => setSetting('entries_dirty', '1');
export const clearDirty = () => setSetting('entries_dirty', '0');
export const isDirty = () => getSetting('entries_dirty', '0') === '1';

export const saveEntry = (kind, slug, payload, user, { create = false } = {}) => {
  const meta = kindOf(kind);
  const file = fileFor(kind, slug);
  const exists = fs.existsSync(file);
  if (create && exists) throw new HttpError(409, 'Bu adreste bir girdi zaten var');
  if (create && !meta.canCreate) throw new HttpError(400, 'Bu türde yeni girdi eklenemez');
  if (!create && !exists) throw new HttpError(404, 'Girdi bulunamadı');
  const input = payload.data ?? {};
  const body = String(payload.body ?? '');
  if (body.length > 400_000) throw new HttpError(422, 'Metin çok uzun');

  const prev = exists ? parseFile(file).data : {};
  // Şemada olup formda olmayan alanlar (ör. bimModel, relatedServices) korunur
  const data = { ...meta.defaults, ...prev, ...input };
  for (const k of ['cover']) if (k in data) data[k] = useMediaForAsset(data[k]);
  if (Array.isArray(data.gallery)) data.gallery = data.gallery.map((g) => ({ ...g, src: useMediaForAsset(g.src) }));
  for (const k of ['pubDate', 'updatedDate']) if (data[k] === '') delete data[k];
  for (const k of Object.keys(data)) if (data[k] === '' || data[k] === null || data[k] === undefined) delete data[k];
  if (data.seo && !data.seo.title && !data.seo.description && !data.seo.noindex) delete data.seo;
  else if (data.seo) {
    for (const k of Object.keys(data.seo)) if (data.seo[k] === '' || data.seo[k] === false) delete data.seo[k];
  }
  const errs = check(kind, data);
  for (const k of ['location', 'year', 'area', 'capacity']) if (!verifiableOk(data[k])) errs.push(`${k}: geçersiz biçim`);
  if (Array.isArray(data.results) && !data.results.every(verifiableOk)) errs.push('Sonuçlar: geçersiz biçim');
  if (errs.length) throw new HttpError(422, 'Doğrulama hatası', { errors: errs });

  const ordered = {};
  for (const k of meta.order) if (k in data) ordered[k] = data[k];
  for (const k of Object.keys(data)) if (!(k in ordered)) ordered[k] = data[k];
  const fm = YAML.stringify(ordered, { lineWidth: 0, defaultStringType: 'PLAIN' }).trimEnd();
  fs.mkdirSync(dirs[kind], { recursive: true });
  fs.writeFileSync(file, `---\n${fm}\n---\n\n${body.replace(/\s+$/, '')}\n`, 'utf8');
  markDirty();
  audit(user, create ? 'girdi.ekle' : 'girdi.guncelle', `${kind}/${slug}`);
  return { ok: true, slug };
};

export const deleteEntry = (kind, slug, user) => {
  const meta = kindOf(kind);
  if (!meta.canCreate) throw new HttpError(400, 'Bu tür silinemez');
  const file = fileFor(kind, slug);
  if (!fs.existsSync(file)) throw new HttpError(404, 'Girdi bulunamadı');
  // Geri alınabilirlik için silinen dosyayı çöp klasörüne taşı
  const trash = path.join(paths.backups, 'silinenler');
  fs.mkdirSync(trash, { recursive: true });
  fs.renameSync(file, path.join(trash, `${kind}-${slug}-${Date.now()}.md`));
  markDirty();
  audit(user, 'girdi.sil', `${kind}/${slug}`);
};

void q;
