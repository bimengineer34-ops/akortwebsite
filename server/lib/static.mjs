// Statik dosya sunumu (site çıktısı, yönetim arayüzü, medya) — ETag, önbellek, gzip
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { baseHeaders } from './http.mjs';

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.pdf': 'application/pdf',
  '.mp4': 'video/mp4',
  '.wasm': 'application/wasm',
  '.webmanifest': 'application/manifest+json',
  '.ifc': 'application/octet-stream',
};
const COMPRESSIBLE = new Set(['.html', '.css', '.js', '.mjs', '.json', '.xml', '.txt', '.svg', '.webmanifest', '.wasm']);

const gzCache = new Map(); // dosya → { mtime, buf }
let gzBytes = 0;
/** Speed Engine: bellekteki gzip önbelleğini boşaltır */
export const clearGzCache = () => { const n = gzCache.size; gzCache.clear(); gzBytes = 0; return n; };
const gz = (file, mtimeMs, data) => {
  const hit = gzCache.get(file);
  if (hit && hit.mtime === mtimeMs) return hit.buf;
  const buf = zlib.gzipSync(data, { level: 6 });
  if (gzBytes + buf.length < 60 * 1024 * 1024) {
    if (hit) gzBytes -= hit.buf.length;
    gzCache.set(file, { mtime: mtimeMs, buf });
    gzBytes += buf.length;
  }
  return buf;
};

const statFile = (p) => {
  try {
    const s = fs.statSync(p);
    return s.isFile() ? s : null;
  } catch {
    return null;
  }
};

/** İstek yolunu kök klasör altında güvenli biçimde çözer; temiz URL'ler (/hakkimizda → hakkimizda.html) desteklenir. */
export const resolveFile = (root, urlPath, { clean = true } = {}) => {
  let rel;
  try {
    rel = decodeURIComponent(urlPath);
  } catch {
    return null;
  }
  if (rel.includes('\0')) return null;
  const base = path.resolve(root);
  const full = path.resolve(base, '.' + path.posix.normalize('/' + rel));
  if (full !== base && !full.startsWith(base + path.sep)) return null;
  const candidates = [full];
  if (clean) candidates.push(full + '.html', path.join(full, 'index.html'));
  for (const c of candidates) {
    const s = statFile(c);
    if (s) return { file: c, stat: s };
  }
  return null;
};

export const serveFile = (req, res, { file, stat }, { cache = 'public, max-age=3600', extra = {} } = {}) => {
  const ext = path.extname(file).toLowerCase();
  const type = TYPES[ext] ?? 'application/octet-stream';
  const etag = `W/"${stat.size.toString(16)}-${Math.floor(stat.mtimeMs).toString(16)}"`;
  const headers = baseHeaders({ 'Content-Type': type, ETag: etag, 'Last-Modified': stat.mtime.toUTCString(), 'Cache-Control': ext === '.html' ? 'no-cache' : cache, Vary: 'Accept-Encoding', ...extra });
  if (req.headers['if-none-match'] === etag) {
    res.writeHead(304, headers);
    return res.end();
  }
  const wantsGz = COMPRESSIBLE.has(ext) && /\bgzip\b/.test(String(req.headers['accept-encoding'] ?? '')) && stat.size > 512;
  if (req.method === 'HEAD') {
    res.writeHead(200, { ...headers, 'Content-Length': stat.size });
    return res.end();
  }
  // Büyük/medya dosyaları akış olarak; Range desteği (video)
  if (!wantsGz && stat.size > 2 * 1024 * 1024) {
    const range = /bytes=(\d*)-(\d*)/.exec(String(req.headers.range ?? ''));
    if (range) {
      const start = range[1] ? Number(range[1]) : 0;
      const end = range[2] ? Math.min(Number(range[2]), stat.size - 1) : stat.size - 1;
      if (start > end || start >= stat.size) {
        res.writeHead(416, { 'Content-Range': `bytes */${stat.size}` });
        return res.end();
      }
      res.writeHead(206, { ...headers, 'Accept-Ranges': 'bytes', 'Content-Range': `bytes ${start}-${end}/${stat.size}`, 'Content-Length': end - start + 1 });
      return fs.createReadStream(file, { start, end }).pipe(res);
    }
    res.writeHead(200, { ...headers, 'Accept-Ranges': 'bytes', 'Content-Length': stat.size });
    return fs.createReadStream(file).pipe(res);
  }
  const data = fs.readFileSync(file);
  if (wantsGz) {
    const buf = gz(file, stat.mtimeMs, data);
    res.writeHead(200, { ...headers, 'Content-Encoding': 'gzip', 'Content-Length': buf.length });
    return res.end(buf);
  }
  res.writeHead(200, { ...headers, 'Content-Length': data.length });
  res.end(data);
};
