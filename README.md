# AKORT Mühendislik — Web Sitesi ve Yönetim Paneli

Özel tasarım (hazır tema yok). **Astro 7 + Tailwind CSS 4 + TypeScript (strictest)** ile statik site; aynı sunucuda çalışan küçük bir **Node sunucusu** yönetim panelini (`/yonetim`) ve form uç noktalarını sunar.

- Site: 100 sayfa (ana sayfa, hakkımızda, 78 hizmet, 8 uzmanlık alanı, projeler, blog, iletişim, çalışma modeli, yasal sayfalar, arama, BIM görüntüleyici)
- Panel: sayfa metinleri, blog/proje, medya, form talepleri, bülten, yayın, yönlendirmeler, kullanıcılar, 2 adımlı doğrulama, yedek, ziyaret istatistikleri
- Tasarım kaynağı: `docs/reference/` (onaylı 7 sayfa). İçerik ilkesi: **doğrulanmamış bilgi canlıda gösterilmez** (`docs/TODO.md`).

## Hızlı başlangıç (yerel)

```bash
npm install            # Node ≥ 22.12 gerekir
cp .env.example .env   # ADMIN_EMAIL / ADMIN_PASSWORD ile ilk yönetici otomatik kurulur
npm run build          # siteyi derler (dist/)
npm run start          # site + panel → http://localhost:4321  (panel: /yonetim/)
```

Geliştirme: `npm run dev` (yalnızca Astro, panel yok), `npm run check` (tip denetimi), `npm run audit:seo` (build sonrası SEO denetimi).

## Komutlar

| Komut | Açıklama |
|---|---|
| `npm run dev` | Astro geliştirme sunucusu |
| `npm run build` | Tip denetimi + derleme → `dist/` |
| `npm run start` | Üretim sunucusu (site + panel + API) |
| `npm run audit:seo` | Tüm sayfalarda başlık, açıklama, şema, canonical denetimi |
| `npm run admin:reset -- <e-posta>` | Sunucuda yönetici parolası sıfırlama (bkz. `docs/DEPLOY.md`) |
| `npm run admin:restore -- <yedek.zip> --yes` | Panelden alınan yedeği geri yükleme (sunucu durdurulmuşken) |

## Klasörler

| Yol | İçerik |
|---|---|
| `src/pages/` | Sayfalar (hizmet ve sektör sayfaları tek şablondan: `hizmetler/[slug].astro`, `uzmanlik-alanlari/[slug].astro`) |
| `src/data/` | Varsayılan içerik. Her dışa aktarım `ov()` ile sarılıdır; panelden yayınlanan değişiklikler bunun üstüne biner (`src/utils/overrides.ts`) |
| `src/data/serviceContent/` | 78 hizmet + 8 sektör kaydı (özet, kapsam, çıktılar, SSS…) |
| `src/content/` | Blog, projeler, yasal metinler (Markdown) — panelden düzenlenir |
| `src/components/` | Arayüz bileşenleri |
| `server/` | Node sunucusu, API ve yönetim arayüzü (`server/admin/`) |
| `scripts/` | SEO denetimi, BIM varlıkları, yönetici araçları |
| `data/` | **Çalışma verisi** (veritabanı, yedekler, yüklemeler) — git'e girmez, yedeklenmelidir |
| `docs/` | Dokümantasyon |

## Dokümanlar

- `docs/DEPLOY.md` — Veridyen/Linux sunucuya kurulum, nginx, systemd, SMTP, yedek/geri yükleme, parola sıfırlama
- `docs/SECURITY.md` — güvenlik önlemleri, sunucuda yapılacaklar, sınırlar
- `docs/ADMIN_PLAN.md` — panel mimarisi
- `docs/TODO.md` — **sizden beklenen içerik ve görseller, firma onayları** (yayın öncesi kontrol listesi)
- `docs/CONTENT_ARCHITECTURE.md`, `docs/ASSISTANT.md`, `docs/BIM_VIEWER.md` — alt sistemler
- `docs/IMAGE_PACKAGE_PROMPT.md`, `docs/IMAGE_PROMPTS.md` — görsel üretim promptları

## Yayın akışı (özet)

1. Panelden içeriği düzenle → **Taslağı kaydet**
2. **Yayın** sayfasında **Yayınla** → site geçici klasörde derlenir; başarılıysa canlıya geçer (hata olursa canlı site değişmez, önceki yayına dönülebilir)

Kod değişikliği için: `git pull && npm ci && npm run build` ve servisi yeniden başlatın. `data/` ve `src/content/` klasörlerini ezmeyin.
