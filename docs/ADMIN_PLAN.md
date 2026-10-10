# AKORT Yönetim Paneli — Mimari ve Plan

Hedef: Web sitesinin **tüm içeriğini** kod yazmadan yönetebilmek; site ve panel **aynı sunucuda** (Veridyen).

## Mimari (karar)

```
Tarayıcı ──► Node sunucusu (server/index.mjs, tek süreç, tek port)
              ├─ /               → dist/ (Astro'nun statik çıktısı: hızlı, SEO'ya uygun)
              ├─ /yonetim/*      → yönetim paneli (vanilla JS, bağımlılıksız)
              └─ /api/*          → panel API'si + form uç noktaları (/api/iletisim, /api/bulten)
Veri: data/akort.db (SQLite, node:sqlite) · data/content/published/*.json · data/media/ · data/backups/
```

- **Site statik kalır.** Panel içerikleri JSON olarak kaydeder; **Yayınla** düğmesi siteyi yeniden derler (`astro build`, ~15–60 sn) ve yeni `dist/` klasörünü **atomik olarak** değiştirir. Derleme hata verirse canlı site değişmez.
- **Varsayılan + geçersiz kılma (override):** `src/data/*` dosyalarındaki içerik varsayılandır. Her dışa aktarım `ov('<dosya>.<ad>', varsayılan)` ile sarılır; yayınlanmış override varsa onu kullanır. "Varsayılana dön" her zaman mümkündür. Varsayılan değerler derleme sırasında `data/defaults/*.json` olarak kaydedilir; panel formları bu yapıdan otomatik üretilir.
- **Taslak / Yayın:** Kayıtlar önce taslak (SQLite) olur, sürüm geçmişi tutulur (geri alma). Yayınla, tüm taslakları `published/` altına yazıp derler.
- **Güvenlik:** scrypt parola, HttpOnly + SameSite=Strict oturum çerezi, CSRF belirteci, giriş hız sınırı + hesap kilidi, roller (yönetici / editör), tüm işlemler denetim günlüğünde. Panel `noindex`.
- **Bağımlılık:** Panel için yeni paket yok (Node ≥ 22.12: `node:http`, `node:sqlite`, `node:crypto`). Sunucuda Node 22+ gerekir.

## Modüller

| Faz | Modül | Durum |
|---|---|---|
| 1 | Giriş, roller, oturum, denetim günlüğü | |
| 1 | İçerik belgeleri (tüm sayfa metinleri, menü, SEO, iletişim bilgileri, hizmet/sektör kayıtları, çalışma modeli …) — form editörü, doğrulama bayrağı (`Verifiable`), sürüm geçmişi, varsayılana dön | |
| 1 | Yayınla (derleme günlüğü, atomik geçiş, geri alma) | |
| 1 | Form kayıtları (iletişim talepleri, durum, not, CSV) + bülten aboneleri | |
| 1 | Medya kütüphanesi (yükleme, SEO dosya adı, alt metin, kullanım yerleri) | |
| 1 | Kullanıcı yönetimi, parola değiştirme, yedekleme/indirme | |
| 2 | Blog ve proje editörü (Markdown + önizleme, taslak/yayın, kapak, kategori) | |
| 2 | Yönlendirmeler (301), robots/sitemap ayarları, sayfa bazlı SEO | |
| 2 | E-posta bildirimleri (SMTP), 2 adımlı doğrulama (TOTP) | |
| 3 | Analitik panosu, teknik asistan bilgi tabanı, görsel yerleşim ayarları | |

## Dağıtım (Veridyen)

Bkz. `docs/DEPLOY.md`.
