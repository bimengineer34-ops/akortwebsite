# AKORT — ChatGPT Görsel Üretim Promptları

Kullanım: Önce **1. MASTER PROMPT**'u yeni bir ChatGPT sohbetine yapıştırın (stil kilidi). Sonra her görsel için **3. Görsel Listesi**'ndeki kısa promptu aynı sohbette verin; böylece tüm görseller aynı dilde çıkar.

## 0. Önemli kurallar (NO_FAKE_DATA)

- Yapay zekâ görselleri **hero, sektör, blog kapağı ve dekoratif bina** için kullanılabilir.
- **Proje görselleri gerçek projelerin fotoğrafı/render'ı olmalıdır.** Yapay zekâ ile üretilen bir binayı "AKORT projesi" diye yayınlamayın. Gerçek görsel yoksa proje kartları yayında gizli kalır.
- Görsellerde **metin, logo, tabela, sayı, bayrak, marka, gerçek kişi yüzü** olmasın. Tüm yazılar HTML'de.
- ChatGPT yaklaşık 1536×1024 (3:2), 1024×1024 ve 1024×1536 üretir. Geniş (panoramik) görseller "geniş çekim" olarak istenip sonradan kırpılır/büyütülür. Teslim ederken en yüksek çözünürlüklü PNG'yi isteyin.
- Dosyaları `docs/asset-pack/generated/` altına koyup bana bildirin; boyutlandırma, kırpma, AVIF/WebP dönüşümü ve sayfalara bağlama bende.

## 1. MASTER PROMPT (stil kilidi — ilk mesaj)

```
Sen AKORT Mühendislik adlı bir mühendislik danışmanlığı şirketinin web sitesi için görsel üreten bir sanat yönetmenisin. Bundan sonra isteyeceğim TÜM görseller aşağıdaki stil kurallarına uymak zorunda. Kuralları hatırla ve her görselde uygula; her seferinde tekrar sormana gerek yok.

MARKA VE ATMOSFER
- Kurumsal, güvenilir, sakin, teknik ve premium. Abartısız, gösterişsiz. Türkiye'de faaliyet gösteren, kamu ve özel sektöre hizmet veren bir mühendislik danışmanlığı hissi.
- Konu: mimari yapılar, BIM (yapı bilgi modellemesi), MEP (mekanik/elektrik) sistemleri, enerji verimliliği, teknik proje yönetimi.

RENK PALETİ (kesin)
- Ana: koyu lacivert #0B1A2B ve #152638
- Vurgu: kurumsal mavi #0B4F80, ışık mavisi #0B6F9F, açık turkuaz #55A9D9 (BIM tel kafes çizgileri ve ışıklar için)
- Nötr: beyaz, çok açık gri-mavi #F3F7FA, çelik grisi
- Sıcak aksan YOK (turuncu/kırmızı/yeşil baskın olmasın). Sadece pencerelerde çok hafif sıcak iç ışık olabilir.

GÖRSEL DİL
- Fotogerçekçi mimari fotoğraf/render kalitesi; temiz, keskin, sinematik ama doğal. Profesyonel mimari fotoğrafçılık: 24–35mm, düşük açı veya hafif perspektif, dikey çizgiler düzgün (perspektif düzeltilmiş).
- Işık: alacakaranlık/mavi saat veya yumuşak açık hava; yüksek kontrast değil, dengeli.
- Opsiyonel "BIM katmanı": binanın bir kısmı ince, açık mavi (#55A9D9) tel kafes / modelleme çizgileri olarak görünür; gerçek bina ile dijital model birbirine geçiyor gibi. Çizgiler ince ve zarif, neon veya hologram abartısı YOK.
- Kompozisyon: ana konu görselin SAĞ yarısında veya merkezinde; sol taraf sakin/boş bırakılabilir (üzerine HTML metin gelecek). Geniş nefes alan, düzenli.
- Gerçek proje görünümü: orta ölçekli modern Türkiye şehir bağlamı (hastane, okul, ofis, karma kullanım, kampüs, sanayi tesisi); jenerik, markasız cepheler.

KESİNLİKLE YOK
- Hiçbir yazı, harf, rakam, tabela, logo, marka, sembol, filigran, imza.
- Gerçek kişi yüzü veya tanınabilir insanlar (gerekirse uzaktan, silüet, yüzü seçilmeyen küçük figürler).
- Bayrak, siyasi/dini sembol, gerçek ünlü yapı veya tanınabilir bina.
- Stok fotoğraf klişeleri (el sıkışan iş insanları, kask giyip tabletle poz veren ekip), çizgi film/illüstrasyon tarzı, aşırı HDR, aşırı bulanık arka plan, bozuk geometri, eğik/erimiş cepheler.

ÇIKTI KURALLARI
- Her istekte yalnızca 1 görsel üret, en yüksek kalitede. Belirtilen en-boy oranına uy.
- Cevabında kısa bir açıklama yaz, görselin üstüne yazı ekleme.
- Anladıysan sadece "Stil kilidi hazır" yaz.
```

