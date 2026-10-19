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
| Social OAuth + otomatik yayın + analitik | yeni | 🟡 | Hesap bağlama (OAuth2 kod akışı, PKCE, belirteç yenileme, sayfa/hesap seçimi, bağlantıyı kes) 8 platform için kodlandı; otomatik yayın (metin + tek görsel) LinkedIn, X, Facebook Sayfası, Instagram (JPEG), Threads, Pinterest (pano seçimli) için (onaylı+mühürlü, tek seferlik). Yalnızca yerel sahte sağlayıcıyla test edildi; gerçek platformda kullanıcının geliştirici uygulaması + platform onayı gerekir. YouTube/TikTok yayını (video yükleme + TikTok denetimi), carousel, zamanlanmış otomatik yayın ve analitik YOK |
| Brand Kit / şablon editörü (Fabric.js) | yeni | ❌ | Sonraki faz |
| Özel gün motoru | yeni | 🟡 | Yalnızca sabit tarihli günler; hareketli bayramlar yok |
| Market & Media | yeni | ✅ | Kaynak defteri, robots'a uyumlu RSS, ETag/If-Modified-Since, dedupe, ilgililik skoru, CRM fırsat önerisi; çeviri/AI özet ❌ |
| Rakip izleme | yeni | ✅ | Sayfa değişim izleme (robots uyumlu, SSRF korumalı); SERP/trafik ⛔ |
| Backlink | yeni | ✅ | Fırsat defteri, elle onaylı taslak, gerçek bağlantı doğrulama; veri servisi ⛔ |
| CRM / Leads | genişlet | 🟡 | Mevcut form talepleri + fırsat önerisi; aşama/sahip/atıf raporu ❌ |
| Referans dashboard tasarımı (koyu tema, KPI kartları, grafikler, genel arama) | genişlet | ✅ | Kullanıcı başına KPI seçimi/sırası/hedefi (24 gerçek metrik), SVG grafik kütüphanesi, açık/koyu tema; mockup ekranlarıyla birebir karşılaştırma ❌ |
| 10 referans ekran düzeni (SEO, Market, Takvim, Brand Kit, Social, AI Studio, Speed, Backlink, Competitor, Canlı SEO Editörü) | yeni | 🟡 | Düzen/bileşenler referansa göre, AÇIK temada; veri gerçek. GSC/GA4/sıralama/backlink sağlayıcı/OAuth olmayan kartlar "Bağlantı gerekli" gösterir. Piksel-doğru kopya değildir |
| Brand Kit şablon oluşturucu (logo + marka metni katmanı, PNG/JPG/WebP/SVG/PDF) | yeni | ✅ | sharp ile deterministik; SVG düzenlenebilir (metin canlı, görsel/logo gömülü; yazı tipi açan bilgisayara bağlı), PDF görsel tabanlı tek sayfa. SVG medya kitaplığına kaydedilmez (güvenlik) |
| PageSpeed Insights entegrasyonu | yeni | ✅ kod / ⛔ herkese açık adres | Yerel adresler test edilemez; canlıya çıkınca çalışır |
| RBAC (7 rol) | genişlet | ✅ | admin, editör, SEO uzmanı, içerik yazarı, sosyal medya uzmanı, satış/CRM, izleyici. Merkezi denetim dispatch() içinde (alan bazlı yazma izni; CRM kişisel verisi yalnızca admin/editör/satış okur); eski DB otomatik göç eder. Menüde yazamadığı alanlar "salt okunur" etiketli, CRM menüsü yetkisizlerden gizli, sayfa üstünde uyarı çıkar; yasak işlem yine 403 verir |
| İş kuyruğu | yeni | ✅ | `jobs` tablosu, idempotent anahtar, üstel geri çekilme, ölü kuyruk; şimdilik yalnızca RSS çekimi |
| Sır kasası / denetim | yeni | ✅ | AES-256-GCM, değer API'ye/günlüğe çıkmaz |
| Bütçe merkezi | yeni | ✅ | Aylık token bütçesi, fiyat girilirse maliyet tahmini |
| Özellik bayrakları | yeni | ✅ | seo/ai/social/intel modülleri panelden kapatılabilir |
| İzleme/alarm (SSL, uptime) | — | ❌ | |
| İngilizce site (/en) — otomatik çeviri, çeviri hafızası, dil anahtarı, hreflang/sitemap | yeni | ✅ kod / ⛔ AI anahtarı ile çeviri | Yayınlanan her sayfa HTML düzeyinde çevrilir; tam çevrilmemiş sayfa yayınlanmaz; elle onaylı çeviriler korunur. Slug'lar Türkçe kalır; sayfa içi istemci JS metinlerinin çoğu (arama/form/bülten dışında) Türkçe kalır |


| İngilizce adresler (slug) | yeni | ✅ | Üst düzey adresler varsayılan çevrilir (hizmetler→services…), diğerleri panelden eşlenir; canonical/hreflang/sitemap/iç bağlantı/arama indeksi eşlenmiş adresi kullanır. Eski EN adresleri (Türkçe biçimli veya değiştirilmiş) 301 ile güncel adrese yönlendirilir |
| AI Orchestra (�ok ajanl� y�netim mod�l�) | yeni | ?? | 12 yap�land�r�labilir ajan (9 �al��t�r�labilir; Visual Design/Sales/CRM ba�l� de�il), DAG motoru (s�ral�/paralel, kal�c�, yeniden deneme, iptal, idempotent), insan onay�, b�t�e/token takibi, 8 panel sayfas�. �lk ak��: Research�Content�SEO�QA�Onay�Blog tasla��. Yaln�zca sahte modelle test edildi; ger�ek sa�lay�c�yla ilk �al��t�rma g�zlenmeli. Ayr�nt�: docs/ORCHESTRA.md |
