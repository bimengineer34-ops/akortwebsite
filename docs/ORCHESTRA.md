# AKORT AI Orchestra — mimari, kurulum ve teslim notları

Mevcut yönetim paneline **eklemeli** olarak entegre edilmiş çok ajanlı yapay zekâ modülü. Mevcut tablolar, sayfalar, tasarım sistemi ve işlevler değiştirilmedi (tek dokunuş: ajanlar için `rawChat`'e geriye dönük uyumlu isteğe bağlı `model` parametresi).

## Aşama 1 — Doğrulanan gerçek mimari (varsayım yok)

| Katman | Gerçek durum |
|---|---|
| Çalışma zamanı | Node ≥ 22.12, **tek süreç**: `server/index.mjs` (statik site + `/yonetim` + `/api`) — .NET yok, bu yüzden **Microsoft Agent Framework uygulanamaz/gereksiz** |
| Veritabanı | `node:sqlite` (`data/akort.db`), WAL; eklemeli tablolar (`server/lib/ext/schema.mjs` kalıbı) |
| Backend | Elle yazılmış HTTP yönlendirici (`api.mjs` + `ext/routes.mjs`), oturum çerezi + CSRF + Origin denetimi, scrypt, TOTP, 7 rol (`rbac.mjs`) |
| Frontend (panel) | Bağımlılıksız ES modülleri, `h()` DOM kurucu (innerHTML yok), CSP `style-src 'self'`; açık tema |
| Yapay zekâ | OpenAI/Anthropic/Gemini adaptörleri (`ext/ai.mjs`): aylık token bütçesi, devre kesici, kullanım kaydı; anahtarlar AES‑256‑GCM kasada (`ext/vault.mjs`) |
| Arka plan işleri | Süreç içi zamanlayıcı (`ext/intel.mjs → startScheduler`, `jobs` tablosu) |
| İçerik | Blog = `src/content/blog/*.md` (`entries.mjs → saveEntry`), Social Studio = `social_posts`, Pazar & Medya = `sources/source_items` (RSS), SEO = `ext/seo.mjs` |
| Hosting | Veridyen (Node ≥ 22.12, kalıcı disk). **Vercel sunucusuz ortamında çalışmaz**: kalıcı SQLite ve sürekli zamanlayıcı gerekir |

### Orkestrasyon çözümü seçimi
Mevcut yığın Node olduğu için **dış çatı (LangGraph/Agent Framework vb.) eklenmedi**; yeni npm paketi veya depo indirilmedi. Gerekçe: ihtiyaç duyulan her şey (DAG, kuyruk, kalıcılık, yeniden deneme, onay kapıları) SQLite + küçük bir motorla sağlandı; böylece bağımlılık/lisans/güvenlik yükü artmadı ve aynı veritabanı, yetki ve denetim altyapısı kullanıldı.

## Yedekleme / geri alma stratejisi
- Git: `ai-orchestra` dalı, geri dönüş etiketi **`pre-orchestra`** (`git checkout pre-orchestra`).
- Veri: işlem başında `createBackup` ile zip yedek (ayrıca günlük otomatik yedek).
- Şema: yalnızca `orch_*` tabloları eklenir; geri alma = bu tabloları `DROP` etmek (mevcut veri etkilenmez). Özellik bayrağı: Entegrasyonlar → "AI Orchestra" anahtarı kapatılırsa çalıştırma/plan reddedilir.

## Dosyalar (oluşturulan / değiştirilen)
**Yeni:** `server/lib/ext/orchestra/{schema,safety,llm,fake,tools,agents,runners,engine}.mjs`, `server/admin/js/pages/x-orkestra.js`, `server/admin/orkestra.css`, `scripts/admin/{test-orchestra,e2e-orchestra}.mjs`, `docs/ORCHESTRA.md`
**Değiştirilen (eklemeli):** `server/lib/ext/routes.mjs` (22 uç nokta + bayrak), `server/lib/rbac.mjs` (orkestra alanı), `server/lib/ext/ai.mjs` (isteğe bağlı `model`), `server/index.mjs` (`startOrchestra()`), `server/admin/js/{app,nav}.js`, `server/admin/index.html`, `x-integrations.js` (bayrak etiketi), `test-rbac.mjs`

## Veri modeli (migration: `orchestra/schema.mjs`, açılışta `CREATE TABLE IF NOT EXISTS`)
`orch_agents` (ajan yapılandırması) · `orch_workflows` · `orch_runs` · `orch_tasks` (DAG düğümü: bağımlılık, durum, girdi/çıktı, deneme, onay, token/maliyet) · `orch_events` (denetim kaydı).

## Ajanlar (12) — hepsi çalıştırılabilir
| Ajan | Ne yapar | Araç yetkileri (varsayılan) |
|---|---|---|
| Master Orchestrator | Türkçe komutu doğrulanmış görev grafına böler | — |
| Industry Research (Research) | Kaynaklı araştırma (Pazar & Medya + site içeriği) | source_items, site_content |
| Content Writer | Markdown blog taslağı | site_content |
| SEO | **İki mod:** taslak iyileştirme **ve mevcut sayfaların SEO denetimi** (başlık, meta, iç bağlantı, teknik SEO) | site_content, seo_check, site_seo |
| QA & Approval | Doğruluk / NO_FAKE_DATA / kaynak denetimi, onay raporu | risk_scan |
| Competitor Intelligence | İzlenen rakip kayıtları + kaynaklar | competitors, source_items |
| Social Media | LinkedIn/X metinleri (eylem: Social Studio **taslağı**) | site_content |
| **Visual Design** | Brand Kit şablon/biçim/tema + başlık kurgusu; görsel **Brand Kit ile deterministik** üretilir (logo/metin katmanı yapay zekâyla çizilmez) | brand_kit |
| **Sales** | Müşteri talebi analizi + yanıt **taslağı** (kişisel veriler modele gitmez; hiçbir şey göndermez) | forms |
| **CRM** | Sales analizinden yapılandırılmış iş fırsatı önerisi | — |
| MEP Technical Expert | Teknik tutarlılık; doğrulayamadığını "emin değil" listesine yazar | site_content |
| Analytics | Çerezsiz sayaçların yorumu | stats |

Her ajanda: sistem talimatı, görev tanımı, model/sağlayıcı geçersiz kılma, araç yetkisi, girdi/çıktı JSON şeması, yeniden deneme, zaman aşımı, çıktı token sınırı, **günlük token limiti**, onay gereksinimi, **çalıştırma geçmişi (Ajanlar › Yapılandır)** ve token/maliyet takibi vardır.

## Hazır iş akışları
1. **Blog Taslağı:** Research → Content → SEO → QA → İnsan onayı → blog editöründe taslak
2. **Site SEO Denetimi:** SEO ajanı (scope=site) mevcut sayfaları tarama verisiyle önceliklendirir — onay gerekmez, hiçbir şeyi değiştirmez; sitede olmayan sayfa/bağlantı önerileri çıktıdan temizlenir
3. **Müşteri Talebi Analizi:** Sales → CRM → İnsan onayı → CRM'de **fırsat kaydı** (Form talepleri çekmecesinde "AI ile analiz et" düğmesi). E-posta/teklif **gönderilmez**; yanıt taslağı kayıt notunda "GÖNDERİLMEDİ" etiketiyle durur, kaynak talebe iç not düşer
4. **Sosyal Gönderi:** Social + Visual Design (paralel) → İnsan onayı → Brand Kit görseli (medya kitaplığı) + Social Studio taslağı (görselli, yayınlanmaz)

## Motor (`engine.mjs`)
- **DAG**: görevler bağımlılıkları bitince kuyruğa girer; bağımsızlar **paralel** (eşzamanlılık 1–6), bağımlılar **sıralı**; ajanlar arası veri bağımlılık çıktılarıyla (yapılandırılmış JSON) taşınır.
- **Kalıcılık**: tüm durum SQLite'ta; sunucu yeniden başlayınca yarım kalan görevler kuyruğa döner.
- **Hata yönetimi**: geçici hatada üstel geri çekilmeyle yeniden deneme; 400/401/403/404/409/413/422/429 ve `fatal` hatalar **yeniden denenmez**; şemaya uymayan model çıktısı reddedilir; sınırlı deneme sonrası görev başarısız, bağımlılar "atlandı", çalıştırma "başarısız".
- **İptal/durdurma**: bekleyen görevler iptal, devam eden görevin sonucu atılır. Başarısız görev elle yeniden başlatılabilir (reddedilen hariç).
- **Idempotency**: `idempotencyKey` zorunlu, tekrar istek aynı çalıştırmayı döndürür; görev sahiplenme ve onay/red **CAS** ile atomik (aynı görev iki kez yürütülmez); eylemler `orch.action.<görev>` kaydıyla çökme sonrası da **tek sefer** çalışır.
- **Duraklat / devam**: çalıştırma duraklatılır (devam eden görevler tamamlanır, yenisi başlamaz); devam ettirilir; duraklatılmışken iptal edilebilir.
- **Bütçe**: çalıştırma başına token limiti + **ajan başına ve genel günlük token limiti** (%80'de uyarı olayı, aşılınca görev açık mesajla durur) + sağlayıcı aylık bütçesi + görev başına token sınırı; devre kesici. Günlük kullanım görev bitince yazıldığından eşzamanlı görevlerde küçük aşım olabilir.

## Güvenlik
- **Yetki**: Orchestra görevlerini/çıktılarını yalnızca **yönetici/editör** okur ve çalıştırır; ajan/akış/ayar tanımlarını yalnızca **yönetici** değiştirir; dış sistemi değiştiren eylemler yalnızca yönetici onayıyla (şu an dış eylem yok).
- **İnsan onayı**: her eylemden önce onay adımı zorunlu (iş akışı doğrulaması + Master planında otomatik ekleme + motorda son güvenlik ağı). Blog ve sosyal çıktılar yalnızca **taslak** (yayınlanmaz). QA kritik bulgu bildirirse onay için "uyarıları gördüm" onayı gerekir.
- **Prompt injection**: dış kaynak metni HTML'den arındırılır, uzunluğu kısıtlanır, talimat kalıpları içerenler ajana **hiç verilmez** (olay kaydı), geri kalanı "GÜVENİLMEZ VERİ" bloklarıyla iletilir; sunucu her çağrıya değiştirilemez güvenlik kuralları ekler; model çıktısı şemaya göre doğrulanır; kaynak atıfları yalnızca sağlanan adreslerle sınırlıdır; iç bağlantılar yalnızca sitede var olan sayfalardır; üretilen Markdown'dan HTML/izinsiz dış bağlantı temizlenir; Master planı sunucuda yeniden doğrulanır (listede olmayan/bağlı olmayan ajan reddedilir).
- **Müşteri verisi (KVKK):** Sales ajanına ad, e-posta, telefon, kurum adı, IP ve tarayıcı bilgisi **gönderilmez**; form alanı adı ne olursa olsun e-posta/telefon/IBAN/TC no kalıpları değer olarak maskelenir, serbest metindeki e-posta/telefon da `[e-posta]`/`[telefon]` ile değiştirilir. Metne müşterinin kendi yazdığı **ad gibi serbest kimlik bilgileri maskelenemez**; sağlayıcıya iletilen metin yalnızca talep konusu ve mesajdır. Yanıt taslağındaki fiyat/indirim/garanti ifadeleri ve dış bağlantılar işaretlenir/kaldırılır.
- **Sırlar**: API anahtarları yalnızca kasada; olay/log kayıtları `redact()` ile maskelenir; araçlar salt okunurdur.
- **NO_FAKE_DATA**: Content/QA deterministik risk taraması (kaynaksız yüzde, deneyim/sertifika/müşteri iddiası, abartı).
- **Test/canlı ayrımı**: `ORCH_FAKE_LLM=1` yalnızca `NODE_ENV≠production` iken geçerlidir; panelde "TEST MODU" uyarısı çıkar.

## Entegrasyonlar
Blog → blog editöründe `draft: true` taslak · SEO → mevcut site taraması (`scanSite`), site indeksi ve deterministik SEO kontrolü · Pazar & Medya → `source_items` (kaynak URL'leri çıktıda saklanır; Türkçe ek/harf katlamalı arama) · Sosyal → Social Studio'da `taslak` gönderi (görselli; yayın için mevcut onay/mühür akışı geçerli) · Görsel → Brand Kit (medya kitaplığı) · Müşteri talepleri → Form talepleri/CRM (`firsat` kaydı, onaylı).

## Ortam değişkenleri / ayarlar
Yeni zorunlu değişken yok. Test için `ORCH_FAKE_LLM=1` (üretimde kullanmayın). Panel: Model & API → varsayılan sağlayıcı, eşzamanlılık, çalıştırma başına token limiti. Yapay zekâ anahtarı: Entegrasyonlar.

## Yerel kurulum ve test
```bash
npm ci
npm start                      # panel: /yonetim → AI Orchestra
node scripts/admin/test-orchestra.mjs     # motor entegrasyon testi (sahte model)
# uçtan uca (çalışan, ORCH_FAKE_LLM=1 ile başlatılmış izole sunucuya karşı):
ADMIN_EMAIL=... ADMIN_PASSWORD=... node scripts/admin/e2e-orchestra.mjs http://127.0.0.1:4402
node scripts/admin/test-rbac.mjs
```

## Hosting
Veridyen/VPS (Node ≥ 22.12, kalıcı disk) üzerinde mevcut kurulum adımlarıyla (docs/DEPLOY.md) çalışır; ek servis gerekmez. Motor süreç içidir: tek süreç/çoklu kopya çalıştırmayın (SQLite + süreç içi zamanlayıcı). **Vercel/sunucusuz ortamda çalışmaz.** Uzun ajan çağrıları `timeout_s` ile sınırlıdır; ters vekil zaman aşımı gerektirmez (çalıştırma arka plandadır).

## Dürüst sınırlar
- Gerçek bir yapay zekâ sağlayıcısıyla **çalıştırılmadı**; testler deterministik sahte modelle yapıldı. Gerçek içerik kalitesi, token maliyeti ve model uyumu (JSON biçimi) ilk gerçek çalıştırmada gözlenmelidir (hatalarda motor yeniden dener, şema ihlalini reddeder).
- **Harici e-posta/teklif gönderimi yok** (Sales yalnızca taslak üretir; gönderim gelecekte yönetici onaylı ayrı bir eylem olmalıdır). Görsel yalnızca Brand Kit şablonlarıyla üretilir (serbest yapay zekâ görseli yok).
- Müşteri talebi metnindeki serbest kimlik bilgileri (ör. mesaj içinde yazılmış ad) maskelenemez; kurumunuzun veri sağlayıcılara aktarım politikasına (KVKK m.9) uygunluğunu hukuk danışmanıyla teyit edin.
- Talep analizi **otomatik tetiklenmez** (maliyet/gizlilik); form çekmecesinden elle başlatılır.
- QA kritik bulgu bildirirse yazı otomatik yeniden yazılmaz; yalnızca insan onayında uyarı çıkar.
- Paralellik süreç içidir (tek Node süreci); çok sunuculu dağıtık kuyruk yoktur.
