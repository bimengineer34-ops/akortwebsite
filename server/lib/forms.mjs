// Form uç noktaları (herkese açık) ve yönetim işlemleri
import { q, audit } from './db.mjs';
import { HttpError, rateLimit } from './http.mjs';
import { validateEmail } from './auth.mjs';
import { notifyNewForm } from './mail.mjs';

export const FORM_STATUSES = ['yeni', 'islemde', 'yanitlandi', 'kapali', 'spam'];

const clean = (v, max) => String(v ?? '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim().slice(0, max);
const KNOWN = new Set(['ad_soyad', 'sirket', 'eposta', 'telefon', 'hizmet_alani', 'proje_turu', 'mesaj', 'kvkk', 'website']);

export const submitContact = (body, ip, ua) => {
  if (!rateLimit(`contact:${ip}`, 5, 3_600_000)) throw new HttpError(429, 'Çok fazla talep gönderdiniz. Lütfen daha sonra tekrar deneyin.');
  if (clean(body.website, 50)) return { ok: true }; // honeypot: botlara başarılı gibi davran
  const name = clean(body.ad_soyad, 120);
  const email = clean(body.eposta, 160).toLowerCase();
  const message = clean(body.mesaj, 5000);
  const consent = body.kvkk === true || body.kvkk === 'on' || body.kvkk === 'true' || body.kvkk === '1';
  const errors = {};
  if (name.length < 2) errors.ad_soyad = 'Ad soyad gerekli';
  if (!validateEmail(email)) errors.eposta = 'Geçerli bir e-posta girin';
  if (message.length < 10) errors.mesaj = 'Mesajınız en az 10 karakter olmalı';
  if (!consent) errors.kvkk = 'KVKK onayı gerekli';
  if (Object.keys(errors).length) throw new HttpError(422, 'Form alanları geçersiz', { errors });

  const extra = {};
  for (const [k, v] of Object.entries(body)) {
    if (KNOWN.has(k) || !/^[a-z0-9_]{1,40}$/.test(k)) continue;
    extra[k] = Array.isArray(v) ? v.map((x) => clean(x, 200)).slice(0, 20) : clean(v, 300);
  }
  const r = q.run(
    'INSERT INTO forms (kind, name, email, phone, company, subject, message, payload, consent, ip, ua) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
    'iletisim',
    name,
    email,
    clean(body.telefon, 40),
    clean(body.sirket, 120),
    [clean(body.hizmet_alani, 80), clean(body.proje_turu, 80)].filter(Boolean).join(' · '),
    message,
    JSON.stringify(extra),
    1,
    ip,
    clean(ua, 200),
  );
  void notifyNewForm({ name, email, phone: clean(body.telefon, 40), company: clean(body.sirket, 120), subject: [clean(body.hizmet_alani, 80), clean(body.proje_turu, 80)].filter(Boolean).join(' · '), message });
  return { ok: true, id: Number(r.lastInsertRowid) };
};

export const subscribe = (body, ip) => {
  if (!rateLimit(`sub:${ip}`, 5, 3_600_000)) throw new HttpError(429, 'Çok fazla deneme. Lütfen daha sonra tekrar deneyin.');
  const email = clean(body.email, 160).toLowerCase();
  if (!validateEmail(email)) throw new HttpError(422, 'Geçerli bir e-posta girin');
  q.run(`INSERT INTO subscribers (email, ip) VALUES (?,?) ON CONFLICT(email) DO UPDATE SET status = 'aktif'`, email, ip);
  return { ok: true };
};

/* ------------------------------ yönetim ------------------------------ */

export const listForms = ({ status = '', search = '', limit = 50, offset = 0 } = {}) => {
  const where = [];
  const args = [];
  if (status && FORM_STATUSES.includes(status)) (where.push('status = ?'), args.push(status));
  if (search) {
    where.push('(name LIKE ? OR email LIKE ? OR company LIKE ? OR message LIKE ? OR phone LIKE ?)');
    const s = `%${search.replace(/[%_]/g, '')}%`;
    args.push(s, s, s, s, s);
  }
  const w = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const total = q.get(`SELECT COUNT(*) AS n FROM forms ${w}`, ...args).n;
  const rows = q.all(`SELECT id, created_at, name, email, phone, company, subject, status, substr(message,1,140) AS preview FROM forms ${w} ORDER BY id DESC LIMIT ? OFFSET ?`, ...args, Math.min(Number(limit) || 50, 200), Number(offset) || 0);
  const counts = Object.fromEntries(q.all('SELECT status, COUNT(*) AS n FROM forms GROUP BY status').map((r) => [r.status, r.n]));
  return { total, rows, counts };
};

export const getForm = (id) => {
  const r = q.get('SELECT * FROM forms WHERE id = ?', id);
  if (!r) throw new HttpError(404, 'Kayıt bulunamadı');
  return { ...r, payload: JSON.parse(r.payload || '{}') };
};

export const updateForm = (id, { status, note }, user) => {
  getForm(id);
  if (status !== undefined) {
    if (!FORM_STATUSES.includes(status)) throw new HttpError(400, 'Geçersiz durum');
    q.run(`UPDATE forms SET status = ?, handled_by = ?, updated_at = datetime('now') WHERE id = ?`, status, user.email, id);
  }
  if (note !== undefined) q.run(`UPDATE forms SET note = ?, handled_by = ?, updated_at = datetime('now') WHERE id = ?`, clean(note, 4000), user.email, id);
  audit(user, 'form.guncelle', `#${id}`, status ?? 'not');
};

export const deleteForm = (id, user) => {
  q.run('DELETE FROM forms WHERE id = ?', id);
  audit(user, 'form.sil', `#${id}`);
};

const csvCell = (v) => {
  let s = String(v ?? '');
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`; // CSV/Excel formül enjeksiyonunu önle
  return `"${s.replace(/"/g, '""')}"`;
};
export const formsCsv = () => {
  const rows = q.all('SELECT * FROM forms ORDER BY id DESC');
  const head = ['ID', 'Tarih', 'Durum', 'Ad Soyad', 'E-posta', 'Telefon', 'Şirket', 'Konu', 'Mesaj', 'Ek alanlar', 'Not'];
  const lines = [head.map(csvCell).join(',')];
  for (const r of rows) lines.push([r.id, r.created_at, r.status, r.name, r.email, r.phone, r.company, r.subject, r.message, r.payload, r.note].map(csvCell).join(','));
  return '﻿' + lines.join('\r\n');
};

