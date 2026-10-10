// Panelden alınan yedeği (.zip) geri yükler. SUNUCU DURDURULMUŞ olmalıdır.
//   npm run admin:restore -- data/backups/akort-yedek-2026-10-10-12-00-00.zip --yes
// Mevcut veritabanı silinmez: data/akort.db.once-<zaman> olarak saklanır. Geri yüklemeden sonra sunucuyu başlatıp
// panelde Yayın › "Yeniden derle" çalıştırın (yayınlanmış içerik ve medya yedekten gelir).
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const dataDir = path.resolve(ROOT, process.env.DATA_DIR || 'data');
const zipPath = process.argv.slice(2).find((a) => !a.startsWith('--'));
if (!zipPath || !process.argv.includes('--yes')) {
  console.error('Kullanım: npm run admin:restore -- <yedek.zip> --yes   (sunucu durdurulmuş olmalı)');
  process.exit(1);
}
const buf = fs.readFileSync(path.resolve(zipPath));

// Merkezi dizini oku
let eocd = -1;
for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) {
  if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
}
if (eocd < 0) throw new Error('Geçerli bir zip değil');
const count = buf.readUInt16LE(eocd + 10);
let off = buf.readUInt32LE(eocd + 16);
const entries = [];
for (let n = 0; n < count; n++) {
  if (buf.readUInt32LE(off) !== 0x02014b50) throw new Error('Zip merkezi dizini bozuk');
  const method = buf.readUInt16LE(off + 10);
  const csize = buf.readUInt32LE(off + 20);
  const nameLen = buf.readUInt16LE(off + 28);
  const extraLen = buf.readUInt16LE(off + 30);
  const commentLen = buf.readUInt16LE(off + 32);
  const local = buf.readUInt32LE(off + 42);
  const name = buf.subarray(off + 46, off + 46 + nameLen).toString('utf8');
  entries.push({ name, method, csize, local });
  off += 46 + nameLen + extraLen + commentLen;
}

const stamp = new Date().toISOString().replace(/[:T]/g, '-').slice(0, 19);
const dbFile = path.join(dataDir, 'akort.db');
for (const ext of ['', '-wal', '-shm']) {
  const f = dbFile + ext;
  if (fs.existsSync(f)) fs.renameSync(f, ext ? f : `${f}.once-${stamp}`);
}
for (const ext of ['-wal', '-shm']) fs.rmSync(dbFile + ext, { force: true });

let restored = 0;
for (const e of entries) {
  if (e.name.endsWith('/')) continue;
  // Yol gezinme (zip-slip) koruması: yalnızca bilinen kökler ve data/ altına yazılır
  if (!/^(akort\.db|content\/|media\/)/.test(e.name)) { console.warn('atlandı:', e.name); continue; }
  const target = path.resolve(dataDir, e.name);
  if (!target.startsWith(dataDir + path.sep)) { console.warn('güvensiz yol atlandı:', e.name); continue; }
  const nlen = buf.readUInt16LE(e.local + 26);
  const xlen = buf.readUInt16LE(e.local + 28);
  const start = e.local + 30 + nlen + xlen;
  const raw = buf.subarray(start, start + e.csize);
  const data = e.method === 8 ? zlib.inflateRawSync(raw) : raw;
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, data);
  restored++;
}
console.log(`Geri yüklendi: ${restored} dosya → ${dataDir}\nEski veritabanı: akort.db.once-${stamp}\nSıradaki adım: sunucuyu başlatın ve panelde Yayın › "Yeniden derle" çalıştırın.`);
