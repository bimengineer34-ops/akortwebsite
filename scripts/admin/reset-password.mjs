// Sunucuda yönetici kurtarma aracı (e-posta çalışmıyorsa veya tüm yöneticiler kilitlendiyse).
//   npm run admin:reset -- kisi@firma.com                  → yeni rastgele parola üretir ve yazdırır
//   npm run admin:reset -- kisi@firma.com --password "Yeni.Parola1"
//   npm run admin:reset -- kisi@firma.com --no-2fa         → 2 adımlı doğrulamayı da kapatır (telefon kayıpsa)
//   npm run admin:reset -- yeni@firma.com --create         → yoksa yönetici hesabı oluşturur
// Yalnızca sunucuya erişimi olan kişi çalıştırabilir; açık oturumlar kapatılır, işlem etkinlik günlüğüne yazılır.
import crypto from 'node:crypto';
import { q, audit } from '../../server/lib/db.mjs';
import { createUser, hashPassword, validatePassword, validateEmail } from '../../server/lib/auth.mjs';
import '../../server/lib/totp.mjs'; // 2FA sütunlarının var olduğundan emin ol

const args = process.argv.slice(2);
const email = String(args.find((a) => !a.startsWith('--')) ?? '').toLowerCase().trim();
const opt = (name) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const flag = (name) => args.includes(`--${name}`);

if (!validateEmail(email)) {
  console.error('Kullanım: npm run admin:reset -- <e-posta> [--password "..."] [--no-2fa] [--create]');
  process.exit(1);
}

const generated = `Akort-${crypto.randomBytes(9).toString('base64url')}-7`;
const password = opt('password') ?? generated;
const bad = validatePassword(password);
if (bad) {
  console.error(bad);
  process.exit(1);
}

const user = q.get('SELECT id FROM users WHERE email = ?', email);
if (!user) {
  if (!flag('create')) {
    console.error(`Kullanıcı bulunamadı: ${email} (oluşturmak için --create ekleyin)`);
    process.exit(1);
  }
  createUser({ email, name: 'Yönetici', role: 'admin', password });
  audit(null, 'cli.kullanici_olustur', email);
  console.log(`Yönetici oluşturuldu: ${email}`);
} else {
  q.run('UPDATE users SET pass_hash = ?, active = 1 WHERE id = ?', hashPassword(password), user.id);
  q.run('DELETE FROM sessions WHERE user_id = ?', user.id);
  q.run('DELETE FROM login_attempts WHERE email = ?', email);
  if (flag('no-2fa')) q.run("UPDATE users SET totp_enabled = 0, totp_secret = NULL, recovery_codes = '[]' WHERE id = ?", user.id);
  audit(null, 'cli.parola_sifirla', email, flag('no-2fa') ? '2FA kapatıldı' : '');
  console.log(`Parola sıfırlandı: ${email}${flag('no-2fa') ? ' (2 adımlı doğrulama kapatıldı)' : ''}`);
}
if (!opt('password')) console.log(`Yeni parola: ${password}\n(Girişten sonra panelde Hesabım › Parolayı değiştir ile kendi parolanızı belirleyin.)`);
