# Güvenlik

Bu belge (1) uygulamada ne yapıldığını, (2) sunucuda sizin yapmanız gerekenleri ve (3) dürüst sınırları anlatır. **Hiçbir sistem "hacklenemez" değildir**; amaç saldırı yüzeyini küçültmek, saldırıyı zorlaştırmak ve olursa zararı sınırlamaktır.

## Kaynak koduna erişim — nasıl korunuyor?

- Sunucu **yalnızca** üç yerden dosya sunar: derlenmiş site (`dist/`), yönetim arayüzü (`server/admin/`) ve yüklenen medya (`data/media/`). Kaynak kod (`src/`, `server/`, `scripts/`), `data/` (veritabanı, yedekler), `.env`, `.git`, `node_modules`, `package.json` hiçbir URL ile sunulmaz. 21 farklı yol ve `..`, `%2e%2e`, `..%2f` gibi gezinme (path traversal) denemesinin hiçbiri dosya sızdırmadı (test: bu rehberin sonundaki komut).
- `dist/` içinde kaynak haritası (`.map`), `.env`, veritabanı veya sır izi yok (tarandı).
- **Dürüst sınır:** Tarayıcıya giden her şey (sitenin CSS/JS dosyaları, panelin arayüz JS'i) tanımı gereği tarayıcıda görülebilir; bu kod gizli bilgi içermez. Gizli olan her şey (parola özetleri, oturumlar, SMTP parolası, form kayıtları) sunucuda kalır. Kod gizleme (obfuscation) güvenlik sağlamaz, yapılmadı.
- Depoyu (Git) **herkese açık** bir yere koymayın; sunucuda proje klasörü yalnızca uygulama kullanıcısı tarafından okunabilir olsun (aşağıda).

## Uygulamada yapılanlar

| Alan | Önlem |
|---|---|
| Parolalar | scrypt (tuzlu, yavaş hash); en az 10 karakter, harf+rakam |
| Giriş | 5 başarısız denemede 15 dk kilit (e-posta ve IP bazlı), zamanlama farkıyla kullanıcı keşfi engellenir |
| Oturum | Rastgele 256 bit belirteç (veritabanında yalnızca özeti), `HttpOnly` + `SameSite=Strict` + `Secure` çerez, 12 saat, parola değişince diğer oturumlar kapanır |
| CSRF | Her durum değiştiren istekte CSRF belirteci + `Origin` doğrulaması |
| 2 adımlı doğrulama | Panelde **Hesabım › 2 adımlı doğrulama** (TOTP: Google/Microsoft Authenticator, Authy, 1Password uyumlu), 8 tek kullanımlık kurtarma kodu, aynı kodun yeniden kullanımı (replay) engelli, yönetici başka kullanıcının 2FA'sını sıfırlayabilir. **Tüm yönetici hesapları için açmanızı öneririz.** |
| Yetki | Rol kontrolü (yönetici/editör) sunucuda; son yöneticiyi/kendini pasifleştirme engelli |
| Hız sınırı | API'de IP başına 300 istek/dk; formlarda saatte 5 gönderim; honeypot alanı |
| Girdi doğrulama | İçerik belgeleri şemaya göre doğrulanır; bağlantılar yalnızca `/`, `#`, `http(s)`, `mailto`, `tel`; `javascript:` reddedilir |
| Markdown (blog/proje) | Ham HTML ve `javascript:` bağlantıları **temizlenir** (editör hesabı ele geçirilse bile ziyaretçilere kod enjekte edilemez) — test edildi |
| Yükleme | Dosya türü içerikten (sihirli bayt) doğrulanır, SVG kabul edilmez, EXIF/konum bilgisi silinir, medya `nosniff` + kısıtlayıcı CSP ile sunulur |
| Başlıklar | `Content-Security-Policy` (site ve panel), `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, `Cross-Origin-Opener-Policy`, HSTS (HTTPS'te) |
| Günlük | Girişler, başarısız girişler, içerik/yayın/kullanıcı işlemleri `Etkinlik günlüğü`nde |
| Yayın | Derleme geçici klasörde yapılır; hata olursa canlı site değişmez; önceki yayına dönülebilir |
| Yedek | Panelden tek tıkla zip (veritabanı + içerik + medya) |
| Bağımlılıklar | `npm audit`: 0 açık; çalışma zamanında yeni paket eklenmez, panel bağımlılıksızdır |
| Hata yanıtları | İç hata ayrıntısı dışarı verilmez ("Sunucu hatası"), ayrıntı yalnızca günlüğe yazılır |

CSP kademeli açılabilir: `CSP_MODE=report-only` (yalnızca tarayıcı konsoluna uyarı), `CSP_MODE=off` (kapalı, yalnızca teşhis için). Varsayılan `enforce`.

## Sunucuda sizin yapmanız gerekenler (en önemlisi)

1. **HTTPS zorunlu** (Let's Encrypt) ve `SECURE_COOKIES=true`; HTTP'yi HTTPS'e yönlendirin.
2. **Uygulamayı root olarak çalıştırmayın.** Ayrı kullanıcı (`akort`) açın; proje klasörü `chmod 750`, `.env` ve `data/` `chmod 700/600`.
3. **systemd sertleştirme** (`docs/DEPLOY.md` içindeki servise ekleyin):
   ```ini
   NoNewPrivileges=true
   PrivateTmp=true
   ProtectSystem=strict
   ProtectHome=true
   ReadWritePaths=/srv/akort-web/data /srv/akort-web/dist /srv/akort-web/dist-staging /srv/akort-web/dist-previous /srv/akort-web/src/content /srv/akort-web/src/assets/images/uploads /srv/akort-web/public/bim
   ProtectKernelTunables=true
   RestrictAddressFamilies=AF_INET AF_INET6 AF_UNIX
   ```
4. **Güvenlik duvarı:** yalnızca 80/443 ve SSH açık; Node portu (4321) yalnızca `127.0.0.1`'e bağlı (`HOST=127.0.0.1`). SSH için parola girişini kapatın, anahtar kullanın; `fail2ban` kurun.
5. **nginx:** `/yonetim` için isteğe bağlı IP kısıtı; nokta ile başlayan dosyaları reddedin:
   ```nginx
   location ~ /\. { deny all; }
   # location /yonetim/ { allow 203.0.113.10; deny all; proxy_pass http://127.0.0.1:4321; }
   ```
6. **İlk giriş sonrası:** `.env` içindeki `ADMIN_EMAIL`/`ADMIN_PASSWORD` satırlarını silin, parolayı değiştirin, gereksiz kullanıcıları kaldırın.
7. **Güncellemeler:** işletim sistemini ve Node'u güncel tutun; ayda bir `npm audit` ve `npm audit fix`.
8. **Yedek:** panelden düzenli yedek indirip **sunucu dışında** saklayın (sunucu ele geçirilirse yedekler de gider).
9. **Alan adı hesabı ve barındırma paneli** için 2 adımlı doğrulama açın; saldırıların çoğu uygulamadan değil buralardan olur.

## Henüz yapılmayanlar (öncelik sırasıyla)

- 2 adımlı doğrulamanın tüm yöneticiler için **zorunlu** kılınması (şimdilik isteğe bağlı).

- Panelde "şüpheli giriş" bildirimi (yeni IP'den giriş e-postası).
- Sızma testi (penetration test): canlıya çıkmadan önce bağımsız bir uzmana yaptırmanız önerilir.

## Doğrulama komutu (kaynak sızıntısı)

Sunucu açıkken:

```bash
for p in /.env /data/akort.db /server/index.mjs /src/data/site.ts /package.json /.git/config "/yonetim/..%2f.env" "/medya/..%2fdata/akort.db"; do
  printf "%s -> " "$p"; curl -s -o /dev/null -w "%{http_code} %{content_type}\n" "http://localhost:4321$p"
done
```
Beklenen: `404`, ya da `200 text/html` (site/panel kabuğu; dosya içeriği değil).
