// 2 adımlı doğrulama (TOTP, RFC 6238): Google Authenticator / Microsoft Authenticator / Authy / 1Password uyumlu
import crypto from 'node:crypto';
import { q, audit } from './db.mjs';
import { HttpError } from './http.mjs';
import { verifyPassword } from './auth.mjs';

// Mevcut veritabanlarına sütun ekle (varsa hata verir, yoksayılır)
for (const sql of [
  'ALTER TABLE users ADD COLUMN totp_secret TEXT',
  'ALTER TABLE users ADD COLUMN totp_enabled INTEGER NOT NULL DEFAULT 0',
  'ALTER TABLE users ADD COLUMN totp_last_step INTEGER NOT NULL DEFAULT 0',
  "ALTER TABLE users ADD COLUMN recovery_codes TEXT NOT NULL DEFAULT '[]'",
]) {
  try {
    q.run(sql);
  } catch {
    /* sütun zaten var */
  }
}

const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const b32encode = (buf) => {
  let bits = 0, value = 0, out = '';
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += B32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  return out;
};
const b32decode = (s) => {
  let bits = 0, value = 0;
  const out = [];
  for (const ch of s.replace(/=+$/, '').toUpperCase()) {
    const i = B32.indexOf(ch);
    if (i < 0) continue;
    value = (value << 5) | i;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
};

const hotp = (secret, counter) => {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(counter));
  const h = crypto.createHmac('sha1', b32decode(secret)).update(buf).digest();
  const off = h[h.length - 1] & 0xf;
  const code = ((h[off] & 0x7f) << 24) | (h[off + 1] << 16) | (h[off + 2] << 8) | h[off + 3];
  return String(code % 1_000_000).padStart(6, '0');
};

const STEP = 30;
/** Kodu doğrular (±1 adım toleransı). Başarılıysa kullanılan adımı döndürür; aksi halde 0. */
export const checkCode = (secret, code, lastStep = 0) => {
  const c = String(code ?? '').replace(/\s/g, '');
  if (!/^\d{6}$/.test(c)) return 0;
  const now = Math.floor(Date.now() / 1000 / STEP);
  for (const step of [now, now - 1, now + 1]) {
    if (step <= lastStep) continue; // aynı kodun yeniden kullanımını engelle (replay)
    const expect = hotp(secret, step);
    if (crypto.timingSafeEqual(Buffer.from(expect), Buffer.from(c))) return step;
  }
  return 0;
};

export const newSecret = () => b32encode(crypto.randomBytes(20));
export const otpauthUri = (secret, email) => `otpauth://totp/AKORT:${encodeURIComponent(email)}?secret=${secret}&issuer=AKORT&algorithm=SHA1&digits=6&period=30`;

const hashCode = (c) => crypto.createHash('sha256').update(c).digest('hex');
const makeRecoveryCodes = () => Array.from({ length: 8 }, () => `${crypto.randomBytes(3).toString('hex')}-${crypto.randomBytes(3).toString('hex')}`);

export const totpStatus = (userId) => {
  const u = q.get('SELECT totp_enabled, recovery_codes FROM users WHERE id = ?', userId);
  return { enabled: !!u?.totp_enabled, recoveryLeft: u?.totp_enabled ? JSON.parse(u.recovery_codes || '[]').length : 0 };
};

/** Kurulum 1. adım: gizli anahtar üretir (henüz etkin değil). */
export const beginSetup = (user) => {
  const secret = newSecret();
  q.run('UPDATE users SET totp_secret = ?, totp_enabled = 0, totp_last_step = 0 WHERE id = ?', secret, user.id);
  return { secret, uri: otpauthUri(secret, user.email) };
};

