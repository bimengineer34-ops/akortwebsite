// Yerel test ortamı: GERÇEK verinize dokunmayan, ayrı veri klasörlü bir AKORT örneği (varsayılan: http://localhost:4500).
//   npm run local:test            → başlatır (veri .local-test/ altında kalıcıdır)
//   npm run local:test -- --reset → test verisini sıfırlayıp baştan başlatır
// - AI Orchestra için SAHTE model açıktır (API anahtarı gerekmez; üretilen metin yer tutucudur, gerçek içerik kalitesini göstermez).
// - Giriş bilgisi .local-test/giris.txt dosyasındadır (git'e girmez; bu betik parolayı ekrana yazmaz).
// - Blog/proje girdileri depodaki src/content altına yazılır (panel içeriği ise test klasörüne): test taslaklarını panelden silin.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dir = path.join(ROOT, '.local-test');
const port = Number(process.env.LOCAL_TEST_PORT || 4500);
if (process.argv.includes('--reset')) fs.rmSync(dir, { recursive: true, force: true });
fs.mkdirSync(path.join(dir, 'data'), { recursive: true });

const dist = path.join(ROOT, 'dist');
if (!fs.existsSync(path.join(dist, 'index.html'))) { console.error('dist/ yok — önce "npm run build" (veya "npx astro build") çalıştırın.'); process.exit(1); }
const site = path.join(dir, 'site');
const stamp = fs.statSync(path.join(dist, 'index.html')).mtimeMs;
const stampFile = path.join(dir, '.site-stamp');
if (!fs.existsSync(site) || fs.readFileSync(stampFile, 'utf8').trim() !== String(stamp)) {
  fs.rmSync(site, { recursive: true, force: true });
  fs.cpSync(dist, site, { recursive: true });
  fs.writeFileSync(stampFile, String(stamp));
}
const defaults = path.join(ROOT, 'data', 'defaults');
const tDefaults = path.join(dir, 'data', 'defaults');
if (fs.existsSync(defaults) && !fs.existsSync(tDefaults)) fs.cpSync(defaults, tDefaults, { recursive: true });

const credFile = path.join(dir, 'giris.txt');
if (!fs.existsSync(credFile)) {
  const pass = `Test-${crypto.randomBytes(6).toString('hex')}-Aa1`;
  fs.writeFileSync(credFile, `E-posta: test@akort.test\nParola:  ${pass}\n(Yalnızca bu yerel test ortamı içindir.)\n`);
}
const pass = /Parola:\s+(\S+)/.exec(fs.readFileSync(credFile, 'utf8'))[1];

console.log(`\nAKORT yerel test ortamı → http://localhost:${port}`);
console.log(`  Site:   http://localhost:${port}/`);
console.log(`  Panel:  http://localhost:${port}/yonetim/   (giriş bilgisi: ${path.relative(ROOT, credFile)})`);
console.log('  AI Orchestra: sahte model AÇIK (anahtar gerekmez). Durdurmak için Ctrl+C.\n');

const child = spawn(process.execPath, ['server/index.mjs'], {
  cwd: ROOT, stdio: 'inherit',
  env: {
    ...process.env, PORT: String(port), HOST: '127.0.0.1', NODE_ENV: '',
    DATA_DIR: path.join(dir, 'data'), SITE_DIR: site, STAGING_DIR: path.join(dir, 'stg'), PREVIOUS_DIR: path.join(dir, 'prev'),
    ADMIN_EMAIL: 'test@akort.test', ADMIN_PASSWORD: pass, ORCH_FAKE_LLM: '1', AUTO_BACKUP: 'false',
  },
});
child.on('exit', (c) => process.exit(c ?? 0));
for (const s of ['SIGINT', 'SIGTERM']) process.on(s, () => child.kill(s));