## 2. Teknik boyut tablosu (bana teslim ederken)

| Kullanım | Oran | İstenen çözünürlük | Not |
|---|---|---|---|
| İç sayfa hero (6 sayfa) | 21:9 geniş | ≥ 2560×1100 | Konu sağda, sol 40% sakin/koyu (üstüne metin biner) |
| Hizmet / sektör hero paneli | 4:3 | ≥ 1600×1200 | Hizmet ve sektör sayfalarında sağ panel |
| Intro bina (üçgen maske) | 4:3 veya 1:1 | ≥ 1400×1200 | Home, Hakkımızda, Hizmetler, Uzmanlık, İletişim |
| Final CTA bandı | 4:1 | ≥ 2560×640 | Koyu, sakin; bina silüeti + BIM çizgi |
| Sektör kartı (7–8 adet) | 3:2 | ≥ 1200×800 | Uzmanlık sayfası |
| Blog kapağı | 16:10 | ≥ 1600×1000 | Blog kartları |
| Proje kapağı | 3:2 | ≥ 1800×1200 | **Yalnızca gerçek projeler** |

## 3. Görsel Listesi (master prompttan SONRA, her biri ayrı mesaj)

### 3.1 İç sayfa hero görselleri (6 adet, 21:9 geniş çekim)

Ortak ek cümle: *"Geniş panoramik kadraj (21:9). Ana yapı görselin sağ yarısında, sol %40 sakin ve koyu lacivert gökyüzü/gölge; metin buraya gelecek. Alacakaranlık, mavi saat."*

1. **Hakkımızda:** Modern bir ofis/karma kullanım binası, camlı cephe, alacakaranlık; binanın bir kısmı açık mavi BIM tel kafes olarak belirginleşiyor. Güven ve bütünlük hissi.
2. **Hizmetler:** Birkaç disiplini (mimari, yapı, MEP) simgeleyen katmanlı bir yapı; cephe yanında yarı şeffaf teknik katmanlar (kanal, boru hatları tel kafes olarak).
3. **Uzmanlık Alanları:** Farklı yapı tiplerinden oluşan bir şehir silueti (hastane, okul, ofis, karma kullanım); en yakın bina detaylı, arkadakiler yumuşak. İnce BIM çizgileri.
4. **Projeler:** Yapım aşamasının bittiği, tamamlanmış büyük ölçekli bir yapı; dinamik açı, hafif uzun pozlama ışıkları. (Dekoratif; proje kanıtı değil.)
5. **Blog:** Teknik içerik hissi: bir mimari modelin üzerinde ince mavi çizgi/ölçü katmanı, ofis penceresinden şehir; sakin, okuma/araştırma atmosferi.
6. **İletişim:** Davetkâr, sıcak ama kurumsal bir ofis binası girişi/cephesi; mavi saat, içeriden hafif sıcak ışık. Erişilebilir ve güven veren.

### 3.2 Intro bina görselleri (4:3)

*"Tek bir modern yapı, 3/4 perspektif, temiz gökyüzü, alt kısmı sade. Gün ışığı, yumuşak mavi ton. Binanın bir köşesi ince açık mavi BIM tel kafes olarak devam ediyor."* — 5 sayfa için aynı stilde 3 farklı bina (ofis, hastane, karma kullanım) üretin.

### 3.3 Final CTA bandı (4:1)

*"Çok geniş (4:1) panoramik: koyu lacivert gece/alacakaranlık zemininde, yatay uzanan sade bir bina silüeti ve ince açık mavi BIM çizgileri. Çok sakin, düşük kontrast, ön planda boş alan (metin gelecek)."*

### 3.4 Hizmet detay hero paneli (4:3) — 4 ana hizmet için varyant

Şablon: *"4:3. [KONU]. Koyu lacivert zemin üzerinde, sağda cam cepheli modern bina ve onunla iç içe geçen ince açık mavi BIM tel kafes. Sol-alt köşe sakin."*
- Mühendislik Danışmanlığı: ofis kulesi + mimari/yapı/MEP katmanları
- BIM & Dijital: bina + 3D model çizgileri, koordinasyon/çakışma noktalarını andıran vurgusuz kesişimler
- Enerji & Bina Performansı: güneş kırıcılı enerji verimli cephe, hafif ısı akışı çizgileri (renk geçişi mavi tonlarında)
- Maliyet & Teknik Danışmanlık: yapım aşamasındaki iskelet + üzerine ince ölçü/metraj çizgileri (yazısız)

### 3.5 Sektör görselleri (3:2, 8 adet)

