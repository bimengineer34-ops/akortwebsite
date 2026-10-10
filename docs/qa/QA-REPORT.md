# AKORT Web — QA Raporu (Faz 14–16)

Tarih: 2026-10-02 · Build: Astro 7.3.5 static · Ölçüm: production build (`dist/`, `astro preview`)

## 1. SEO denetimi (`npm run audit:seo`)

20 sayfa, **0 sorun**. Kontroller: benzersiz title (≤65) ve description (70–165), canonical = sayfa yolu,
tek H1, başlık seviyesi atlaması yok, tüm `<img>`'lerde `alt`, OG (title/description/url/locale) + Twitter Card,
JSON-LD parse, Organization + (iç sayfalarda) BreadcrumbList, `noindex` ↔ sitemap tutarlılığı.

| Sayfa grubu | Durum | Sitemap | Şema |
|---|---|---|---|
| `/`, `/hakkimizda`, `/hizmetler`, `/uzmanlik-alanlari`, `/projeler`, `/blog`, `/iletisim` | index | ✓ | Organization, WebSite (+SearchAction), sayfa tipi (AboutPage, ItemList, CollectionPage, Blog, ContactPage), BreadcrumbList |
| `/hizmetler/<slug>` (8) | noindex (içerik bekleniyor) | — | Service, BreadcrumbList |
| `/kvkk`, `/gizlilik-politikasi`, `/cerez-tercihleri` | noindex (metin bekleniyor) | — | BreadcrumbList |
| `/arama`, `/404` | noindex | — | BreadcrumbList |

İçerik yayınlandığında (blog yazısı, proje, hizmet metni, yasal metin) ilgili sayfalar otomatik olarak index + sitemap'e girer.

## 2. Responsive taraması

15 sayfa × 6 genişlik (375 / 480 / 768 / 1024 / 1280 / 1440) = **90 ölçüm, 0 yatay taşma** (development build, taslak içerik dahil — en dolu hal).

Dokunma hedefleri (375px): 24px altı yalnızca kart başlık linkleri — kartın tamamı `::after` ile tıklanabilir olduğu için gerçek hedef karttır.
Breadcrumb linki (15px) dikey dolgu ile büyütüldü.

Bu fazlarda bulunup düzeltilen responsive hatalar: header CTA'nın mobilde görünmesi (Faz 1), İletişim form kolonu `min-width`
ve harita `aspect-ratio`+`min-height` çakışması (Faz 12), 1024px'te dar kolonlu bantlar (Faz 6/8).

## 3. Lighthouse (mobil profil, Moto G Power emülasyonu, yavaş 4G)

| Sayfa | Perf | A11y | BP | SEO | LCP | CLS | TBT | Ağırlık |
|---|---|---|---|---|---|---|---|---|
| `/` | 100 | 100 | 100 | 100 | 1.2 s | 0 | 0 ms | 71 KiB |
| `/hakkimizda` | 100 | 100 | 100 | 100 | 1.2 s | 0 | 0 ms | 71 KiB |
| `/hizmetler` | 100 | 100 | 100 | 100 | 1.2 s | 0 | 0 ms | 72 KiB |
| `/uzmanlik-alanlari` | 100 | 100 | 100 | 100 | 1.2 s | 0 | 0 ms | 72 KiB |
| `/projeler` | 100 | 100 | 100 | 100 | 1.4 s | 0 | 0 ms | 70 KiB |
| `/blog` | 100 | 100 | 100 | 100 | 1.4 s | 0 | 0 ms | 70 KiB |
| `/iletisim` | 100 | 100 | 100 | 100 | 1.3 s | 0 | 0 ms | 73 KiB |
| `/hizmetler/bim-danismanligi` | 100 | 100 | 100 | 66* | 1.2 s | 0 | 0 ms | 68 KiB |
| `/arama` | 100 | 100 | 100 | 66* | 1.4 s | 0 | 10 ms | 69 KiB |
| `/kvkk` | 100 | 100 | 100 | 66* | 1.2 s | 0 | 0 ms | 67 KiB |

\* Bilinçli `noindex` → "is-crawlable" denetimi. İçerik onaylanınca 100 olur.

Bu fazda düzeltilenler:
- `--color-muted` #6B7685 → #5F6A79 (açık zeminlerde 4.28:1 → 5.10:1, WCAG AA).
- Logo sloganı accent-500 → accent-600 (beyaz üzerinde 4.03:1 → 5.54:1).
- `/favicon.ico` 404 konsol hatası (favicon gelene kadar boş ikon bildirimi).

### Önemli not — görseller

Ölçümler **gerçek görseller olmadan** yapıldı (TODO-ASSET yer tutucular). Hero ve kart görselleri eklendiğinde LCP elementi hero görseli olacak.
Hedefi korumak için hazır olan altyapı: `astro:assets` `<Picture>` (AVIF/WebP, `srcset`/`sizes`), hero'da `loading="eager"` + `fetchpriority="high"`,
diğerlerinde `loading="lazy"`, tüm görsellerde boyut/oran → CLS 0. Görseller geldiğinde Lighthouse tekrar çalıştırılmalı.

## 4. Sayfa ağırlığı (Ana Sayfa, production)

- HTML (inline SVG ikonlar dahil) + CSS (~47 KiB ham, tek dosya) + 2 woff2 font (latin + latin-ext, preload) ≈ 71 KiB aktarım.
- JavaScript: ayrı bundle yok; yalnızca sayfa içi küçük script'ler (mobil menü, teknik asistan, sayfa özel filtre/form).
- Üçüncü taraf istek: **yok** (harita yalnızca tıklayınca).
