// AKORT sunucusu: statik site (dist) + yönetim paneli (/yonetim) + API (/api) — tek süreç, tek port.
// Başlatma: `npm run start` (Node ≥ 22.12). Ayrıntı: docs/DEPLOY.md
import http from 'node:http';
import path from 'node:path';
import fs from 'node:fs';
import { config, paths } from './lib/config.mjs';
import './lib/db.mjs';
import { HttpError, sendJson, baseHeaders, clientIp, rateLimit } from './lib/http.mjs';
import { dispatch } from './lib/api.mjs';
import { resolveFile, serveFile } from './lib/static.mjs';
import { mediaFilePath, MIME_BY_EXT } from './lib/media.mjs';
import { legacyEnRedirect } from './lib/ext/i18n.mjs';
import { bootstrapAdmin } from './lib/auth.mjs';
import { startScheduler } from './lib/ext/intel.mjs';
import { ensureInitialBuild } from './lib/build.mjs';
import { audit } from './lib/db.mjs';
import { matchRedirect } from './lib/redirects.mjs';
import { recordView, pruneStats } from './lib/stats.mjs';
import { createBackup, listBackups } from './lib/backup.mjs';

const ADMIN_CSP = "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'";

const serveAdmin = (req, res, pathname) => {
  const rel = pathname.replace(/^\/yonetim\/?/, '');
  const hit = rel ? resolveFile(paths.adminUi, rel, { clean: false }) : null;
  const target = hit ?? resolveFile(paths.adminUi, 'index.html', { clean: false });
  if (!target) return sendJson(res, 404, { error: 'Yönetim arayüzü bulunamadı' });
  serveFile(req, res, target, {
    cache: 'no-cache',
    extra: { 'Content-Security-Policy': ADMIN_CSP, 'X-Robots-Tag': 'noindex, nofollow', 'X-Frame-Options': 'DENY' },
  });
};

// Herkese açık site: Astro sayfa içi (inline) betik/stil ürettiği için 'unsafe-inline' gerekir; dış kaynak yükleme, çerçeveleme,
// <base>/form hedef değiştirme ve eklenti (object) kapalı. BIM görüntüleyici için wasm + worker izinleri; harita yalnızca Google.
const SITE_CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "worker-src 'self' blob:",
  "media-src 'self'",
  'frame-src https://www.google.com',
  "frame-ancestors 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join('; ');
/** CSP_MODE: enforce (varsayılan) | report-only (yalnızca tarayıcı konsoluna uyarı) | off */
const CSP_MODE = process.env.CSP_MODE || 'enforce';
const siteCsp = () => (CSP_MODE === 'off' ? {} : { [CSP_MODE === 'report-only' ? 'Content-Security-Policy-Report-Only' : 'Content-Security-Policy']: SITE_CSP });
const MEDIA_CSP = "default-src 'none'; img-src 'self'; media-src 'self'; style-src 'unsafe-inline'; sandbox";

