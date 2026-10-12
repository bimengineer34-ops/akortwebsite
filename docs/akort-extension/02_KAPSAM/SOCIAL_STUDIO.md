# Social Studio + Brand Kit
## Ekranlar
- Dashboard / İçerik Takvimi / AI İçerik Stüdyosu / Brand Kit & Tasarım Sistemi / Onay & Performans Merkezi.
- Referans eşleşmeleri kesin olarak `06_GORSELLER/README.md` içinde. Bunlar mevcut ürünün tasarımını değiştirme izni değildir.
## Sosyal platform
- LinkedIn, Instagram/Facebook, X, YouTube, Threads, Pinterest, TikTok için yalnız uygun yetkilendirme/izin/alınabilir API özellikleri; platform başına capability matrix (upload, carousel, story, schedule, insights). Desteklenmeyen özellik disabled+gerekçe.
- OAuth state/PKCE uygun yerde, secret vault, token yenileme, disconnect, revoke; kullanıcı bazlı/organizasyon bazlı erişim.
## Brand Kit
- Logo SVG/PNG/izinli dosya, exact palette/font, editorial tone, watermark/uygulama kuralları; şablonlar editable layers; önizleme mobile/platform ratio.
- AI ham görsel üretebilir; kurumsal metni/logoyu deterministik template renderer ile katman olarak bindir. AI'ın uydurma logo/bozuk tipografi oluşturmasını engelle.
## Onay ve yayın
- Taslak > düzenleme > onay bekliyor > onaylandı > planlandı > yayımlandı/hata/revizyon. Onaylanan metin+medya+platform+zaman hash ile mühürlenir, içerik değişirse yeniden onay.
- Aynı yayın iki kez gitmeyecek idempotency; job retries exponential backoff, rate limits, per-platform media validation, stored platform post ID.
- Özel gün motoru: ülke/kurum takvimi, takvim kaynağı ve doğrulama, erken draft, çeşitlilik kontrolü, en az bir insan onayı. Otomatik doğrudan yayın kapalı.
- Blogdan platform özel içerik ve carousel türetme, takvim çakışma kontrolü, kampanya serisi.
- Performans: izin verilen impressions, reach, engagement, clicks, follower değişimi; olmayan alanlar N/A.
## Kabul
- Sahte bağlantı durumu yok; bağlı hesapla test paylaşımı yalnız açık onay sonrası.
- Marka templating bütün postlarda tutarlı, responsive, geri alınabilir, rol kontrolü ve denetim kaydı var.
