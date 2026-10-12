# SEO Intelligence + Live SEO Editor + Speed Engine
## Editör
- Pages/Services/Projects/Blog'da aynı SEO bileşeni: odak sorgu, başlık, meta, slug, canonical, robots, OG/X, schema ve içerik önizlemesi.
- Her keystroke'ta debounce edilmiş yerel SEO analizi; AI önerileri asenkron ve masraf kontrollü; anında puan değişimi. SEO, okunabilirlik, teknik durum, görsel SEO puanları ayrı; açıklanabilir kriterler. Puan Google algoritması değil.
- Anahtar kelime niyeti, semantik varyasyonlar, iç link ve cannibalization önerileri; sahte rakip metrikleri yok.
- Yayında olan mevcut sayfaları geriye dönük eksiklik yüzünden yayından kaldırma; yeni içerik için gereklilik politikasını tenant/role bazında ayarla.
## Görsel
- Her yeni hizmet/proje/blog için ana kapak görseli yükleme/AI üretme; açıkça yayınlanabilir görsel kontrolü, alt metin, responsive srcset, boyut/crop editörü, schema image ve OG image. Sosyal/Google önizlemesi yalnızca tahmini.
- Google aramasında görsel gösterimi garanti edilemez. Dosya erişilebilirliği, max-image-preview:large koşulu, kaliteli ilgili görsel ve HTML içinde gerçek img kullanımını kontrol et.
## Teknik SEO
- sitemap.xml + indeks sitemap'leri, lastmod gerçek anlamlı değişiklikten, robots, canonical, hreflang (diller aktif olduğunda), 301/404, structured data test ve indexability scan.
- GSC bağlantısı: OAuth/izinler, Search Analytics, URL Inspection izinli kota ve sınırlamalar; yeni içerikte sitemap güncelleme. Genel sayfalara Indexing API ile indeksleme vaat etme.
## Speed Engine
- Stack'e uygun response/output cache, asset cache header/ETag, dependency-based invalidation, sıcak cache preload, CDN adapter (opsiyonel), image transcoding, font strategy, lazy loading (hero hariç), safe code optimization/build pipeline.
- UI'da test/önce-sonra/rollback. Admin/login/person-specific yanıtlar cache dışı. Cache temizlemesi yalnız ilgili sayfayı etkilemeli; yoğun trafik/CPU koruması.
- PSI/Lighthouse sentetik test, Core Web Vitals RUM ayrı panel ve tarihsel trend.
## Kabul
- Meta alanı değişince preview ve kontrol anlık güncellenir; kayıt+geri açma başarılı. Content revizyonları korunur.
- Yeni sayfa sitemap'e girer, canonical doğru, kapak görseli responsive; image preview uyarıları anlaşılır.
- Cache invalidation yayımlama sonrasında doğru sayfalarda çalışır; login dataları sızmaz; görsel regresyon testleri geçer.
