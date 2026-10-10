// "Parolamı unuttum": e-posta ile tek kullanımlık, 30 dakika geçerli sıfırlama bağlantısı (SMTP ayarlıysa)
import crypto from 'node:crypto';
import { q, audit } from './db.mjs';
import { config } from './config.mjs';
import { HttpError, rateLimit } from './http.mjs';
import { hashPassword, validatePassword, validateEmail } from './auth.mjs';
import { sendMail, smtpStatus } from './mail.mjs';

q.run(`CREATE TABLE IF NOT EXISTS password_resets (
  token_hash TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  used INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
)`);

const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');

/** Her zaman aynı yanıt döner (kullanıcı var mı yok mu belli olmasın). E-posta gönderilemezse günlüğe yazılır. */
export const requestReset = async (email, ip) => {
  const e = String(email ?? '').toLowerCase().trim();
  if (!rateLimit(`reset-ip:${ip}`, 5, 3_600_000) || !rateLimit(`reset-mail:${e}`, 3, 3_600_000)) throw new HttpError(429, 'Çok fazla deneme. Lütfen daha sonra tekrar deneyin.');
  if (!validateEmail(e)) return { ok: true };
  const user = q.get('SELECT id, email, name FROM users WHERE email = ? AND active = 1', e);
  if (!user) return { ok: true };
  if (!smtpStatus().configured) {
    audit({ email: e }, 'parola.sifirlama_istendi_smtp_yok', e, 'SMTP ayarlı değil; sunucuda "npm run admin:reset" kullanın', ip);
    return { ok: true };
  }
  const token = crypto.randomBytes(32).toString('base64url');
  q.run('DELETE FROM password_resets WHERE user_id = ?', user.id);
  q.run(`INSERT INTO password_resets (token_hash, user_id, expires_at) VALUES (?,?,datetime('now','+30 minutes'))`, sha(token), user.id);
  const link = `${config.siteUrl.replace(/\/$/, '')}/yonetim/#/parola-sifirla/${token}`;
  try {
    await sendMail({
      to: user.email,
      subject: 'AKORT yönetim paneli — parola sıfırlama',
      text: `Merhaba ${user.name},\n\nParolanızı sıfırlamak için aşağıdaki bağlantıyı 30 dakika içinde açın:\n\n${link}\n\nBu isteği siz yapmadıysanız bu e-postayı yok sayın; parolanız değişmez.`,
    });
    audit({ email: e }, 'parola.sifirlama_istendi', e, '', ip);
  } catch (err) {
    audit({ email: e }, 'parola.sifirlama_eposta_hata', e, String(err.message).slice(0, 160), ip);
  }
  return { ok: true };
};

export const completeReset = (token, password, ip) => {
  const err = validatePassword(password);
  if (err) throw new HttpError(400, err);
  const row = q.get(`SELECT user_id FROM password_resets WHERE token_hash = ? AND used = 0 AND expires_at > datetime('now')`, sha(String(token ?? '')));
  if (!row) throw new HttpError(400, 'Bağlantı geçersiz veya süresi dolmuş. Yeni bir sıfırlama isteyin.');
  const user = q.get('SELECT email FROM users WHERE id = ? AND active = 1', row.user_id);
  if (!user) throw new HttpError(400, 'Hesap bulunamadı');
  q.run('UPDATE users SET pass_hash = ? WHERE id = ?', hashPassword(password), row.user_id);
  q.run('UPDATE password_resets SET used = 1 WHERE user_id = ?', row.user_id);
  q.run('DELETE FROM sessions WHERE user_id = ?', row.user_id);
  q.run('DELETE FROM login_attempts WHERE email = ?', user.email);
  audit({ email: user.email }, 'parola.sifirlandi', user.email, '', ip);
};
