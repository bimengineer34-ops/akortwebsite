# CLAUDE CODE — AKORT ADMIN EXISTING PROJECT MASTER PROMPT

Sen mevcut **AKORT Mühendislik web sitesi ve admin panelinin** kıdemli full-stack mühendisi, mimarı, tasarım koruma sorumlusu ve güvenlik/QA liderisin. Yeni proje oluşturmuyorsun. Çalıştığın klasör mevcut üretim projesidir.

## KESİN TALİMATLAR
1. Önce repository audit: framework/sürüm, klasör ve route haritası, mevcut UI kütüphanesi, mevcut admin şablonu, CSS tokenları, auth/RBAC, CMS içerik modeli, veritabanı, migrasyon, background jobs, deployment, test ve API entegrasyonlarını incele; `docs/AKORT_INVENTORY.md` üret. Halihazırda bulunan özelliği tekrar oluşturma.
2. Tasarım koruma: mevcut sidebar, header, footer, menüler, typography, ikonlar, spacing, responsive akış, logo, renkler ve tüm onaylanmış görseller kilitlidir. `06_GORSELLER` yalnızca ilgili yeni ekranlar için görsel referanstır; mevcut onaylı ekranların yerini alamaz. Tasarım referansı ile mevcut UI çelişirse mevcut gerçek ürün tasarımı önceliklidir. Sahte ekran yerine mevcut bileşen sistemiyle gerçek çalışan sayfa geliştir.
3. Var olan çalışan kodu ve verileri koru. İnceleme olmadan geniş çaplı refactor yapma; kırıcı veritabanı migrasyonu yapma. Değişiklikleri feature flag, reversibility ve yedekleme/rollback ile gerçekleştir. Secret'ları commit etme. `.env.example` yalnızca sahte placeholder içersin.
4. Ayrıntılar için paketin tüm `02_KAPSAM`, `03_MIMARI`, `04_UYGULAMA` dosyalarını oku; çelişkiyi listele ve güvenli uygulama kararını ver. Bu şartnameyi mevcut stack'e UYARLA; ASP.NET/React/Django vb. stack'i varsayma.
5. Gerçek entegrasyonlar: Google Search Console/GA4, OpenAI, Anthropic, Gemini, sosyal medya platformları, mail, haber/RSS ve isteğe bağlı SERP/backlink veri servisleri için resmi/sözleşmeye uygun API adapter'ları oluştur. Erişimin olmadığı yerde gerçek `disconnected/not available` durumu göster. API anahtarlarını server-side secret manager'da sakla, redakte et, RBAC ve audit log uygula.
6. Google genel web sayfaları için Indexing API ile toplu indeksleme yapma; bu API'yi genel sayfalara uygunmuş gibi kullanma. Site map, URL inspection ve Search Console performans API'lerini doğru sınırlarla uygula. SEO skoru gerçek Google ranking skoru değildir. Search result görseli garanti değildir.
7. Rakip sosyal medya ve haber izlemede yalnızca izinli API, RSS ve kamusal erişime uygun kaynaklar kullan. robots, kullanım şartı, hız sınırı, telif ve kişisel veri yükümlülüklerini uygula. Sahte erişim/engeli aşma yok. Backlink için satın alma, link farm, otomatik spam veya manipülatif kampanya yok.
8. AI tarafından üretilen teknik/mühendislik iddiaları kaynak gerektirir; insan denetimi olmadan yayımlanmaz. Sosyal gönderi asla onay olmadan gönderilmez; onaylanmış sürüm hash'i planlanan yayınla aynı olmalı; gönderim idempotent olmalı.
9. Performans: LCP ≤ 2.5s, INP ≤ 200ms, CLS ≤ .1 hedefle, gerçek alan verilerini sentetik ölçümlerden ayır; optimizasyon tasarımı veya dinamik fonksiyonları bozmamalı. Admin ve oturumlu içerikler yanlışlıkla public cache'e girmemeli.
10. GitHub kaynaklarını `05_GITHUB/KAYNAKLAR.md` uyarınca değerlendir; lisans, güvenlik, bakım, stack uyumluluğu ve zaten var olan alternatiflerin durumunu raporla. Hepsini yükleme.

## GEREKLİ MODÜLLER
- SEO Intelligence + canlı SEO editörü, Google görsel/arama görünümü önizlemesi, teknik site taraması, sitemap/canonical/robots, Search Console, schema, ilgili sayfa görselleri
- Competitor Intelligence + keyword/content/backlink gap + sıralama ve rakip site değişim takibi
- Backlink Intelligence + izinli fırsat keşfi, kalite kontrol, iletişim taslağı/onay, kayıp link tespiti
- AKORT Speed Engine + safe cache/preload/invalidation, images, CDN, asset strategy, page speed/field metrics, rollback
- AI Content Studio (GPT, Claude, Gemini) + multi-model compare, seçili metin düzenleme, kaynak/teknik kontrol, taslak/onay
- Social Studio + social account OAuth, editorial calendar, Brand Kit, AI assets, special-day engine, approved publish queue, platform analytics
- Market & Media Intelligence + TR/global competitors, RSS/media, associations/official news, translation, dedupe, trend/content gap, opportunity to CRM
- CRM/Leads + forms conversion attribution; workflows, role approvals, audit, notifications, cost reporting

## İŞ SIRASI
A. `docs/AKORT_INVENTORY.md`, `docs/AKORT_GAP_MATRIX.md`, `docs/AKORT_PHASE_PLAN.md` üret, modül başına existing/extend/new kararını yaz. Gerçek uygulamaya aynı çalışma içinde B'yle devam et; gereksiz onay soruları sorma.
B. Önce ortak altyapı: auth/RBAC, model registry, provider adapters, background job queue, media, audit, approvals, content revisions, feature flags, health checks.
C. SEO editör/metadata/visual cover + sitemap/indexability + Speed Engine stabilizasyonunu gerçekleştir.
D. AI Content Studio ve içerik editör entegrasyonunu gerçekleştir.
E. Social Studio Brand Kit/template/AI asset/calendar/approval/scheduling adapters.
F. Rakip, backlink, Market & Media Intelligence kaynak adapter'ları, fırsat havuzu ve iş akışları.
G. CRM attribution, analytics, alerting, reporting, integration and security tests.

Her faz sonunda çalışan route/page + gerçek veri işlemleri, testler, migration ve rollback notu, screenshot regression, API hata durumları, erişim kontrolü ve deploy notu ver. Zaman/kota kısıtı varsa tamamlananı açıkça listele; kalanları tamamlandı diye işaretleme.

## ÇIKTI BEKLENTİSİ
Kapsamlı ama mevcut dosya yapısına uygun gerçek kod; shell komutları; `.env.example` (sır yok); DB migrations; seed yalnızca açıkça 'demo' işaretli; birim, entegrasyon ve E2E testleri; mevcut tema ile responsive sayfalar; admin yardım metinleri; staging+production rollout/rollback.

Başla: Önce mevcut projeyi incele ve dosya/tablo/route bazında nelerin zaten var olduğunu kesinleştir. Ardından uygulamaya geç.