export const listSubscribers = ({ search = '', limit = 100, offset = 0 } = {}) => {
  const s = `%${String(search).replace(/[%_]/g, '')}%`;
  const total = q.get('SELECT COUNT(*) AS n FROM subscribers WHERE email LIKE ?', s).n;
  const rows = q.all('SELECT id, email, created_at, status FROM subscribers WHERE email LIKE ? ORDER BY id DESC LIMIT ? OFFSET ?', s, Math.min(Number(limit) || 100, 500), Number(offset) || 0);
  return { total, rows };
};
export const setSubscriberStatus = (id, status, user) => {
  if (!['aktif', 'cikti'].includes(status)) throw new HttpError(400, 'Geçersiz durum');
  q.run('UPDATE subscribers SET status = ? WHERE id = ?', status, id);
  audit(user, 'abone.guncelle', `#${id}`, status);
};
export const deleteSubscriber = (id, user) => {
  q.run('DELETE FROM subscribers WHERE id = ?', id);
  audit(user, 'abone.sil', `#${id}`);
};
export const subscribersCsv = () => '﻿' + ['"E-posta","Tarih","Durum"', ...q.all('SELECT email, created_at, status FROM subscribers ORDER BY id DESC').map((r) => [r.email, r.created_at, r.status].map(csvCell).join(','))].join('\r\n');
