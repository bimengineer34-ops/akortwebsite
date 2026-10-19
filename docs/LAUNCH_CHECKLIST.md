# Canlıya Geçiş Kontrol Listesi

Son otomatik tarama: `node scripts/launch-audit.mjs <adres>` (yalnızca GET; kritik bulgu varsa çıkış kodu 1).
Diğer denetimler: `npm run check`, `npm run audit:seo`, `node scripts/link-scan.mjs dist`, `node scripts/admin/*.mjs` (test paketleri).

## Kod tarafında hazır
- [x] 113 sayfa sitemap'te; başlık/açıklama/canonical/h1/lang/viewport/og:image/JSON-LD denetimi **0 kritik**
- [x] Güvenlik başlıkları (CSP, nosniff, referrer, panelde X-Frame-Options); `/.env`, `/data`, `/api/admin/*` dışarıya kapalı
- [x] Panel: 31 sayfa masaüstü + mobilde hatasız, 7 rol, CSRF/Origin/hız sınırı, 2FA, günlük, otomatik günlük yedek (son 15)
- [x] Ana sayfa ~235 KB (9 istek); görseller AVIF/WebP
- [x] Yasal metin TASLAKLARI yazıldı (`src/content/legal/*.md`) — `approved: false`

## Canlıya almadan ÖNCE sizden gerekenler (kod yazamaz)
1. **Doğrulanmış firma bilgileri** — `src/data/site.ts`: e-posta, telefon (referanslarda 3 farklı numara var), adres, sosyal medya URL'leri. Doğrulanana kadar sitede gizli.
2. **Yasal metinler** — `kvkk.md`, `gizlilik-politikasi.md`, `cerez-politikasi.md`: `[KÖŞELİ PARANTEZ]` alanları doldurun, hukuk danışmanına onaylatın, sonra `approved: true` yapın. Formlar kişisel veri topladığı için KVKK metni **zorunlu**.
3. **Alan adı** — `PUBLIC_SITE_URL`, `public/robots.txt`, sitemap adresi (kesinleşti: `www.akortmuhendislik.com`; DNS + SSL canlı kurulumda).
4. **E-posta bildirimi (SMTP)** — `.env`: `SMTP_HOST/PORT/USER/PASS/FROM`; alıcılar panel → Ayarlar. Yoksa yeni talepler yalnızca panelde görünür.
5. **Gerçek içerik** — projeler (şu an `örnek`/noindex), blog yazıları, "rakamlarla AKORT", kilometre taşları: doğrulanmayan hiçbir rakam yayınlanmaz.
6. **Hizmet metinlerinin firma onayı** — `src/data/serviceContent/*.ts` genel mühendislik bilgisiyle yazıldı (Çelik Yapı dahil); firmanın sunmadığı hizmet varsa silin.

## Sunucu ayarları (docs/DEPLOY.md)
- `NODE_ENV=production`, `TRUST_PROXY=true` (ters vekil arkasında), `SECURE_COOKIES=true`, `HOST=127.0.0.1`
- İlk yönetici: `/yonetim/` kurulum ekranı (`.env` içinde `ADMIN_PASSWORD` bırakmayın; kurulumdan sonra silin)
- `SECRETS_KEY` veya `data/.vault-key` yedeği (kaybolursa kayıtlı API anahtarları çözülemez)
- Yedekler sunucuda kalır → düzenli olarak **sunucu dışına** kopyalayın (otomatik yedek: günlük, `AUTO_BACKUP=false` ile kapanır)
- HTTPS + HSTS (ters vekil/CDN'de), gerekirse Cloudflare

## Vercel / Supabase ile test yayını yaparsanız
- `vercel.json` içindeki `X-Robots-Tag: noindex` test içindir → **gerçek yayında kaldırın**
- Statik site çalışır; **panel ve form uç noktaları çalışmaz** (kalıcı disk/SQLite yok). Formlar için `PUBLIC_CONTACT_ENDPOINT` / `PUBLIC_NEWSLETTER_ENDPOINT` (örn. Supabase fonksiyonu) gerekir.
- Tam panel için kalıcı diskli bir sunucu (Veridyen/VPS/Railway/Render/Fly) gerekir.

## Yayın sonrası
- [ ] Google Search Console'a mülkü ekleyip `sitemap-index.xml` gönderin
- [ ] Gerçek cihazlarda (iOS Safari, Android Chrome, Firefox) elle kontrol; Lighthouse ölçümü
- [ ] İletişim formundan gerçek bir talep gönderip e-posta + panel akışını doğrulayın
- [ ] İngilizce yayın: panel → İngilizce Yayın (EN) → AI sağlayıcı anahtarı → çevir; sonucu gözden geçirin
- [ ] Sosyal hesap bağlantıları için her platformda geliştirici uygulaması + (Meta/LinkedIn/TikTok) uygulama incelemesi
