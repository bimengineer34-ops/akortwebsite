# AKORT — Faz Planı ve Durum

- **P0 Audit** ✅ envanter + boşluk matrisi (bu klasör), mevcut e2e doğrulandı (62 belge, 9 blog, 6 proje, formlar/medya/yedek uç noktaları sağlam).
- **P1 Ortak altyapı** 🟡 kasa, bayraklar, iş kuyruğu, denetim izi ✅ · RBAC 7 rol, outbox/webhook ❌.
- **P2 SEO + Hız** 🟡 tarama, canlı editör, hız raporu ✅ · GSC, CDN, ön ısıtma ❌/⛔.
- **P3 AI Studio** 🟡 sağlayıcılar + üretim + bütçe ✅ (anahtar girilmeli) · editör içi seçili metin/track changes ❌.
- **P4 Social** 🟡 takvim/onay/mühür ✅ · OAuth, yayın, analitik, Brand Kit ❌/⛔.
- **P5 Pazar/Rakip/Backlink** 🟡 çekirdek ✅ · çeviri, AI özet, lisanslı veri ⛔/❌.
- **P6 QA** 🟡 `e2e-ext.mjs` 28 test ✅ · erişilebilirlik/ekran görüntüsü regresyonu ❌.

## Geri alma
Yeni tablolar eklemelidir; `server/lib/ext/*` ve `server/admin/js/pages/x-*.js` kaldırılıp `api.mjs`/`app.js` içindeki 3 satır silinirse sistem önceki haline döner. Modüller panelden bayrakla da kapatılabilir.

## Dağıtım notu
`.env`: isteğe bağlı `SECRETS_KEY` (≥24 karakter). Boşsa `data/.vault-key` otomatik üretilir — yedeğe dahil edin; kaybolursa kayıtlı API anahtarları çözülemez ve yeniden girilir.