const serveSite = (req, res, pathname) => {
  const hit = resolveFile(config.siteDir, pathname);
  if (hit) {
    const immutable = pathname.startsWith('/_astro/');
    const isHtml = hit.file.endsWith('.html');
    if (isHtml && !hit.file.endsWith('404.html')) recordView(req, pathname, req.headers.host);
    return serveFile(req, res, hit, { cache: immutable ? 'public, max-age=31536000, immutable' : 'public, max-age=3600', extra: isHtml ? siteCsp() : {} });
  }
  // Eski/Türkçe biçimli İngilizce adres → güncel adrese kalıcı yönlendirme
  const moved = pathname.startsWith('/en/') ? legacyEnRedirect(pathname) : null;
  if (moved && resolveFile(config.siteDir, moved)) {
    res.writeHead(301, baseHeaders({ Location: moved + (req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : ''), 'Cache-Control': 'public, max-age=3600' }));
    return res.end();
  }
  const nf = resolveFile(config.siteDir, '404.html', { clean: false });
  if (nf) {
    const body = fs.readFileSync(nf.file);
    res.writeHead(404, baseHeaders({ 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache', ...siteCsp() }));
    return res.end(req.method === 'HEAD' ? undefined : body);
  }
  res.writeHead(404, baseHeaders({ 'Content-Type': 'text/plain; charset=utf-8' }));
  res.end('Sayfa bulunamadı');
};

const server = http.createServer(async (req, res) => {
  try {
    if (!['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) throw new HttpError(405, 'Yöntem desteklenmiyor');
    const host = String(req.headers.host ?? 'localhost');
    if (!/^[a-z0-9.\-:[\]]{1,255}$/i.test(host) || String(req.url).length > 2048) throw new HttpError(400, 'Geçersiz istek');
    const url = new URL(req.url, `http://${host}`);
    const pathname = url.pathname;

    if (pathname.startsWith('/api/')) {
      // Genel hız sınırı (IP başına dakikada 300 API isteği); giriş denemeleri ayrıca kısıtlanır
      if (!rateLimit(`api:${clientIp(req)}`, 300, 60_000)) throw new HttpError(429, 'Çok fazla istek. Lütfen biraz bekleyin.');
      // Durum değiştiren isteklerde Origin aynı sunucudan olmalı (CSRF'ye ek katman; tarayıcılar Origin'i her zaman gönderir)
      if (req.method !== 'GET' && req.method !== 'HEAD') {
        const origin = req.headers.origin;
        if (origin) {
          let oh = '';
          try {
            oh = new URL(origin).host;
          } catch {
            /* geçersiz Origin */
          }
          if (oh !== host) throw new HttpError(403, 'İstek kaynağı reddedildi');
        }
      }
      return await dispatch(req, res, url);
    }

    if (pathname === '/yonetim' || pathname.startsWith('/yonetim/')) {
      if (pathname === '/yonetim') {
        res.writeHead(301, { Location: '/yonetim/' });
        return res.end();
      }
      return serveAdmin(req, res, pathname);
    }

    if (pathname.startsWith('/medya/')) {
      const file = mediaFilePath(pathname.slice('/medya/'.length));
      if (!file) return serveSite(req, res, '/__yok__');
      const ext = path.extname(file).slice(1).toLowerCase();
      return serveFile(req, res, { file, stat: fs.statSync(file) }, { cache: 'public, max-age=31536000, immutable', extra: { 'Content-Type': MIME_BY_EXT[ext] ?? 'application/octet-stream', 'Content-Security-Policy': MEDIA_CSP } });
    }

    if (req.method !== 'GET' && req.method !== 'HEAD') throw new HttpError(405, 'Yöntem desteklenmiyor');
    const rd = matchRedirect(pathname);
    if (rd) {
      res.writeHead(rd.code, { Location: rd.to + (rd.to.includes('?') ? '' : url.search), 'Cache-Control': rd.code === 301 ? 'public, max-age=3600' : 'no-store' });
      return res.end();
    }
    return serveSite(req, res, pathname);
  } catch (err) {
    if (res.headersSent) return res.end();
    if (err instanceof HttpError) return sendJson(res, err.status, { error: err.message, ...(err.extra ?? {}) });
    console.error('[hata]', req.method, req.url, err);
    audit(null, 'sunucu.hata', `${req.method} ${req.url}`, String(err?.message ?? err).slice(0, 300), clientIp(req));
    return sendJson(res, 500, { error: 'Sunucu hatası' });
  }
});

server.requestTimeout = 120_000;
server.headersTimeout = 20_000;
server.keepAliveTimeout = 10_000;

bootstrapAdmin();
startScheduler();
pruneStats();
setInterval(pruneStats, 24 * 3_600_000).unref();

// Otomatik yedek: son yedek 24 saatten eskiyse (veya hiç yoksa) alınır; açılışta ve her saat kontrol edilir. Son 15 yedek tutulur.
// Kapatmak için AUTO_BACKUP=false. Yedekler sunucuda kalır — sunucu dışına kopyalamak da gerekir (docs/DEPLOY.md).
const autoBackup = () => {
  if (process.env.AUTO_BACKUP === 'false') return;
  try {
    const last = listBackups()[0];
    if (!last || Date.now() - new Date(last.at).getTime() > 24 * 3_600_000) createBackup({ email: 'sistem' });
  } catch (e) {
    console.error('[yedek] otomatik yedek alınamadı:', e.message);
  }
};
setTimeout(autoBackup, 30_000).unref();
setInterval(autoBackup, 3_600_000).unref();
server.listen(config.port, config.host, () => {
  console.log(`AKORT sunucusu http://${config.host === '0.0.0.0' ? 'localhost' : config.host}:${config.port}  (panel: /yonetim)`);
  ensureInitialBuild().catch((e) => console.error('[yayın] başlangıç derlemesi hatası', e));
});

const shutdown = (sig) => {
  console.log(`\n${sig} alındı, kapatılıyor…`);
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 5000).unref();
};
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
