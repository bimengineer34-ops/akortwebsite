# AKORT — Mevcut Sistem Envanteri (genişletme paketi öncesi denetim)

Tarih: 2026-10-12 · Kaynak: repo incelemesi (`akort-web`).

## Stack
- **Site:** Astro 7 (statik çıktı), Tailwind CSS 4, TypeScript strictest. İçerik koleksiyonları: blog, projects, legal. 137 sayfa.
- **Sunucu:** tek Node süreci (`server/index.mjs`), Node ≥ 22.12, bağımlılıksız HTTP yönlendirme. DB: `node:sqlite` (WAL). Görsel: sharp.
- **Panel:** `/yonetim` — saf JS (ES modül), `server/admin/**`, tasarım dili `admin.css` (açık tema, lacivert yan menü). Ayrı bir ikinci panel YOK.
- **Auth:** scrypt parola, oturum + CSRF + Origin denetimi, giriş kilidi (5/15 dk), TOTP 2FA, e-posta ile parola sıfırlama, roller: `admin`, `editor`.
- **Yayın:** panelde "Yayınla" → staging derleme → atomik `dist` değişimi + geri alma; yedek (zip), yönlendirmeler, çerezsiz istatistik, SMTP istemcisi, CSP.
- **Testler:** `scripts/admin/e2e-test.mjs` (izole örnek, taze DATA_DIR), `scripts/admin/e2e-ext.mjs` (çalışan sunucu, genişletme modülleri), `scripts/seo-audit.mjs`, `astro check`.

## Tablolar (mevcut)
users, sessions, login_attempts, drafts, published, versions, builds, forms, subscribers, media, audit, settings.

## Genişletmeyle eklenenler (yalnızca ekleme; `server/lib/ext/schema.mjs`)
secrets, feature_flags, seo_focus, ai_usage, ai_runs, social_posts, sources, source_items, competitors, competitor_checks, backlink_opps, jobs.
Geri alma: bu tabloları DROP etmek mevcut veriyi etkilemez.

## Panel sayfaları (mevcut → korunur)
Pano, Sayfa metinleri (62 belge), Blog, Projeler, Yasal metinler, Medya, Doğrulama bekleyenler, Form talepleri, Bülten aboneleri, İstatistikler, Yayınla, Yönlendirmeler, Kullanıcılar, Etkinlik günlüğü, Yedekler, Ayarlar, Hesabım.
## Yeni sayfalar
SEO Intelligence (tarama, canlı editör, hız), AI İçerik Stüdyosu, Social Studio (genel bakış, takvim, onay), Market & Media, Competitor Intelligence, Backlink Intelligence, Entegrasyonlar ve API.
