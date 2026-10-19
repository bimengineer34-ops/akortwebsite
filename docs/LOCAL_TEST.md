# Yerel Test Rehberi (canlıya geçmeden önce)

İki ayrı yerel örnek vardır; ikisi de kendi bilgisayarınızda çalışır, internete açılmaz.

| | **Test ortamı** (önerilen ilk adım) | **Gerçek veri örneği** |
|---|---|---|
| Başlatma | `npm run local:test` | `npm start` (veya panel: preview `akort-panel`) |
| Adres | http://localhost:4500 | http://localhost:4321 (preview: 4332) |
| Veri | `.local-test/` (ayrı, silinebilir; `-- --reset` ile sıfırlanır) | `data/` (gerçek) |
| Giriş | `.local-test/giris.txt` | `.env` / kurulumda belirlediğiniz hesap |
| AI Orchestra | **Sahte model açık** (anahtar gerekmez) | Gerçek sağlayıcı anahtarı gerekir |

> Test ortamındaki AI çıktıları yer tutucudur ("1. paragraf…" gibi); amaç akışı, onayları ve arayüzü denemektir, içerik kalitesini değil. Gerçek kaliteyi görmek için gerçek örnekte Entegrasyonlar'dan bir AI anahtarı bağlayın.

## 1) Genel site
- [ ] Ana sayfa, Hizmetler (Çelik Yapı dahil), Uzmanlık, Projeler, Blog, Hakkımızda, İletişim açılıyor; menü ve alt menüler çalışıyor
- [ ] Mobilde (telefon genişliği) taşma yok, menü paneli açılıyor
- [ ] Arama (`/arama`) sonuç veriyor
- [ ] İletişim formu: boş gönderim uyarı veriyor; doldurup KVKK kutusunu işaretleyince "Talebiniz alındı"
- [ ] Bülten formu çalışıyor
- [ ] Dil anahtarı (TR|EN): İngilizce yayın kapalıyken görünmez/boş (normal)

## 2) Panel (giriş → `/yonetim/`)
- [ ] Pano: göstergeler ve grafikler yükleniyor
- [ ] İletişim formundan gelen talep **CRM / Form talepleri**'nde görünüyor
- [ ] Sayfa/Blog/Proje düzenle → kaydet → Yayınla (test ortamında yayın kendi kopyasını derler)
- [ ] Medya: görsel yükle, alt metin ver
- [ ] SEO, Hız, Pazar & Medya, Rakipler, Backlink, Social Studio, Brand Kit (PNG/SVG/PDF indir)
- [ ] Kullanıcılar: farklı rol (izleyici/SEO/…) oluştur → o hesapla giriş → yetkisiz işlemler 403 / "salt okunur"
- [ ] Yedekler: elle yedek al; Etkinlik günlüğü kayıtları görünüyor

## 3) AI Orchestra (sol menü → AI Orchestra)
- [ ] **Komut Merkezi → Hızlı başlat**: konu yaz → "İş akışını başlat"
- [ ] **Görev İzleme**: Research → Content → SEO → QA adımları sırayla tamamlanıyor, akış çizgesi renkleniyor
- [ ] **Onay Merkezi** (veya çalıştırma sayfası): onay bekleyen görevi gör, taslağı/SEO/QA raporunu incele → **Onayla**
- [ ] Onaydan sonra **Blog** listesinde yeni **taslak** görünüyor ve blog editöründe açılıyor (yayınlanmamış)
- [ ] **Reddet** denemesi: çalıştırma "Başarısız", taslak oluşmuyor
- [ ] **Master ile planla**: örnek komutu seç → plan tablosu ve çizge → "Planı onayla ve çalıştır"
- [ ] **Ajanlar**: bir ajanın talimatını/aracını düzenle (yönetici), Bağlı olmayanlar (Design/Sales/CRM) uyarıyla görünüyor
- [ ] **Kayıtlar & Analitik**: token ve olay kayıtları doluyor
- [ ] İptal: uzun çalıştırmayı başlatıp **İptal et**

> Test sırasında oluşan blog taslakları depodaki `src/content/blog/` klasörüne yazılır (panel içeriği ise test klasörüne). Bitince **Blog** listesinden silin (çöp klasörüne taşınır) ve `git status` ile kontrol edin.

## 4) Gerçek AI ile ilk deneme (gerçek veri örneğinde)
1. Entegrasyonlar → AI sağlayıcısı anahtarını girin → "Bağlantıyı test et"
2. AI Orchestra → Model & API → varsayılan sağlayıcıyı seçin, **çalıştırma başına token limitini** düşük tutun (ör. 60.000)
3. Komut Merkezi → hızlı başlat; maliyeti Kayıtlar & Analitik'ten izleyin
4. Çıktıyı Onay Merkezi'nde okuyun; QA'nın işaretlediği iddiaları kontrol edin; taslağı blog editöründe düzenleyip kendiniz yayınlayın

## Sorun giderme
- Port doluysa: `LOCAL_TEST_PORT=4510 npm run local:test`
- Test verisini sıfırla: `npm run local:test -- --reset`
- Site güncel değilse (kod değiştiyse): `npx astro build` sonra yeniden başlatın (test ortamı `dist/` değişince kopyayı yeniler)
- Otomatik taramalar: `npm run audit:launch -- http://localhost:4500`, `npm run audit:seo`, `node scripts/link-scan.mjs dist`
