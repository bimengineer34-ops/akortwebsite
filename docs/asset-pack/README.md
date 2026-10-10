# AKORT WEB ASSET PACK V1

Bu paket, onaylı AKORT sayfa tasarımlarını Claude Code ile mevcut Astro/AstroWind/Tailwind sitesine entegre etmek için hazırlanmıştır.

## Önemli
- `00_REFERENCE_PAGES` klasöründeki 7 tam sayfa görseli **tasarımın sabit referansıdır**.
- `01_IMAGES` içindeki JPG dosyaları, onaylı kompozitlerden ayrıştırılmış **referans crop** dosyalarıdır. Bunlar özgün yüksek çözünürlüklü kaynak fotoğraf değildir. Mevcut projede aynı/orijinal yüksek çözünürlüklü görsel varsa onu kullan.
- `02_ICONS` altındaki SVG'ler AKORT'un ince mavi çizgisel görsel diline uygun, uygulamada kullanılabilir yeniden çizilmiş ikonlardır.
- `03_GRAPHICS` altında BIM wireframe, blueprint grid ve CTA wave gibi dekoratif SVG'ler vardır.

Claude, referans ekranları yeniden tasarlamamalı; layout, spacing, renk ve görsel hiyerarşiyi aynen korumalıdır.
