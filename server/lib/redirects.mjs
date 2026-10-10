// Yönlendirmeler (301/302): eski adresleri yeni sayfalara taşır — SEO için
import { q, audit } from './db.mjs';
import { HttpError } from './http.mjs';

q.run(`CREATE TABLE IF NOT EXISTS redirects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  from_path TEXT NOT NULL UNIQUE,
  to_path TEXT NOT NULL,
  code INTEGER NOT NULL DEFAULT 301,
  note TEXT NOT NULL DEFAULT '',
  hits INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
)`);

let cache = null;
const load = () => (cache = new Map(q.all('SELECT id, from_path, to_path, code FROM redirects').map((r) => [r.from_path, r])));

const norm = (p) => {
  let s = String(p ?? '').trim();
  if (!s.startsWith('/')) s = '/' + s;
  s = s.replace(/\/{2,}/g, '/');
  if (s.length > 1) s = s.replace(/\/$/, '');
  return s.toLowerCase();
};

/** İstek yolu için yönlendirme varsa { to, code } döndürür (isabet sayısını artırır). */
export const matchRedirect = (pathname) => {
  const r = (cache ?? load()).get(norm(pathname));
  if (!r) return null;
  q.run('UPDATE redirects SET hits = hits + 1 WHERE id = ?', r.id);
  return { to: r.to_path, code: r.code };
};

export const listRedirects = () => q.all('SELECT * FROM redirects ORDER BY id DESC');

const validate = ({ from, to, code }) => {
  const f = norm(from);
  if (f === '/' || /^\/(api|yonetim|medya|_astro)(\/|$)/.test(f)) throw new HttpError(400, 'Bu adres yönlendirilemez');
  if (!/^[\w\-./%~]+$/.test(f)) throw new HttpError(400, 'Kaynak adres geçersiz karakter içeriyor');
  const t = String(to ?? '').trim();
  if (!/^(\/(?!\/)|https?:\/\/)/.test(t)) throw new HttpError(400, 'Hedef "/" ile veya http(s):// ile başlamalı');
  if (t.length > 500) throw new HttpError(400, 'Hedef çok uzun');
  if (t.startsWith('/') && norm(t.split(/[?#]/)[0]) === f) throw new HttpError(400, 'Kaynak ve hedef aynı olamaz');
  if (![301, 302].includes(Number(code))) throw new HttpError(400, 'Kod 301 veya 302 olmalı');
  return { f, t, code: Number(code) };
};

export const saveRedirect = (id, body, user) => {
  const { f, t, code } = validate(body);
  const note = String(body.note ?? '').slice(0, 200);
  try {
    if (id) q.run('UPDATE redirects SET from_path = ?, to_path = ?, code = ?, note = ? WHERE id = ?', f, t, code, note, id);
    else q.run('INSERT INTO redirects (from_path, to_path, code, note) VALUES (?,?,?,?)', f, t, code, note);
  } catch (e) {
    if (String(e.message).includes('UNIQUE')) throw new HttpError(409, 'Bu kaynak adres için zaten bir yönlendirme var');
    throw e;
  }
  // Zincir/döngü kontrolü: hedefin kendisi de yönlendiriliyorsa 5 adımda başa dönmemeli
  load();
  let cur = t, seen = 0;
  while (cache.has(norm(cur.split(/[?#]/)[0])) && seen++ < 6) {
    cur = cache.get(norm(cur.split(/[?#]/)[0])).to_path;
    if (norm(cur.split(/[?#]/)[0]) === f) {
      if (id) q.run('DELETE FROM redirects WHERE id = ?', id);
      else q.run('DELETE FROM redirects WHERE from_path = ?', f);
      load();
      throw new HttpError(400, 'Bu yönlendirme bir döngü oluşturuyor');
    }
  }
  audit(user, id ? 'yonlendirme.guncelle' : 'yonlendirme.ekle', f, `${code} → ${t}`);
};

export const deleteRedirect = (id, user) => {
  const r = q.get('SELECT from_path FROM redirects WHERE id = ?', id);
  q.run('DELETE FROM redirects WHERE id = ?', id);
  load();
  audit(user, 'yonlendirme.sil', r?.from_path ?? `#${id}`);
};
