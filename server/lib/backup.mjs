// Yedekleme: veritabanı anlık görüntüsü + yayın içerikleri + medya → tek .zip (depolama modu, bağımsız yazıcı)
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { db, audit } from './db.mjs';
import { paths } from './config.mjs';
import { HttpError } from './http.mjs';

const crc32 = zlib.crc32 ?? ((buf) => {
  let c, crc = ~0;
  for (let i = 0; i < buf.length; i++) {
    c = (crc ^ buf[i]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? (c >>> 1) ^ 0xedb88320 : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return ~crc >>> 0;
});

const walk = (dir, base = dir) => {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p, base));
    else out.push({ abs: p, rel: path.relative(base, p).split(path.sep).join('/') });
  }
  return out;
};

const dosTime = (d) => ({ time: (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1), date: ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate() });

/** Dosya listesinden ZIP (deflate) oluşturur ve hedef yola yazar. */
const writeZip = (entries, target) => {
  const fd = fs.openSync(target, 'w');
  const central = [];
  let offset = 0;
  const now = dosTime(new Date());
  for (const e of entries) {
    const data = e.data ?? fs.readFileSync(e.abs);
    const comp = zlib.deflateRawSync(data, { level: 6 });
    const useDeflate = comp.length < data.length;
    const body = useDeflate ? comp : data;
    const name = Buffer.from(e.rel, 'utf8');
    const crc = crc32(data);
    const header = Buffer.alloc(30);
    header.writeUInt32LE(0x04034b50, 0);
    header.writeUInt16LE(20, 4);
    header.writeUInt16LE(0x0800, 6); // UTF-8 dosya adı
    header.writeUInt16LE(useDeflate ? 8 : 0, 8);
    header.writeUInt16LE(now.time, 10);
    header.writeUInt16LE(now.date, 12);
    header.writeUInt32LE(crc, 14);
    header.writeUInt32LE(body.length, 18);
    header.writeUInt32LE(data.length, 22);
    header.writeUInt16LE(name.length, 26);
    fs.writeSync(fd, header);
    fs.writeSync(fd, name);
    fs.writeSync(fd, body);
    central.push({ name, crc, csize: body.length, size: data.length, method: useDeflate ? 8 : 0, offset });
    offset += 30 + name.length + body.length;
  }
  const cdStart = offset;
  for (const c of central) {
    const h = Buffer.alloc(46);
    h.writeUInt32LE(0x02014b50, 0);
    h.writeUInt16LE(20, 4);
    h.writeUInt16LE(20, 6);
    h.writeUInt16LE(0x0800, 8);
    h.writeUInt16LE(c.method, 10);
    h.writeUInt16LE(now.time, 12);
    h.writeUInt16LE(now.date, 14);
    h.writeUInt32LE(c.crc, 16);
    h.writeUInt32LE(c.csize, 20);
    h.writeUInt32LE(c.size, 24);
    h.writeUInt16LE(c.name.length, 28);
    h.writeUInt32LE(c.offset, 42);
    fs.writeSync(fd, h);
    fs.writeSync(fd, c.name);
    offset += 46 + c.name.length;
  }
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(central.length, 8);
  end.writeUInt16LE(central.length, 10);
  end.writeUInt32LE(offset - cdStart, 12);
  end.writeUInt32LE(cdStart, 16);
  fs.writeSync(fd, end);
  fs.closeSync(fd);
};

export const createBackup = (user) => {
  const stamp = new Date().toISOString().replace(/[:T]/g, '-').slice(0, 19);
  const snap = path.join(paths.backups, `.snap-${stamp}.db`);
  db.exec(`VACUUM INTO '${snap.replace(/'/g, "''")}'`);
  const entries = [
    { rel: 'akort.db', abs: snap },
    ...walk(path.join(paths.published, '..'), path.join(paths.published, '..')).map((f) => ({ ...f, rel: `content/${f.rel}` })),
    ...walk(paths.media).map((f) => ({ ...f, rel: `media/${f.rel}` })),
  ];
  const name = `akort-yedek-${stamp}.zip`;
  writeZip(entries, path.join(paths.backups, name));
  fs.rmSync(snap, { force: true });
  // son 15 yedeği tut
  const all = listBackups();
  for (const old of all.slice(15)) fs.rmSync(path.join(paths.backups, old.name), { force: true });
  audit(user, 'yedek.olustur', name);
  return name;
};

export const listBackups = () =>
  fs
    .readdirSync(paths.backups)
    .filter((f) => /^akort-yedek-.*\.zip$/.test(f))
    .map((f) => ({ name: f, size: fs.statSync(path.join(paths.backups, f)).size, at: fs.statSync(path.join(paths.backups, f)).mtime.toISOString() }))
    .sort((a, b) => b.at.localeCompare(a.at));

export const backupPath = (name) => {
  if (!/^akort-yedek-[0-9-]+\.zip$/.test(name)) throw new HttpError(400, 'Geçersiz yedek adı');
  const p = path.join(paths.backups, name);
  if (!fs.existsSync(p)) throw new HttpError(404, 'Yedek bulunamadı');
  return p;
};