/** Kurulum 2. adım: ilk kodu doğrular, etkinleştirir ve tek seferlik kurtarma kodlarını verir. */
export const enable = (user, code, ip) => {
  const row = q.get('SELECT totp_secret FROM users WHERE id = ?', user.id);
  if (!row?.totp_secret) throw new HttpError(400, 'Önce kurulumu başlatın');
  const step = checkCode(row.totp_secret, code);
  if (!step) throw new HttpError(400, 'Kod hatalı. Telefonunuzdaki güncel 6 haneli kodu girin.');
  const codes = makeRecoveryCodes();
  q.run('UPDATE users SET totp_enabled = 1, totp_last_step = ?, recovery_codes = ? WHERE id = ?', step, JSON.stringify(codes.map(hashCode)), user.id);
  q.run('DELETE FROM sessions WHERE user_id = ? AND id != ?', user.id, user.sid);
  audit(user, '2fa.etkinlestir', user.email, '', ip);
  return codes;
};

export const disable = (user, password, code, ip) => {
  const row = q.get('SELECT pass_hash, totp_secret, totp_enabled, totp_last_step FROM users WHERE id = ?', user.id);
  if (!verifyPassword(String(password ?? ''), row.pass_hash)) throw new HttpError(400, 'Parola hatalı');
  if (row.totp_enabled && !checkCode(row.totp_secret, code, row.totp_last_step)) throw new HttpError(400, 'Doğrulama kodu hatalı');
  q.run("UPDATE users SET totp_enabled = 0, totp_secret = NULL, recovery_codes = '[]' WHERE id = ?", user.id);
  audit(user, '2fa.kapat', user.email, '', ip);
};

export const adminReset = (admin, targetId, ip) => {
  const t = q.get('SELECT email FROM users WHERE id = ?', targetId);
  if (!t) throw new HttpError(404, 'Kullanıcı yok');
  q.run("UPDATE users SET totp_enabled = 0, totp_secret = NULL, recovery_codes = '[]' WHERE id = ?", targetId);
  q.run('DELETE FROM sessions WHERE user_id = ?', targetId);
  audit(admin, '2fa.sifirla', t.email, '', ip);
};

/* ---------- giriş sırasında ikinci adım ---------- */
const tickets = new Map(); // ticket → { userId, ip, exp, tries }
export const issueTicket = (userId, ip) => {
  const t = crypto.randomBytes(24).toString('base64url');
  tickets.set(t, { userId, ip, exp: Date.now() + 5 * 60_000, tries: 0 });
  return t;
};
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of tickets) if (v.exp < now) tickets.delete(k);
}, 60_000).unref();

/** Bilet + kod (veya kurtarma kodu) doğrulanırsa kullanıcı kimliğini döndürür. */
export const redeemTicket = (ticket, code, ip) => {
  const t = tickets.get(ticket);
  if (!t || t.exp < Date.now()) throw new HttpError(401, 'Doğrulama süresi doldu, yeniden giriş yapın');
  if (++t.tries > 5) {
    tickets.delete(ticket);
    throw new HttpError(429, 'Çok fazla hatalı kod. Yeniden giriş yapın.');
  }
  const u = q.get('SELECT * FROM users WHERE id = ? AND active = 1', t.userId);
  if (!u?.totp_enabled) throw new HttpError(401, 'Doğrulama geçersiz');
  const raw = String(code ?? '').trim().toLowerCase();
  let ok = false;
  const step = checkCode(u.totp_secret, raw, u.totp_last_step);
  if (step) {
    q.run('UPDATE users SET totp_last_step = ? WHERE id = ?', step, u.id);
    ok = true;
  } else if (/^[0-9a-f]{6}-[0-9a-f]{6}$/.test(raw)) {
    const list = JSON.parse(u.recovery_codes || '[]');
    const h = hashCode(raw);
    if (list.includes(h)) {
      q.run('UPDATE users SET recovery_codes = ? WHERE id = ?', JSON.stringify(list.filter((x) => x !== h)), u.id);
      audit(u, '2fa.kurtarma_kodu_kullanildi', u.email, `${list.length - 1} kod kaldı`, ip);
      ok = true;
    }
  }
  q.run('INSERT INTO login_attempts (ip, email, ok) VALUES (?,?,?)', ip, u.email, ok ? 1 : 0);
  if (!ok) {
    audit({ email: u.email }, '2fa.basarisiz', u.email, '', ip);
    throw new HttpError(401, 'Kod hatalı');
  }
  tickets.delete(ticket);
  return u;
};
