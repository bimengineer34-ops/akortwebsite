# AKORT — Açık TODO Listesi

Kullanıcı tarafından sağlanması / doğrulanması gerekenler. Kod içinde `TODO-ASSET`, `TODO-ASSET-ICON`, `TODO-CONTENT` ile işaretlidir.

## TODO-ASSET (görseller)

| Asset | Kullanım yeri | Not |
|---|---|---|
| ~~AKORT logosu~~ ✅ `AKORT_Logo.png`'den açık/koyu sürüm, favicon seti, OG görseli üretildi | Header, Footer, şema, favicon | İsteğe bağlı: SVG (vektörel) logo gelirse en keskin sonuç |
| ~~Favicon seti~~ ✅ | `public/favicon/` | |
| ~~Varsayılan OG görseli~~ ✅ `public/og-default.png` | Tüm sayfalar | |
| ~~Ana Sayfa hero~~ ✅ `akortanasayfa.png` eklendi (`src/assets/images/home/home-hero.png`, 1672×941) | Home hero | İsteğe bağlı: ≥2560px sürüm retina/4K için daha keskin olur |
| Intro bina görseli (üçgen maske) | Home, Hakkımızda, Hizmetler, Uzmanlık, İletişim | |
| Final CTA bina görseli | Tüm sayfalar CTA bandı | |
| Ana Sayfa 4 proje görseli | Öne Çıkan Projeler | Gerçek proje + doğrulanmış veri gerekli |
| Ana Sayfa 3 blog kapağı | Blog bölümü | |
| 6 iç sayfa hero görseli | Hakkımızda … İletişim | |
| Hizmetler: intro bina + "Öne Çıkan Hizmet" BIM wireframe bina (metinsiz, açıklamalar HTML) | Hizmetler | |
| Hakkımızda: intro bina görseli + BIM wireframe bina görseli (Yaklaşımımız) | Hakkımızda | Referans crop'larında metin gömülü |
| Uzmanlık: 7 sektör görseli (sağlık, eğitim, karma, ticari, kampüs/kamu, mevcut yapı/termal, enerji) + intro binası | Uzmanlık Alanları | |
| Proje (6+1), blog (7+) görselleri | İlgili sayfalar | |
| Statik harita / harita kararı | İletişim | Referans crop kullanılamaz (lisanslı tile) |
| Tanıtım videosu | Home / İletişim hero ikincil butonu | Video olmadan buton gösterilmez |

## TODO-ASSET-ICON

Pack çizgi diliyle (24×24, stroke 1.8, round) çizilecek, onay bekleyen ikonlar. `src/assets/icons/_pending/` altında:

