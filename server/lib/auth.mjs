// Kimlik doğrulama: scrypt parola, oturum, CSRF, giriş kısıtlama
import crypto from 'node:crypto';
import { q, audit } from './db.mjs';
import { config } from './config.mjs';
import { HttpError, parseCookies, cookieHeader } from './http.mjs';

const SID = 'akort_sid';
const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');

export const hashPassword = (password) => {
  const salt = crypto.randomBytes(16);
  const N = 16384, r = 8, p = 1;
  const hash = crypto.scryptSync(password, salt, 64, { N, r, p });
  return `scrypt$${N}$${r}$${p}$${salt.toString('base64')}$${hash.toString('base64')}`;
};

export const verifyPassword = (password, stored) => {
  const [alg, N, r, p, salt, hash] = String(stored).split('$');
  if (alg !== 'scrypt') return false;
  const calc = crypto.scryptSync(password, Buffer.from(salt, 'base64'), 64, { N: +N, r: +r, p: +p });
  const exp = Buffer.from(hash, 'base64');
  return exp.length === calc.length && crypto.timingSafeEqual(exp, calc);
};

export const validatePassword = (pw) => {
  if (typeof pw !== 'string' || pw.length < 10) return 'Parola en az 10 karakter olmalı';
  if (!/[a-zA-ZçğıöşüÇĞİÖŞÜ]/.test(pw) || !/[0-9]/.test(pw)) return 'Parola en az bir harf ve bir rakam içermeli';
  return '';
};

export const validateEmail = (e) => typeof e === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e) && e.length <= 160;

export const userCount = () => q.get('SELECT COUNT(*) AS n FROM users').n;

export const createUser = ({ email, name, role, password }) => {
  const err = validatePassword(password);
  if (err) throw new HttpError(400, err);
  if (!validateEmail(email)) throw new HttpError(400, 'Geçerli bir e-posta girin');
  if (!['admin', 'editor'].includes(role)) throw new HttpError(400, 'Geçersiz rol');
  try {
    const r = q.run('INSERT INTO users (email, name, role, pass_hash) VALUES (?,?,?,?)', email.toLowerCase().trim(), String(name).trim().slice(0, 80) || email, role, hashPassword(password));
    return Number(r.lastInsertRowid);
  } catch (e) {
    if (String(e.message).includes('UNIQUE')) throw new HttpError(409, 'Bu e-posta zaten kayıtlı');
    throw e;
  }
};

const LOCK_MAX = 5;
const LOCK_WINDOW_MIN = 15;

const recentFailures = (email, ip) =>
  q.get(
    `SELECT COUNT(*) AS n FROM login_attempts WHERE ok = 0 AND ts > datetime('now', ?) AND (email = ? OR ip = ?)`,
    `-${LOCK_WINDOW_MIN} minutes`,
    email,
    ip,
  ).n;

/** E-posta + parola doğrular (kilit/hız sınırı dahil); oturum AÇMAZ. 2 adımlı doğrulama gerekiyorsa çağıran taraf karar verir. */
export const checkCredentials = (email, password, ip) => {
  email = String(email ?? '').toLowerCase().trim();
  if (recentFailures(email, ip) >= LOCK_MAX) {
    throw new HttpError(429, `Çok fazla başarısız deneme. ${LOCK_WINDOW_MIN} dakika sonra tekrar deneyin.`);
  }
  const user = q.get('SELECT * FROM users WHERE email = ?', email);
  // Kullanıcı yokken de aynı maliyette hash hesapla (zamanlama farkıyla kullanıcı keşfini önler)
  const ok = user ? verifyPassword(String(password ?? ''), user.pass_hash) : (verifyPassword('x', hashPassword('y')), false);
  q.run('INSERT INTO login_attempts (ip, email, ok) VALUES (?,?,?)', ip, email, ok && user?.active ? 1 : 0);
  if (!ok || !user.active) {
    audit({ email }, 'giris.basarisiz', email, '', ip);
    throw new HttpError(401, 'E-posta veya parola hatalı');
  }
  return user;
};

export const login = (email, password, ip, ua) => createSession(checkCredentials(email, password, ip), ip, ua);

/** remember=true: "Beni hatırla" — oturum 30 güne kadar sürer (2 adımlı doğrulama açıksa yine kod istenir) */
export const createSession = (user, ip, ua, remember = false) => {
  const hours = remember ? 24 * 30 : config.sessionHours;
  const email = user.email;
  const token = crypto.randomBytes(32).toString('base64url');
  const csrf = crypto.randomBytes(24).toString('base64url');
  q.run(`INSERT INTO sessions (id, user_id, csrf, expires_at, ip, ua) VALUES (?,?,?,datetime('now', ?),?,?)`, sha(token), user.id, csrf, `+${hours} hours`, ip, String(ua ?? '').slice(0, 200));
  q.run(`UPDATE users SET last_login = datetime('now') WHERE id = ?`, user.id);
  q.run(`DELETE FROM sessions WHERE expires_at < datetime('now')`);
  audit(user, 'giris', email, '', ip);
  return { user, cookie: cookieHeader(SID, token, { maxAgeSec: hours * 3600, path: '/' }) };
};

export const logout = (req) => {
  const token = parseCookies(req)[SID];
  if (token) q.run('DELETE FROM sessions WHERE id = ?', sha(token));
  return cookieHeader(SID, '', { maxAgeSec: 0, path: '/' });
};

/** İstekten oturum + kullanıcıyı çözer. CSRF: durum değiştiren isteklerde X-CSRF-Token zorunlu. */
export const authenticate = (req, { requireCsrf = false } = {}) => {
  const token = parseCookies(req)[SID];
  if (!token) return null;
  const row = q.get(
    `SELECT s.id AS sid, s.csrf, u.* FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.id = ? AND s.expires_at > datetime('now') AND u.active = 1`,
    sha(token),
  );
  if (!row) return null;
  if (requireCsrf) {
    const sent = String(req.headers['x-csrf-token'] ?? '');
    const a = Buffer.from(sent), b = Buffer.from(row.csrf);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) throw new HttpError(403, 'Oturum doğrulaması başarısız (CSRF). Sayfayı yenileyin.');
  }
  return { id: row.id, email: row.email, name: row.name, role: row.role, csrf: row.csrf, sid: row.sid };
};

export const requireUser = (req, opts) => {
  const u = authenticate(req, { requireCsrf: !['GET', 'HEAD'].includes(req.method) && opts?.csrf !== false });
  if (!u) throw new HttpError(401, 'Oturum gerekli');
  return u;
};

export const requireAdmin = (req) => {
  const u = requireUser(req);
  if (u.role !== 'admin') throw new HttpError(403, 'Bu işlem için yönetici yetkisi gerekir');
  return u;
};

export const revokeUserSessions = (userId, exceptSid) =>
  q.run('DELETE FROM sessions WHERE user_id = ? AND id != ?', userId, exceptSid ?? '');

export const bootstrapAdmin = () => {
  if (userCount() === 0 && config.bootstrapEmail && config.bootstrapPassword) {
    createUser({ email: config.bootstrapEmail, name: 'Yönetici', role: 'admin', password: config.bootstrapPassword });
    audit(null, 'kurulum.ilk_yonetici', config.bootstrapEmail);
    console.log(`[kurulum] ilk yönetici oluşturuldu: ${config.bootstrapEmail}`);
  }
};
