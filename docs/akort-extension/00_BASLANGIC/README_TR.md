# AKORT Mühendislik — Mevcut Admin Panelini Geliştirme Paketi
Sürüm: 2026-10-10 • Teslim: teknik kapsam, mimari plan, prompt, referans görseller.

## Başlangıç
1. ZIP'i açın ve `AKORT_ADMIN_CLAUDE_MASTER_PAKET_2026` klasörünü mevcut AKORT projesinin kök dizinine `docs/akort-extension/` olarak kopyalayın. Mevcut dosyaların üzerine yazmayın.
2. VS Code'u **mevcut çalışan AKORT proje klasöründe** açın, Claude Code'u başlatın.
3. `01_CLAUDE_MASTER_PROMPT.md` içindeki promptu Claude Code'a yapıştırın.
4. Claude önce mevcut kod tabanını, stack'i, kayıtlı tasarım bileşenlerini ve testleri incelesin, sonra değişiklik yapsın.

**Bu ZIP çalışır uygulama değildir.** Kullanıcının mevcut repository'si bu konuşmaya sağlanmadığı için entegrasyon kodu üretilmemiştir. Görseller **UI referans görselleridir**, piksel-doğru HTML bileşenleri/asset'leri değildir.

## Mutlak kurallar
- Var olan onaylı tasarım değişmeyecek; yeni tema, WordPress veya ikinci admin paneli açılmayacak.
- Var olan işlevler/veriler korunacak; DB migration öncesi yedek, dönüşümler için rollback.
- Harici servisler gerçek API yetkisi ve kota durumuna göre çalışacak; bağlantı yoksa `Bağlantı gerekli` görünmeli, sahte veri gerçekmiş gibi sunulmamalı.
- Yapay zekâ içerikleri yayınlamadan önce insan onayı. Harici iletişim/spam toplu gönderim yok.
- Modülleri artımlı, testlerle ve feature flag ile yayımla.

## Dosyalar
- `01_CLAUDE_MASTER_PROMPT.md`: Claude Code başlangıç talimatı.
- `02_KAPSAM/*`: her modülün ayrıntılı kabul kriterleri.
- `03_MIMARI/*`: sistem ve güvenlik mimarisi.
- `04_UYGULAMA/*`: aşamalı yol haritası, QA, veri modelleri.
- `05_GITHUB/*`: kaynaklar, tercih koşulları ve lisans inceleme görevleri.
- `06_GORSELLER/*`: 5 ayrı tasarım referansı, birebir ilgili sayfaya eşleşir.
