# AKORT BIM Viewer (Faz 18)

`/bim` — "BIM Modelini İncele". Kullanıcı kendi **IFC** dosyasını tarayıcıda açar. Dosya sunucuya **gönderilmez**.

## Özellikler (çalışır durumda, test edildi)

| Özellik | Durum |
|---|---|
| IFC açma (IFC2x3 / IFC4 / IFC4x3; seç veya sürükle-bırak, ≤ 300 MB) | ✅ |
| Orbit / pan / zoom (fare + dokunmatik) | ✅ (camera-controls) |
| Öğe seçimi (tıkla) + vurgulama | ✅ |
| Özellik paneli: ad, kategori, GUID, nitelikler, Pset / miktar setleri | ✅ |
| Seçileni gizle / izole et / tümünü göster | ✅ |
| Kat filtresi (BuildingStorey'e göre izole) | ✅ |
| Disiplin filtresi: Mimari, Taşıyıcı, Mekanik (HVAC), Tesisat, Elektrik (IFC kategorilerine göre) | ✅ |
| Görünümü sıfırla (izometrik başlangıç) | ✅ |
| **Kesit (section / clipping plane)** | ⏳ yapılmadı — `OBC.Clipper` ile eklenebilir |
| Uzak model (`/bim?model=<ifcUrl>`) | ✅ yalnızca **aynı site** (same-origin) dosyaları |
| Test modeli (`/bim?ornek`) | ✅ kendi ürettiğimiz 2 katlı, 3 duvarlı IFC (`public/bim-samples/akort-test-duvar.ifc`) |

Gerçek modellerle (hastane, kampüs…) performans/özellik testi henüz yapılmadı — elde yalnızca test modeli vardı.

## Mimari

```
src/pages/bim.astro              noindex sayfa (PageLayout + BimViewer)
src/components/bim/BimViewer.astro   arayüz + olaylar (hafif; three yok)
src/components/bim/viewer.ts          motor: dinamik import ile yalnızca model seçilince yüklenir
public/bim/worker.mjs, web-ifc.wasm   scripts/copy-bim-assets.mjs ile paketten kopyalanır (.gitignore'da)
public/bim-samples/                   test modeli
```

- **Performans:** Motor ≈ 5.7 MB (gzip ≈ 1.0 MB) + 1.3 MB WASM + 3.3 MB worker. Hiçbiri diğer sayfalarda yüklenmez (Ana Sayfa Lighthouse etkilenmedi).
- **Gizlilik:** Kütüphane varsayılan olarak worker ve WASM'ı `unpkg.com`'dan çeker; bunu **kullanmıyoruz** — dosyalar kendi sitemizden (`/bim/…`) sunulur. Üçüncü taraf isteği yok.
- **Sürüm sabitleme:** `web-ifc` **0.0.77**'ye sabitlendi. 0.0.78'in JS'i `StreamMeshes`'e 4 argüman gönderirken paketle gelen WASM 3 bekliyor
  (`BindingError`). ThatOpen paketleri `>=0.0.77` kabul ediyor; 0.0.78 düzelene kadar yükseltmeyin.
- **ThatOpen logosu:** Kütüphane tuvalin sol altına küçük bir "That Open Company" logosu koyar (yazarların bilinçli isteği, MIT). Kapatmak için:
  `renderer.showLogo = false` (viewer.ts → `AkortViewer.create`).
- **Tip kontrolü:** `tsconfig.json` `public/` klasörünü hariç tutar (kopyalanan 3 MB'lık worker tip kontrolünü bellek yetersizliğine sokuyordu).

## Proje entegrasyonu

Proje içeriğinde (`src/content/projects/<slug>.md`):

```yaml
bimModel:
  enabled: true
  ifcUrl: /models/hastane.ifc   # aynı site; büyük dosyaları public/models/ altına koyun veya aynı origin'den proxy'leyin
```

`enabled: true` olunca proje sayfasında "BIM Modelini İncele" kutusu çıkar ve `/bim?model=…` adresine gider.
Harici CDN modelleri için CORS + izin listesi (`viewer` tarafında) eklenmeli.

## Yol haritası

- Kesit düzlemi (Clipper), ölçüm, model ağacı (spatial tree) paneli, çoklu model.
- Büyük model testleri; gerekirse IFC → Fragments (`.frag`) ön dönüşümü (build/CI) ile açılış süresini kısaltma.
- ThatOpen / web-ifc yeni sürümlerinde uyumluluk testi (`/bim?ornek`).