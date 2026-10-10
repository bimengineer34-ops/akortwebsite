# AKORT Mühendislik — Web Sitesi

Özel tema, hazır tema yok. **Astro 7 + Tailwind CSS 4 + TypeScript (strictest)**, static-first.

Tasarım kaynağı: `docs/reference/pages/*-approved-reference.jpeg` (onaylı 7 sayfa — sabit).
Asset kaynağı: `AKORT_WEB_ASSET_PACK_V1` → `src/assets/` (ikon + grafik), `docs/reference/` (referanslar, build dışı).

## Komutlar

| Komut | Açıklama |
|---|---|
| `npm install` | Bağımlılıklar (Node ≥ 22.12) |
| `npm run dev` | Geliştirme sunucusu |
| `npm run check` | `astro check` (TS + Astro tip kontrolü) |
| `npm run build` | Tip kontrolü + statik build → `dist/` |
| `npm run preview` | Build önizleme |

Domain: `PUBLIC_SITE_URL` ortam değişkeni (varsayılan değer doğrulanmadı).

## Yapı

```text
src/
  assets/{images,icons,graphics,brand}/   Asset Pack (ikonlar doğrudan; _pending/ = onay bekleyen ikonlar)
  components/{layout,common,home,...}/    Astro component'leri
  layouts/{BaseLayout,PageLayout}.astro
  data/                                   Merkezi veri (navigation, services, sectors, process, faq, site, footer)
  content/{blog,projects,services}/       Content Collections (şema: src/content.config.ts)
  pages/                                  Route'lar
  styles/{tokens,global,utilities}.css    Design tokens (Tailwind v4 @theme)
  utils/                                  seo, schema (JSON-LD), slug, date, readingTime, verified, content
docs/
  reference/                              Onaylı referans sayfalar + crop'lar (yayınlanmaz)
  asset-pack/                             Asset Pack dokümanları
  TODO.md                                 Eksik asset / doğrulanacak içerik listesi
```

## Kurallar (özet)

- **Uydurma veri yok.** Referanslardaki sayılar, iletişim bilgileri, sertifikalar vb. `Verifiable` (`src/utils/verified.ts`)
  olarak tutulur; `verified: false` olanlar development'ta görünür, **production build'de render edilmez**.
- Taslak içerik (`draft: true`) production'a çıkmaz (`getPublished`).
- İkonlar yalnızca `src/assets/icons` — harici ikon kütüphanesi yok. Kullanım: `<Icon name="services/mep" />`.
- Eksik görseller `<TodoAsset name="…" ratio="…" />` ile yer tutulur; referans crop'ları production'da kullanılmaz.
- Font: Astro Fonts API, self-host (geçici seçim Plus Jakarta Sans — onay bekliyor).