Şablon: *"3:2. [YAPI TİPİ] dış cephe görünümü, gün batımı öncesi yumuşak ışık, temiz modern mimari, markasız. Binanın bir kısmı ince BIM tel kafes. Yazı, tabela, insan yüzü yok."*
Yapı tipleri: **hastane/sağlık**, **okul/eğitim kampüsü**, **karma kullanım (konut+ticari)**, **ticari/ofis**, **kampüs**, **kamu binası (sade, bayraksız)**, **endüstriyel tesis**, **mevcut yapı (yenileme/termal iyileştirme, cephe giydirme)**.

### 3.6 Blog kapakları (16:10)

Şablon: *"16:10. [KONU] için editoryal kapak görseli: [SAHNE]. Sakin, teknik, lacivert-mavi palet, sade kompozisyon, yazı yok."*
Konu → sahne örnekleri: BIM koordinasyonu → bina modeli üzerinde farklı renkte (mavi tonlarında) disiplin katmanları · MEP tasarım → tavan arası kanal/boru sistemleri, temiz teknik oda · Enerji verimliliği → yalıtımlı cephe detayı, ince ısı çizgileri · Maliyet kontrolü → yapım aşaması iskeleti, üzerinde ince ölçü çizgileri · Commissioning → temiz teknik oda, pano/ekipman sırası (markasız).

## 4. Tanıtım videosu (ChatGPT görsel üretimi video yapmaz)

Seçenekler: Sora / Runway / Kling / Veo ile üretim, ya da gerçek şirket çekimi. Aşağıdaki **senaryo promptu** bu araçlarda kullanılır (≈ 30–45 sn, sessiz, yazısız; seslendirme ve altyazı sonradan eklenir):

```
Kurumsal tanıtım videosu, 16:9, sinematik, yavaş ve sakin kamera hareketleri. Palet: koyu lacivert, kurumsal mavi, açık turkuaz BIM çizgileri, beyaz.
Sahne 1 (0–6 sn): Alacakaranlıkta modern bir ofis binasının yavaş yükselen kamera çekimi.
Sahne 2 (6–14 sn): Binanın cephesi ince açık mavi tel kafes modele dönüşüyor (BIM), model dönerek katmanlarını (yapı, mekanik tesisat) gösteriyor.
Sahne 3 (14–24 sn): Teknik odada düzenli boru ve pano sistemleri; ekranda soyut mühendislik çizgileri (okunur yazı yok).
Sahne 4 (24–34 sn): Gün ışığında tamamlanmış bina, çevresinde yeşil ve sakin şehir; kamera yukarı süzülür.
Sahne 5 (34–40 sn): Koyu lacivert zeminde sade bina silüeti — logo ve yazılar sonradan eklenecek, boş bırak.
Kurallar: yazı/logo/marka yok, yüz yakın çekimi yok, abartılı hologram yok, hızlı kesme yok. Müzik: sakin, kurumsal, enstrümantal (sonradan).
```

Teslim: MP4 (H.264), 1920×1080, ≤ 20 MB; ayrıca bir poster kare (JPG). Gerçek şirket çekimi gelirse bu senaryo çekim planı olarak kullanılabilir.

## 5. Hizmet dokümanı (PDF) — görsel değil, içerik

ChatGPT'ye şu promptla **her hizmet için 1–2 sayfalık broşür metni** yazdırabilirsiniz; tasarımını sonra birlikte yaparız. Metin firma tarafından onaylanmadan yayınlanmaz.

```
AKORT Mühendislik için "[HİZMET ADI]" hizmetinin 2 sayfalık tanıtım dokümanını yaz. Yapı: 1) Hizmetin özeti (3 cümle) 2) Kimler için? 3) Hizmet kapsamı (6–8 madde) 4) Çalışma yöntemi (4 adım) 5) Tipik çıktılar 6) Sık sorulan 3 soru 7) İletişim çağrısı. Kurallar: rakam, referans, müşteri adı, sertifika, "X yıllık deneyim" gibi doğrulanamayan iddia YAZMA; kapsamı genel mühendislik bilgisiyle anlat; sade, profesyonel Türkçe.
```
Mevcut içerik kaynağı: `src/data/serviceContent/*.ts` (63 hizmetin kapsam/çıktı/SSS metinleri) — ChatGPT'ye bunu girdi olarak verebilirsiniz.

## 6. Teslim kontrol listesi

- [ ] Metin/logo/filigran yok
- [ ] Palet lacivert–mavi, sıcak aksan yok
- [ ] Hero'larda sol taraf sakin
- [ ] Dik çizgiler düz, cephe geometrisi bozuk değil
- [ ] Proje görsellerinde yalnızca gerçek proje
- [ ] Dosya adı: `hero-hakkimizda.png`, `intro-ofis.png`, `sektor-saglik.png`, `blog-bim-koordinasyonu.png` …
