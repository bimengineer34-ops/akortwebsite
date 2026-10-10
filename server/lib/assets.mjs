// Panelde seçilen medyayı Astro görsel işlem hattına sokmak için src/assets/images/uploads altına kopyalar
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './config.mjs';
import { mediaFilePath } from './media.mjs';
import { HttpError } from './http.mjs';

export const uploadsDir = path.join(ROOT, 'src', 'assets', 'images', 'uploads');

/** `/medya/<dosya>` → uploads klasörüne kopyalanır; dosya adını döndürür. */
export const copyMediaToAssets = (name) => {
  const src = mediaFilePath(name);
  if (!src) throw new HttpError(400, `Seçilen medya bulunamadı: ${name}`);
  if (!/\.(png|jpe?g|webp)$/i.test(name)) throw new HttpError(400, 'Yalnızca PNG, JPG ve WEBP görseller site görseli olarak kullanılabilir');
  fs.mkdirSync(uploadsDir, { recursive: true });
  const dest = path.join(uploadsDir, name);
  if (!fs.existsSync(dest) || fs.statSync(dest).size !== fs.statSync(src).size) fs.copyFileSync(src, dest);
  return name;
};

/** Belge içindeki tüm `/medya/...` görsel başvurularını kopyalar. */
export const syncMediaRefs = (value) => {
  const walk = (v) => {
    if (typeof v === 'string') {
      const m = v.match(/^\/medya\/([a-z0-9][a-z0-9._-]*\.(?:png|jpe?g|webp))$/i);
      if (m) copyMediaToAssets(m[1]);
    } else if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === 'object') Object.values(v).forEach(walk);
  };
  walk(value);
};
