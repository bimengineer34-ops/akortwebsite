// BIM Viewer çalışma dosyalarını kurulu paket sürümlerinden public/bim/ altına kopyalar.
// Neden: @thatopen kütüphaneleri varsayılan olarak worker ve WASM dosyalarını unpkg.com'dan çeker (üçüncü taraf istek,
// gizlilik + çevrimdışı çalışmama riski). Burada kendi sitemizden sunulur; sürümler her zaman kurulu paketle eşleşir.
// dev/build öncesi otomatik çalışır (package.json). Çıktı repoya eklenmez (.gitignore: public/bim).
import { copyFileSync, mkdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const root = fileURLToPath(new URL('..', import.meta.url));
const out = join(root, 'public', 'bim');
const files = [
  ['node_modules/@thatopen/fragments/dist/Worker/worker.mjs', 'worker.mjs'],
  ['node_modules/web-ifc/web-ifc.wasm', 'web-ifc.wasm'],
];

mkdirSync(out, { recursive: true });
for (const [from, to] of files) {
  const src = join(root, from);
  if (!existsSync(src)) {
    console.warn(`[bim-assets] bulunamadı: ${from} — npm install çalıştırın.`);
    continue;
  }
  copyFileSync(src, join(out, to));
}
console.log('[bim-assets] public/bim güncellendi (worker.mjs, web-ifc.wasm)');
