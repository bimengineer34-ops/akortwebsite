# AKORT — Boşluk Matrisi (modül başına: mevcut / genişlet / yeni, ve GERÇEK durum)

Durum anahtarı: ✅ gerçek ve test edilmiş · 🟡 kısmen (neden belirtilir) · ⛔ dış bağlantı/anahtar gerekli (arayüzde "Bağlantı gerekli") · ❌ yapılmadı

| Modül | Karar | Durum | Not |
|---|---|---|---|
| SEO editörü (meta/başlık/odak sorgu/noindex) | genişlet (mevcut girdi editörü seo alanları) | ✅ | Canlı yerel analiz, SERP önizleme (tahmini), açıklanabilir puan; kayıt blog/projelerde |
| Teknik SEO taraması | yeni | ✅ | dist HTML'i tarar: title/meta/canonical/H1/alt/og/JSON-LD, sitemap ve robots karşılaştırması, yinelenenler |
| Sitemap/canonical/robots | mevcut | ✅ | Astro sitemap + robots.txt; örnek projeler noindex/sitemap dışı |
| hreflang | — | ❌ | Site tek dil (TR); diller açılınca |
| Search Console / GA4 / PSI | yeni | ⛔ | OAuth/anahtar gerekli; Indexing API genel sayfalarda kullanılmaz |
| Speed Engine | genişlet | 🟡 | Gerçek ağırlık raporu + önbellek başlığı durumu; CDN, ön ısıtma, önce/sonra testi, geri alma ⛔/❌ (Veridyen/proxy planı gerekir) |
| Kapak görseli zorunluluğu (YENİ içerik) | yeni | 🟡 | SEO editörü kapak eksikliğini işaretler; zorunlu kılma ve AI görsel üretimi ❌ |
| AI İçerik Stüdyosu | yeni | ✅ kod / ⛔ anahtar | OpenAI, Anthropic, Gemini adaptörleri, kasa, bütçe, devre kesici, kabul/red; gerçek üretim anahtar girilince (sahte anahtarla hata yolu test edildi) |
| Seçili metin üzerinde editör içi AI + track changes | yeni | ❌ | Şimdilik Stüdyo sayfasından kopyala-kabul; editör entegrasyonu sonraki faz |
| Social Studio takvim + onay + mühür | yeni | ✅ | Durum makinesi, SHA-256 mühür, idempotency anahtarı, platform karakter doğrulaması, blogdan türetme |
| Social OAuth + otomatik yayın + analitik | yeni | ⛔ | 8 platform yetenek matrisi gösterilir; hiçbiri bağlı değil, "yayımlandı" yalnızca elle işaretlenir |
| Brand Kit / şablon editörü (Fabric.js) | yeni | ❌ | Sonraki faz |
| Özel gün motoru | yeni | 🟡 | Yalnızca sabit tarihli günler; hareketli bayramlar yok |
| Market & Media | yeni | ✅ | Kaynak defteri, robots'a uyumlu RSS, ETag/If-Modified-Since, dedupe, ilgililik skoru, CRM fırsat önerisi; çeviri/AI özet ❌ |
| Rakip izleme | yeni | ✅ | Sayfa değişim izleme (robots uyumlu, SSRF korumalı); SERP/trafik ⛔ |
| Backlink | yeni | ✅ | Fırsat defteri, elle onaylı taslak, gerçek bağlantı doğrulama; veri servisi ⛔ |
| CRM / Leads | genişlet | 🟡 | Mevcut form talepleri + fırsat önerisi; aşama/sahip/atıf raporu ❌ |
| Referans dashboard tasarımı (koyu tema, KPI kartları, grafikler, genel arama) | genişlet | ✅ | Kullanıcı başına KPI seçimi/sırası/hedefi (24 gerçek metrik), SVG grafik kütüphanesi, açık/koyu tema; mockup ekranlarıyla birebir karşılaştırma ❌ |
| 10 referans ekran düzeni (SEO, Market, Takvim, Brand Kit, Social, AI Studio, Speed, Backlink, Competitor, Canlı SEO Editörü) | yeni | 🟡 | Düzen/bileşenler referansa göre, AÇIK temada; veri gerçek. GSC/GA4/sıralama/backlink sağlayıcı/OAuth olmayan kartlar "Bağlantı gerekli" gösterir. Piksel-doğru kopya değildir |
| Brand Kit şablon oluşturucu (logo + marka metni katmanı, PNG/JPG/WebP) | yeni | ✅ | sharp ile deterministik; SVG/PDF çıktısı ❌ |
| PageSpeed Insights entegrasyonu | yeni | ✅ kod / ⛔ herkese açık adres | Yerel adresler test edilemez; canlıya çıkınca çalışır |
| RBAC (7 rol) | genişlet | ❌ | Şimdilik admin/editor. `users.role` CHECK kısıtı nedeniyle tablo yeniden kurulumu gerekir → ayrı, yedekli migrasyon |
| İş kuyruğu | yeni | ✅ | `jobs` tablosu, idempotent anahtar, üstel geri çekilme, ölü kuyruk; şimdilik yalnızca RSS çekimi |
| Sır kasası / denetim | yeni | ✅ | AES-256-GCM, değer API'ye/günlüğe çıkmaz |
| Bütçe merkezi | yeni | ✅ | Aylık token bütçesi, fiyat girilirse maliyet tahmini |
| Özellik bayrakları | yeni | ✅ | seo/ai/social/intel modülleri panelden kapatılabilir |
| İzleme/alarm (SSL, uptime) | — | ❌ | |
| İngilizce site (/en) — otomatik çeviri, çeviri hafızası, dil anahtarı, hreflang/sitemap | yeni | ✅ kod / ⛔ AI anahtarı ile çeviri | Yayınlanan her sayfa HTML düzeyinde çevrilir; tam çevrilmemiş sayfa yayınlanmaz; elle onaylı çeviriler korunur. Slug'lar Türkçe kalır; sayfa içi istemci JS metinlerinin çoğu (arama/form/bülten dışında) Türkçe kalır |
