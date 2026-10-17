# İçerik Mimarisi — Hizmet ve Uzmanlık Alanı Sayfaları

Her hizmet başlığı kendi sayfasına sahiptir; menüde ve hizmetler dizininde listelenen **hiçbir başlık tek bir ortak sayfaya düşmez**.

## Yapı

| Katman | Sayfa sayısı | Örnek URL |
|---|---|---|
| Ana başlık (pillar) | 4 | `/hizmetler/bim-danismanligi`, `/hizmetler/muhendislik-danismanligi`, `/hizmetler/enerji-verimliligi`, `/hizmetler/hakedis-kontrolu` |
| Hizmet grubu (hub) | 4 | `/hizmetler/mep-danismanligi`, `/hizmetler/isveren-teknik-danismanligi`, `/hizmetler/teknik-proje-yonetimi`, `/hizmetler/teknik-sartname-ihale-danismanligi` |
| Konu sayfası (topic) | 55 | `/hizmetler/clash-detection`, `/hizmetler/iso-19650`, `/hizmetler/technical-due-diligence` … |
| Uzmanlık alanı (sektör) | 8 | `/uzmanlik-alanlari/saglik-yapilari`, `/uzmanlik-alanlari/kampusler` … |

Toplam **63 hizmet + 8 sektör = 71 yeni/yeniden yapılandırılmış içerik sayfası.**

## Kaynak dosyalar (tek kaynak)

```
src/data/serviceContent/
  types.ts          alan şeması (ServiceEntry / SectorEntry)
  muhendislik.ts    18 sayfa     bim.ts   24 sayfa
  enerji.ts         13 sayfa     maliyet.ts 11 sayfa
  sectors.ts        8 sektör
src/data/serviceCatalog.ts   birleştirir; build sırasında bağlantı tutarlılığını denetler
src/pages/hizmetler/[slug].astro            tüm hizmet sayfaları (tek şablon)
src/pages/uzmanlik-alanlari/[slug].astro    tüm sektör sayfaları
```

Yeni hizmet eklemek = ilgili `.ts` dosyasına bir kayıt eklemek. Slug yinelenmesi, olmayan `parent` / `related` referansı veya
fazla uzun özet **derlemeyi durdurur** (serviceCatalog.ts başındaki denetim).

## Her hizmet sayfasında
Nedir? (2 paragraf) · Hizmet kapsamı · Tipik çıktılar · Ne zaman gerekir · İlgili standartlar (varsa) · Alt hizmetler (pillar/hub) ·
Aynı gruptaki diğer hizmetler · SSS (+ FAQPage şeması) · İlgili hizmetler · CTA. Şema: Service + BreadcrumbList.

## Navigasyon
- **Masaüstü mega menü:** Hizmetler (63 link, 4 sütun) ve Uzmanlık Alanları (8 link); hover veya klavye odağıyla açılır, Esc kapatır.
- **Mobil:** akordeon (Hizmetler → ana başlık → gruplar → konular).
- `/hizmetler` sayfasında "Hizmet Kapsamımız" dizini; `/uzmanlik-alanlari` sayfasında tüm sektörler.
- Arama indeksi (`/arama`, Teknik Asistan) tüm bu sayfaların metnini içerir.

## İçerik ilkeleri ve ONAY GEREKLİ
Metinler **konunun genel mühendislik tanımı, kapsamı ve tipik çıktılarıdır**; firmaya ait rakam, referans, müşteri, sertifika, yetki belgesi
veya "X yıllık deneyim" iddiası **içermez** (NO_FAKE_DATA). Standart atıfları bilgilendirme amaçlıdır ve sayfada bunu belirten bir not vardır.

⚠ Metinler bir yazılım asistanı tarafından genel mühendislik bilgisiyle hazırlanmıştır. **Yayın öncesi firma tarafından gözden geçirilmelidir**:
- Hizmet kapsamı firmanın gerçekte sunduğu işlerle örtüşüyor mu?
- Teknik ifadeler, standart/yönetmelik atıfları güncel ve doğru mu? (özellikle ISO 19650, ISO 50001, BEP-TR, ASHRAE atıfları)
- Firmanın sunmadığı bir hizmet varsa ilgili kayıt silinebilir (menü ve dizin otomatik güncellenir).