- [x] menu (çizildi, onay bekliyor)
- [x] close (çizildi, onay bekliyor)
- [x] diamond — Neden AKORT "360°" (çizildi, onay bekliyor)
- [x] shield — CTA "Güvenilir İş Ortağı" (çizildi, onay bekliyor)
- [ ] play, arrow-left, chevron-down, chevron-right, plus, minus, send, fullscreen, zoom-in/out, calendar, clock, user, briefcase, tag, minimize
- [x] target (Misyon), eye (Vizyon), gear (Bütüncül Yaklaşım) — çizildi, onay bekliyor
- [x] lightning (Elektrik Mühendisliği) — çizildi, onay bekliyor
- [x] clock (okuma süresi), user (yazar) — çizildi, onay bekliyor
- [x] send (form gönder), chevron-down (select), plus (SSS) — çizildi, onay bekliyor
- [ ] fan (Mekanik — şimdilik pack'teki mep.svg) (people → owner-advisory, leaf → energy, bar chart → building-performance pack ikonlarıyla karşılandı)
- [x] grid (Tümü), layers (Karma Kullanım), area (m²) — çizildi, onay bekliyor
- [ ] heart (Sağlık filtresi — şimdilik expertise/health), book (Eğitim — expertise/education), columns (Kamu — expertise/campus), bed (Yatak kapasitesi — şimdilik expertise/health)
- [ ] Sosyal: LinkedIn, YouTube, Instagram (resmi marka işaretleri)

## TODO-CONTENT (doğrulama)

- [ ] Domain (`astro.config.mjs` → `PUBLIC_SITE_URL`, `public/robots.txt`)
- [ ] E-posta, telefon (referanslarda 3 farklı numara), adres, şehir — `src/data/site.ts`
- [ ] Sosyal medya URL'leri
- [ ] "15+ Yıllık Deneyim", "360°" ifadeleri (Ana Sayfa › Neden AKORT) ve "15+ yıllık tecrübe" (Hizmetler › Fark Yaratan) — doğrulanana kadar production'da sayısız ifade
- [ ] Hakkımızda kilometre taşları (2014/2016/2018/2021/2024) — doğrulanana kadar "Yolculuğumuz" bölümü production'da gizli (src/data/about.ts)
- [ ] Projeler: gerçek projeler (başlık, sektör, konum, özet, case study metni, görseller). Referanstaki 6 proje `src/content/projects/` altında `draft: true` — production'da boş durum gösteriliyor.
- [ ] Öne çıkan proje künyesi (358.000 m², 1.250 yatak, 2022–2024) — doğrulanmadı, gizli
- [ ] Rakamlarla AKORT (50+, 2M+ m², 5, %30+) — `src/data/projectsPage.ts`, her değer ayrı doğrulanır; hiçbiri doğrulanmadıysa bölüm gizli
- [ ] FAQ cevapları — `src/data/faq.ts`
- [ ] **KRİTİK:** Gizlilik Politikası, KVKK Aydınlatma Metni, Çerez Tercihleri metinleri (`src/content/legal/*.md`, hukuk danışmanı onaylı). Şu an yalnızca bölüm iskeleti; `approved: true` yapılana kadar sayfalar 'hazırlanıyor' gösterir, noindex ve sitemap dışı.
- [ ] Font onayı (geçici: Plus Jakarta Sans)

## Kararlar (onay bekleyen)

- [x] Site içi arama: `/arama` (statik JSON indeks, bağımlılık yok, Türkçe karakter duyarsız). Pagefind istenirse tam metin aramaya geçilebilir.
- [ ] Form backend / hosting (Netlify Forms, Vercel/Cloudflare function, harici servis)
- [ ] Görseller gelene kadar `TodoAsset` placeholder kullanımı

## Hizmet detay sayfaları

- [ ] `src/content/services/<slug>.md` metinleri (8 hizmet). Yazılana kadar `/hizmetler/<slug>` sayfaları `noindex` ve sitemap dışı.
- [ ] Hizmet detay sayfası için onaylı referans tasarım yok — şu an yalnızca onaylı component'lerle sade şablon. Ayrı bir referans istenirse sağlanmalı.

## Proje detay (case study)

- [ ] Case study sayfası için onaylı referans tasarım yok — Master Prompt §18 yapısıyla, onaylı component'lerden sade şablon kuruldu.
- [ ] `bimModel.enabled` olan projelerde `/projeler/<slug>/bim` rotası Faz 18'de (ThatOpen / web-ifc) eklenecek.

## Blog

- [ ] Yazı içerikleri: referanstaki 9 yazı `src/content/blog/` altında `draft: true` (başlık/özet/tarih referanstan). Production'da boş durum gösteriliyor.
- [ ] Blog kapak görselleri (öne çıkan + her yazı).
- [ ] Bülten servisi / endpoint (`src/data/blog.ts` → `newsletter.endpoint`) — şu an form 'yakında aktif' mesajı veriyor.
- [ ] 'Popüler Yazılar' analitik olmadan editör seçimi (`popular: true`) — analitik bağlanınca otomatikleştirilebilir.
- [ ] Kategoriler Master Prompt §19 listesinden (referanstaki 'Sektör Analizleri' vb. farklı) — onay.
- [ ] Blog yazısı detay sayfası için onaylı referans tasarım yok — sade şablon.
- [ ] Site geneli arama (Pagefind) — blog araması şimdilik yalnızca listelenen sayfayı filtreliyor.

## İletişim

- [ ] **KRİTİK — canlıya almadan önce:** Form backend'i (`src/data/contactPage.ts` → `contactForm.endpoint`). Şu an form doğrulama yapıyor ama veri GÖNDERMİYOR ve kullanıcıya bunu açıkça söylüyor.
- [ ] **KRİTİK:** Doğrulanmış e-posta / telefon / adres. Yokken production'da İletişim Bilgilerimiz kartları ve harita gizli; form tek kolon ortalı gösteriliyor.
- [ ] SSS cevapları (`src/data/faq.ts`) — yokken SSS bölümü ve FAQPage şeması production'da gizli.
- [ ] 'Tüm Soruları Gör' butonu için ayrı SSS sayfası yok — buton eklenmedi.
- [ ] 'Ekibimizi Tanıyın' videosu (TODO-ASSET) — yokken hero'da yalnızca 'Hemen İletişime Geçin' butonu.
- [ ] KVKK Aydınlatma Metni sayfası (`/kvkk`) — form ve bülten buraya link veriyor (Faz 13).
- [ ] Lead qualification (`leadQualification.enabled`) — BIM / Enerji ek soruları hazır, onayla açılır.

## Faz 13

- [ ] Çerez banner'ı: Site varsayılan olarak zorunlu olmayan çerez kullanmıyor (harita yalnızca tıklayınca yükleniyor, analitik yok). Analitik eklenirse onay banner'ı gerekecek.

## Teknik Asistan (Faz 17)

- [x] UI tamam: launcher, karşılama, hızlı sorular, input, gönder, küçült (konuşma korunur), kapat (sıfırlar), oturum boyunca kalıcılık, mobil, erişilebilirlik.
- [x] Yönlendirme modu (LLM yok): soruyu site indeksindeki gerçek sayfalara yönlendirir, cevap uydurmaz.
- [ ] Backend: `/api/assistant` (RAG + Vector DB + LLM) — sözleşme `docs/ASSISTANT.md`. Bağlanınca `src/data/assistant.ts` → `endpoint`.
- [ ] Backend devreye girerse KVKK: mesaj kaydı aydınlatması ve panel bilgilendirme metni (`assistant.privacy`).

## BIM Viewer (Faz 18)

- [x] `/bim`: yerel IFC açıcı (seç / sürükle-bırak), seçim, özellikler, gizle / izole, kat ve disiplin filtreleri — `docs/BIM_VIEWER.md`.
- [ ] **Gerçek IFC modelleriyle test** (şimdiye dek yalnızca 2 katlı, 3 duvarlı test modeli denendi).
- [ ] Kesit düzlemi (section), ölçüm, model ağacı paneli.
- [ ] Projelere `bimModel.ifcUrl` (aynı site) ve model dosyaları.
- [ ] `web-ifc` 0.0.78 sorunu düzelince yükseltme.

## Hizmet ve sektör içerikleri (63 hizmet + 8 sektör sayfası)

- [ ] **Firma onayı:** `src/data/serviceContent/*.ts` metinleri genel mühendislik bilgisiyle hazırlandı; yayın öncesi firma gözden geçirmeli (kapsam, teknik ifadeler, standart atıfları). Ayrıntı: `docs/CONTENT_ARCHITECTURE.md`.
- [ ] Firmanın sunmadığı hizmet varsa kaydı sil (menü, dizin ve arama otomatik güncellenir).
- [ ] Sayfalara özel görseller (hero) — şu an teknik zemin + wireframe.
- [ ] İsteğe bağlı: konu sayfalarına firma deneyimi / örnek çıktı (doğrulanmış) eklenmesi.

## Çalışma Modelimiz (/calisma-modeli)

- [ ] **Firma onayı:** `src/data/workModel.ts` metinleri (5 adım: faaliyetler, çıktılar, sizden beklenenler) genel yöntem tanımıdır; süre/rakam/referans içermez. Yayın öncesi firma gözden geçirmeli.
- [ ] Sayfa hero görseli (TODO-ASSET: çalışma modeli hero).
- [ ] Hakkımızda menüsündeki "Yaklaşımımız" ve "Misyon, Vizyon ve Değerlerimiz" bağlantıları `/hakkimizda` bölüm anchor'larını kullanır; sayfa yapısı değişirse güncelle.

## Hizmet detay şablonu (referans: docs/reference/service-detail-template.webp)

- [ ] **TODO-ASSET:** hero görseli (referansta cam cepheli bina) — şu an koyu BIM wireframe paneli. Dev'de etiket görünür.
- [ ] **TODO-ASSET:** hizmet tanıtım videosu (referansta 2 dk) — video yok, oynat düğmesi eklenmedi.
- [ ] **TODO-CONTENT:** "Hizmet Dokümanını İndir" (PDF) — doküman yok, buton yerine "Hizmet Kapsamını İncele" kullanıldı. PDF hazır olunca hero'ya eklenir.
- [ ] Referanstaki "Neden X?" fayda bandı, içerik kaydında ayrı fayda alanı olmadığı için "Elde Edilen Çıktılar" bandı olarak uygulandı. İstenirse `ServiceEntry`'ye `benefits` alanı eklenip 63 hizmet için yazılabilir (firma onayıyla).
- [ ] İlgili hizmetler listesinde referanstaki küçük bina görselleri yok (görsel yok); ikon kullanıldı.
- [ ] Aynı şablon 8 uzmanlık alanı sayfasında da kullanıldı (`src/pages/uzmanlik-alanlari/[slug].astro`): hero görseli TODO-ASSET; "Neden" bandı yerine "Bu Alanda Sunabileceğimiz Hizmetler" koyu bandı var.

## Form uç noktaları (kod hazır)

- [ ] `.env.example` → `.env` kopyalayıp `PUBLIC_CONTACT_ENDPOINT` ve `PUBLIC_NEWSLETTER_ENDPOINT` değerlerini girin; kod değişikliği gerekmez (formlar uç noktaya POST eder, boşsa veri göndermez ve bunu bildirir). Yayın sunucusunda aynı değişkenler ortam değişkeni olarak tanımlanmalı. Form alan adları ve KVKK açık rıza metni onayı için bkz. `src/data/contactPage.ts`.

## Görsel durumu (8 Ekim 2026)

Bağlandı (ChatGPT ile üretilmiş dekoratif görseller, `src/assets/images/**`, merkezi liste `src/data/images.ts`, SEO adlı dosyalar):
- 6 iç sayfa hero'su (Hakkımızda, Hizmetler, Uzmanlık, Projeler, Blog, İletişim) + Çalışma Modelimiz hero'su. Blog alt sayfaları (kategori/etiket/sayfa/yazı) blog hero'sunu paylaşır.
- Intro görselleri: Ana Sayfa (karma), Hakkımızda (ofis), Hizmetler (hastane), Uzmanlık (hastane), İletişim (ofis). **3 görsel 5 yerde kullanılıyor; her sayfa için ayrı görsel istenirse yeni üretilmeli.**
- CTA bandı (tüm sayfalar), Hakkımızda "Yaklaşımımız" tel kafes, Hizmetler "Öne Çıkan Hizmet" tel kafes.
- 4 ana hizmet grubu paneli (hizmet detay sayfaları pillar'a göre) ve Sağlık Yapıları sektörü (detay sayfası + Uzmanlık kartı).

Hâlâ eksik (yer tutucu panel/etiket duruyor):
- [ ] 7 sektör görseli: eğitim, karma kullanım, ticari, kampüs, kamu, endüstriyel, mevcut yapı (`sectorImages` içine eklenir).
- [ ] Blog kapakları (8) — `docs/IMAGE_PACKAGE_PROMPT.md` Parti 4 üretilmedi.
- [ ] Proje görselleri (yalnızca gerçek projeler), tanıtım videosu, hizmet dokümanı PDF.
- [ ] Kullanılmayan alternatifler `görsel/` klasöründe duruyor (hastane serisi 7 görsel, 3 Ekim intro/CTA alternatifleri).
- [ ] Alt metin tablosu (ChatGPT son partide verecekti) gelmedi; dekoratif görseller şimdilik `alt=""`, hizmet/sektör panellerinde açıklayıcı alt var.

## Yazılım hizmetleri (5. ana grup)

- [ ] **Firma onayı:** `src/data/serviceContent/yazilim.ts` (1 ana sayfa + 9 konu sayfası) genel tanımlardır; firmanın gerçekten sunduğu yazılım hizmetleriyle karşılaştırılıp gereksiz olanlar silinmeli (Panel › Sayfa metinleri › Hizmet Kayıtları › Yazılım ve Dijital Çözümler).
- [ ] **TODO-ASSET:** Yazılım ana sayfası için özel hero/panel görseli yok; geçici olarak BIM/dijital görseli kullanılıyor (Panel › Site görselleri › `hizmetYazilim`).
- [ ] **Projeler:** Yazılım pillar sayfasındaki "Projelerimizi İnceleyin" düğmesi /projeler sayfasına gider. Yazılım projeleri eklendiğinde projeleri hizmet grubuna göre süzmek için proje şemasına `hizmetGrubu` alanı + Projeler sayfasında "Yazılım" filtresi eklenmeli (şu an yalnızca yapı tipi filtresi var). Proje içerikleri gerçek ve doğrulanmış olmalı.
- [ ] İkon: `_pending/code` (kod parantezleri) pack dilinde çizildi, onay bekliyor.

## Yazılım: teknolojiler ve yapay zeka

- [ ] **Teknoloji listesini doğrulayın:** Panel › Sayfa metinleri › Genel ve Menü › "Kullanılan teknolojiler" belgesinde yalnızca bu sitede gerçekten kullanılanlar (Astro, TypeScript, Tailwind, Node.js, SQLite, IFC/web-ifc/That Open/three.js, kural tabanlı asistan, güvenlik başlıkları) doğrulanmış geldi. Python, PostgreSQL, Docker, React, Revit API, Dynamo, Power BI, LLM/RAG, makine öğrenmesi, bilgisayarlı görü, Linux sunucu **doğrulanmadı = yayında gizli**. Firmanın gerçekten kullandıklarını "Doğrulandı" işaretleyin, kullanmadıklarını silin.
- [ ] **Yapay zeka sayfaları (5):** `yapay-zeka-cozumleri`, `yapay-zeka-dokuman-analizi`, `yapay-zeka-teknik-asistan`, `tahminleme-makine-ogrenmesi`, `goruntu-analizi` genel tanımlardır; firma bu hizmetleri gerçekten sunuyorsa onaylanmalı, sunmuyorsa panelden silinmeli. Metinler yapay zekanın karar destek aracı olduğunu, doğruluğun garanti edilmediğini ve verinin gizliliğinin projeye göre tasarlandığını açıkça belirtir.

## Güncelleme (10 Ekim 2026)

- [x] Projelere `serviceGroup` (hizmet grubu) alanı eklendi; panelde proje editöründe "Hizmet grubu" seçilir. "Yazılım" seçilen ve taslak olmayan projeler Yazılım hizmet sayfasında kartla listelenir (test edildi). Projeler sayfasındaki süzgeç hâlâ yalnızca yapı tipine göredir.
- [x] BIM görüntüleyici incelendi: `/bim?ornek` modeli yüklüyor (8 öğe); "Model işleniyor…" metni yalnızca görünmez yükleme katmanının içindeydi, hata yok.
- [x] Bağlantı taraması: 100 sayfa, 25.016 bağlantı, 0 kırık, 0 yetim sayfa.

- [ ] **SSS (10 Ekim 2026):** Her hizmet ve sektör sayfasına yeni sorular eklendi (şimdi en az 5; toplam +289). Yanıtlar genel mühendislik bilgisiyle yazıldı, firma taahhüdü/rakam içermez; yayın öncesi firma gözden geçirmeli. Panel › Sayfa metinleri › Hizmet Kayıtları / Sektör sayfaları belgelerinde her kaydın "Sık sorulan sorular" listesinden düzenlenir. Derleme, 5'ten az soru kalırsa uyarı verir (`serviceCatalog.ts` → `MIN_FAQ`).

- [x] **Blog (10 Ekim 2026):** 9 yazı (BIM, proje yönetimi, enerji ×2, dijital ikiz, işveren danışmanlığı, MEP, teknik danışmanlık, yeşil bina) gerçek makaleler olarak yazıldı ve yayına alındı (`draft: false`, tarihler gerçek yayın tarihi). Genel mühendislik bilgisi; rakam, müşteri veya firma referansı içermez. Yayın öncesi firma gözden geçirmeli. Kapak görselleri henüz yok (ChatGPT paketi Parti 4).
- [ ] **Projeler:** Gerçek proje yok. Mevcut 6 proje dosyası tasarım referansından gelen örneklerdir (taslak, yayında gizli) ve **uydurma proje yayınlanmamalıdır**. Her gerçek proje için: ad, yapı tipi, konum, yıl, AKORT'un rolü/kapsamı, doğrulanmış sonuçlar ve görsel gerekir → Panel › Projeler.
