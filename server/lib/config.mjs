// Sunucu yapılandırması — ortam değişkenleriyle (bkz. .env.example / docs/DEPLOY.md)
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

// .env dosyası (varsa) — bağımlılıksız basit okuyucu; gerçek ortam değişkenleri önceliklidir
const envFile = path.join(ROOT, '.env');
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

const abs = (p, fallback) => path.resolve(ROOT, p || fallback);

export const config = {
  port: Number(process.env.PORT || 4321),
  host: process.env.HOST || '0.0.0.0',
  /** Canlıda HTTPS arkasında true olmalı (çerezler Secure olur) */
  secureCookies: process.env.SECURE_COOKIES === 'true' || process.env.NODE_ENV === 'production',
  /** Reverse proxy (nginx) arkasında istemci IP'si için X-Forwarded-For'a güven */
  trustProxy: process.env.TRUST_PROXY === 'true',
  dataDir: abs(process.env.DATA_DIR, 'data'),
  siteDir: abs(process.env.SITE_DIR, 'dist'),
  stagingDir: abs(process.env.STAGING_DIR, 'dist-staging'),
  previousDir: abs(process.env.PREVIOUS_DIR, 'dist-previous'),
  siteUrl: process.env.PUBLIC_SITE_URL || 'https://www.akortmuhendislik.com',
  sessionHours: Number(process.env.SESSION_HOURS || 12),
  maxUploadMb: Number(process.env.MAX_UPLOAD_MB || 25),
  /** İlk kurulum: ADMIN_EMAIL + ADMIN_PASSWORD verilirse ilk yönetici otomatik oluşturulur (aksi halde /yonetim kurulum ekranı) */
  bootstrapEmail: (process.env.ADMIN_EMAIL || '').trim().toLowerCase(),
  bootstrapPassword: process.env.ADMIN_PASSWORD || '',
};

export const paths = {
  db: path.join(config.dataDir, 'akort.db'),
  defaults: path.join(config.dataDir, 'defaults'),
  published: path.join(config.dataDir, 'content', 'published'),
  media: path.join(config.dataDir, 'media'),
  backups: path.join(config.dataDir, 'backups'),
  contentBlog: path.join(ROOT, 'src', 'content', 'blog'),
  contentProjects: path.join(ROOT, 'src', 'content', 'projects'),
  iconsDir: path.join(ROOT, 'src', 'assets', 'icons'),
  adminUi: path.join(ROOT, 'server', 'admin'),
};

for (const d of [config.dataDir, paths.defaults, paths.published, paths.media, paths.backups]) fs.mkdirSync(d, { recursive: true });
