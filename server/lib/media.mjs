// Medya kütüphanesi: yükleme (sihirli bayt doğrulama), SEO dosya adı, otomatik webp varyantları, alt metin
import fs from 'node:fs';
import path from 'node:path';
import { q, audit } from './db.mjs';
import { paths } from './config.mjs';
import { HttpError } from './http.mjs';
import { listDocs, getDoc } from './content.mjs';

let sharp = null;
try {
  sharp = (await import('sharp')).default;
} catch {
  console.warn('[medya] sharp bulunamadı: görseller yeniden boyutlandırılmayacak');
}

const TR = { ç: 'c', ğ: 'g', ı: 'i', ö: 'o', ş: 's', ü: 'u', Ç: 'c', Ğ: 'g', İ: 'i', I: 'i', Ö: 'o', Ş: 's', Ü: 'u' };
/** SEO dostu dosya adı: küçük harf, Türkçe karakterler ASCII, tire ile ayrılmış */
export const slugify = (s) =>
  String(s)
    .replace(/[çğıöşüÇĞİIÖŞÜ]/g, (c) => TR[c])
    .toLowerCase()
    .replace(/\.[a-z0-9]{2,5}$/, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 90) || 'dosya';

const sniff = (b) => {
  if (b.length > 8 && b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return { ext: 'png', mime: 'image/png', image: true };
  if (b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { ext: 'jpg', mime: 'image/jpeg', image: true };
  if (b.length > 12 && b.subarray(0, 4).toString() === 'RIFF' && b.subarray(8, 12).toString() === 'WEBP') return { ext: 'webp', mime: 'image/webp', image: true };
  if (b.length > 6 && /^GIF8[79]a/.test(b.subarray(0, 6).toString('latin1'))) return { ext: 'gif', mime: 'image/gif', image: true };
  if (b.length > 5 && b.subarray(0, 5).toString() === '%PDF-') return { ext: 'pdf', mime: 'application/pdf', image: false };
  if (b.length > 12 && b.subarray(4, 8).toString() === 'ftyp') return { ext: 'mp4', mime: 'video/mp4', image: false };
  return null;
};

export const MIME_BY_EXT = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif', pdf: 'application/pdf', mp4: 'video/mp4' };

const uniqueName = (base, ext) => {
  let name = `${base}.${ext}`;
  let i = 2;
  while (fs.existsSync(path.join(paths.media, name)) || q.get('SELECT 1 AS x FROM media WHERE filename = ?', name)) name = `${base}-${i++}.${ext}`;
  return name;
};

export const uploadMedia = async (buffer, origName, user) => {
  const t = sniff(buffer);
  if (!t) throw new HttpError(415, 'Desteklenmeyen dosya türü (PNG, JPG, WEBP, GIF, PDF, MP4 kabul edilir)');
  const base = slugify(origName);
  const filename = uniqueName(base, t.ext);
  let width = null, height = null;
  let variants = [];
  let out = buffer;
  if (t.image && sharp && t.ext !== 'gif') {
    // EXIF'i temizle (konum bilgisi sızmasın), yönü düzelt
    const img = sharp(buffer, { failOn: 'none' }).rotate();
    const meta = await img.metadata();
    width = meta.width ?? null;
    height = meta.height ?? null;
    if (width && width > 4000) {
      out = await img.resize({ width: 4000, withoutEnlargement: true }).toFormat(t.ext === 'jpg' ? 'jpeg' : t.ext, { quality: 90 }).toBuffer();
      width = 4000;
      height = Math.round((meta.height / meta.width) * 4000);
    } else {
      out = await img.toFormat(t.ext === 'jpg' ? 'jpeg' : t.ext, { quality: 90 }).toBuffer();
    }
    for (const w of [640, 1024, 1600]) {
      if (width && w >= width) continue;
      const vname = `${filename.replace(/\.[a-z0-9]+$/, '')}-${w}.webp`;
      await sharp(out).resize({ width: w }).webp({ quality: 80 }).toFile(path.join(paths.media, vname));
      variants.push({ width: w, file: vname });
    }
    const wname = `${filename.replace(/\.[a-z0-9]+$/, '')}.webp`;
    if (t.ext !== 'webp') {
      await sharp(out).webp({ quality: 82 }).toFile(path.join(paths.media, wname));
      variants.push({ width: width ?? 0, file: wname });
    }
  } else if (t.image && t.ext === 'gif' && sharp) {
    const meta = await sharp(buffer, { animated: false }).metadata();
    width = meta.width ?? null;
    height = meta.height ?? null;
  }
  fs.writeFileSync(path.join(paths.media, filename), out);
  const r = q.run('INSERT INTO media (filename, orig_name, mime, size, width, height, variants, user_email) VALUES (?,?,?,?,?,?,?,?)', filename, String(origName).slice(0, 200), t.mime, out.length, width, height, JSON.stringify(variants), user.email);
  audit(user, 'medya.yukle', filename);
  return getMedia(Number(r.lastInsertRowid));
};

const shape = (r) => ({ ...r, variants: JSON.parse(r.variants || '[]'), url: `/medya/${r.filename}` });

export const getMedia = (id) => {
  const r = q.get('SELECT * FROM media WHERE id = ?', id);
  if (!r) throw new HttpError(404, 'Medya bulunamadı');
  return shape(r);
};

export const listMedia = ({ search = '', type = '', limit = 60, offset = 0 } = {}) => {
  const where = [];
  const args = [];
  if (search) {
    where.push('(filename LIKE ? OR alt LIKE ? OR title LIKE ?)');
    const s = `%${String(search).replace(/[%_]/g, '')}%`;
    args.push(s, s, s);
  }
  if (type === 'image') where.push("mime LIKE 'image/%'");
  if (type === 'document') where.push("mime NOT LIKE 'image/%'");
  const w = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const total = q.get(`SELECT COUNT(*) AS n FROM media ${w}`, ...args).n;
  const rows = q.all(`SELECT * FROM media ${w} ORDER BY id DESC LIMIT ? OFFSET ?`, ...args, Math.min(Number(limit) || 60, 200), Number(offset) || 0).map(shape);
  return { total, rows };
};

export const updateMedia = (id, { alt, title, name }, user) => {
  const m = getMedia(id);
  if (alt !== undefined) q.run('UPDATE media SET alt = ? WHERE id = ?', String(alt).slice(0, 300), id);
  if (title !== undefined) q.run('UPDATE media SET title = ? WHERE id = ?', String(title).slice(0, 200), id);
  if (name !== undefined && name) {
    const ext = m.filename.split('.').pop();
    const base = slugify(name);
    if (`${base}.${ext}` !== m.filename) {
      const newName = uniqueName(base, ext);
      const oldBase = m.filename.replace(/\.[a-z0-9]+$/, '');
      const newBase = newName.replace(/\.[a-z0-9]+$/, '');
      fs.renameSync(path.join(paths.media, m.filename), path.join(paths.media, newName));
      const variants = m.variants.map((v) => {
        const nf = v.file.replace(oldBase, newBase);
        if (fs.existsSync(path.join(paths.media, v.file))) fs.renameSync(path.join(paths.media, v.file), path.join(paths.media, nf));
        return { ...v, file: nf };
      });
      q.run('UPDATE media SET filename = ?, variants = ? WHERE id = ?', newName, JSON.stringify(variants), id);
    }
  }
  audit(user, 'medya.guncelle', m.filename);
  return getMedia(id);
};

export const deleteMedia = (id, user) => {
  const m = getMedia(id);
  const used = mediaUsage(m.filename);
  if (used.length) throw new HttpError(409, `Bu dosya ${used.length} belgede kullanılıyor: ${used.slice(0, 5).map((u) => u.label).join(', ')}`, { used });
  for (const f of [m.filename, ...m.variants.map((v) => v.file)]) fs.rmSync(path.join(paths.media, f), { force: true });
  q.run('DELETE FROM media WHERE id = ?', id);
  audit(user, 'medya.sil', m.filename);
};

/** Dosya adının geçtiği içerik belgeleri (taslak / yayın) */
export const mediaUsage = (filename) => {
  const out = [];
  for (const d of listDocs()) {
    const doc = getDoc(d.key);
    const hay = JSON.stringify([doc.draft, doc.published]);
    if (hay.includes(filename)) out.push({ key: d.key, label: `${d.group} › ${d.label}` });
  }
  return out;
};

export const mediaFilePath = (name) => {
  if (!/^[a-z0-9][a-z0-9._-]*$/.test(name)) return null;
  const p = path.join(paths.media, name);
  return p.startsWith(paths.media) && fs.existsSync(p) ? p : null;
};
