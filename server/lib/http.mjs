// HTTP yardımcıları: istek gövdesi, yanıtlar, çerez, istemci IP'si, güvenlik başlıkları
import { config } from './config.mjs';

export class HttpError extends Error {
  constructor(status, message, extra) {
    super(message);
    this.status = status;
    this.extra = extra;
  }
}

export const clientIp = (req) => {
  if (config.trustProxy) {
    const xf = req.headers['x-forwarded-for'];
    if (xf) return String(xf).split(',')[0].trim();
  }
  return req.socket.remoteAddress ?? '';
};

export const readBody = (req, limitBytes = 1024 * 1024) =>
  new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (c) => {
      size += c.length;
      if (size > limitBytes) {
        reject(new HttpError(413, 'İstek çok büyük'));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });

export const readJson = async (req, limitBytes) => {
  const buf = await readBody(req, limitBytes);
  if (!buf.length) return {};
  try {
    return JSON.parse(buf.toString('utf8'));
  } catch {
    throw new HttpError(400, 'Geçersiz JSON');
  }
};

export const baseHeaders = (extra = {}) => ({
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'X-Frame-Options': 'SAMEORIGIN',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'X-Permitted-Cross-Domain-Policies': 'none',
  ...(config.secureCookies ? { 'Strict-Transport-Security': 'max-age=31536000; includeSubDomains' } : {}),
  ...extra,
});

export const sendJson = (res, status, data, headers = {}) => {
  const body = JSON.stringify(data);
  res.writeHead(status, baseHeaders({ 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers }));
  res.end(body);
};

export const sendText = (res, status, text, type = 'text/plain; charset=utf-8', headers = {}) => {
  res.writeHead(status, baseHeaders({ 'Content-Type': type, ...headers }));
  res.end(text);
};

export const parseCookies = (req) => {
  const out = {};
  for (const part of String(req.headers.cookie ?? '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
};

export const cookieHeader = (name, value, { maxAgeSec, path = '/' } = {}) =>
  [
    `${name}=${encodeURIComponent(value)}`,
    `Path=${path}`,
    'HttpOnly',
    'SameSite=Strict',
    config.secureCookies ? 'Secure' : '',
    maxAgeSec !== undefined ? `Max-Age=${maxAgeSec}` : '',
  ]
    .filter(Boolean)
    .join('; ');

/** Basit bellek içi hız sınırlayıcı (pencere başına limit) — form uç noktaları için */
const buckets = new Map();
export const rateLimit = (key, limit, windowMs) => {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || now - b.start > windowMs) {
    buckets.set(key, { start: now, count: 1 });
    return true;
  }
  b.count += 1;
  return b.count <= limit;
};
setInterval(() => {
  const now = Date.now();
  for (const [k, b] of buckets) if (now - b.start > 3_600_000) buckets.delete(k);
}, 600_000).unref();
