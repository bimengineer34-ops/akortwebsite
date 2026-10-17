// Sır kasası: API anahtarları AES-256-GCM ile şifreli saklanır, API'den asla geri döndürülmez, günlüğe yazılmaz.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { q, audit } from '../db.mjs';
import { config } from '../config.mjs';
import './schema.mjs';

const keyFile = path.join(config.dataDir, '.vault-key');
const masterKey = () => {
  if (process.env.SECRETS_KEY && process.env.SECRETS_KEY.length >= 24) return crypto.createHash('sha256').update(process.env.SECRETS_KEY).digest();
  if (!fs.existsSync(keyFile)) fs.writeFileSync(keyFile, crypto.randomBytes(32).toString('base64'), { mode: 0o600 });
  return Buffer.from(fs.readFileSync(keyFile, 'utf8').trim(), 'base64');
};
let KEY;
const key = () => (KEY ??= masterKey());

const encrypt = (plain) => {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', key(), iv);
  const ct = Buffer.concat([c.update(plain, 'utf8'), c.final()]);
  return `v1.${iv.toString('base64')}.${c.getAuthTag().toString('base64')}.${ct.toString('base64')}`;
};
const decrypt = (enc) => {
  const [v, iv, tag, ct] = String(enc).split('.');
  if (v !== 'v1') throw new Error('Bilinmeyen sır biçimi');
  const d = crypto.createDecipheriv('aes-256-gcm', key(), Buffer.from(iv, 'base64'));
  d.setAuthTag(Buffer.from(tag, 'base64'));
  return Buffer.concat([d.update(Buffer.from(ct, 'base64')), d.final()]).toString('utf8');
};

const mask = (s) => (s.length > 8 ? `${s.slice(0, 3)}…${s.slice(-4)}` : '••••');

export const setSecret = (name, value, user, { max = 600, min = 8 } = {}) => {
  const v = String(value ?? '').trim();
  if (v.length < min || v.length > max || /\s/.test(v)) throw Object.assign(new Error('Geçersiz anahtar biçimi'), { status: 400 });
  q.run(
    `INSERT INTO secrets (name, enc, hint, updated_by) VALUES (?,?,?,?)
     ON CONFLICT(name) DO UPDATE SET enc = excluded.enc, hint = excluded.hint, updated_at = datetime('now'), updated_by = excluded.updated_by`,
    name, encrypt(v), mask(v), user?.email ?? 'sistem',
  );
  audit(user, 'sir.kaydet', name); // değer günlüğe yazılmaz
};
export const getSecret = (name) => {
  const r = q.get('SELECT enc FROM secrets WHERE name = ?', name);
  if (!r) return null;
  try { return decrypt(r.enc); } catch { return null; }
};
export const hasSecret = (name) => !!q.get('SELECT 1 AS x FROM secrets WHERE name = ?', name);
export const secretMeta = (name) => q.get('SELECT hint, updated_at, updated_by FROM secrets WHERE name = ?', name) ?? null;
export const deleteSecret = (name, user) => {
  q.run('DELETE FROM secrets WHERE name = ?', name);
  audit(user, 'sir.sil', name);
};
