# Dağıtım (Veridyen veya herhangi bir Linux sunucu)

Site ve yönetim paneli **tek Node sürecidir** (`server/index.mjs`): statik siteyi (`dist/`), `/yonetim` panelini ve `/api` uç noktalarını aynı portta sunar.

## Gereksinimler

- **Node.js ≥ 22.12** (yerleşik SQLite için). `node -v` ile kontrol edin. Veridyen hizmetiniz Node 22+ desteklemiyorsa VPS/sunucu paketi gerekir.
- Panelden "Yayınla" siteyi sunucuda yeniden derlediği için **geliştirme bağımlılıkları da kurulu olmalı** (`npm ci`). Derleme sırasında ~1–2 GB RAM kullanılabilir.
- Bir alan adı ve HTTPS (nginx/Caddy ters vekil + Let's Encrypt).

## Kurulum

```bash
# 1) Dosyaları sunucuya kopyalayın (data/, dist/, node_modules/ hariç), sonra:
cd /srv/akort-web
npm ci

# 2) Ortam değişkenleri (.env dosyası, git'e girmez)
cat > .env <<'EOF'
NODE_ENV=production
PORT=4321
HOST=127.0.0.1
TRUST_PROXY=true
SECURE_COOKIES=true
PUBLIC_SITE_URL=https://www.ALANADINIZ.com
EOF

# 3) İlk derleme (dist/ ve içerik varsayılanları oluşur)
npm run build

# 4) Başlat
npm run start
```

İlk açılışta `https://ALANADINIZ/yonetim/` adresi **kurulum ekranını** gösterir; ilk yönetici hesabını orada oluşturun. (İsterseniz `ADMIN_EMAIL` + `ADMIN_PASSWORD` verip ilk hesabın otomatik oluşmasını sağlayabilirsiniz; ilk girişten sonra bu satırları silin.)

## Süreç yöneticisi (systemd örneği)

```ini
# /etc/systemd/system/akort.service
[Unit]
Description=AKORT web + yonetim paneli
After=network.target

[Service]
WorkingDirectory=/srv/akort-web
EnvironmentFile=/srv/akort-web/.env
ExecStart=/usr/bin/node server/index.mjs
Restart=always
User=akort

[Install]
WantedBy=multi-user.target
```

`sudo systemctl enable --now akort`

## nginx (HTTPS ters vekil)

```nginx
server {
  server_name www.ALANADINIZ.com;
  client_max_body_size 30m;           # medya yükleme
  location / {
    proxy_pass http://127.0.0.1:4321;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
  # certbot --nginx ile HTTPS eklenir
}
```

## Veri ve yedek

- Tüm değişen veri `data/` klasöründedir: `akort.db` (kullanıcılar, formlar, taslaklar, medya kayıtları), `content/published/` (yayınlanmış içerik), `media/` (yüklenen dosyalar), `backups/`.
- **Panel → Yedekler** bu verileri tek `.zip` olarak üretir; düzenli indirip sunucu dışında saklayın.
- Blog/proje/yasal metin dosyaları `src/content/` altındadır (panel buraya yazar). Bu klasör de yedeğe/sürüm kontrolüne dahil edilmelidir.
- **Geri yükleme:** servisi durdurun → zip içindeki `akort.db` dosyasını `data/akort.db` yerine, `media/` ve `content/` klasörlerini `data/` altına kopyalayın → servisi başlatın → panelden "Yeniden derle".

## Güncelleme (kod)

```bash
git pull && npm ci && npm run build && sudo systemctl restart akort
```

`data/` ve `src/content/` klasörlerini ezmeyin.

## Güvenlik notları

- `/yonetim` ve `/api/admin` yalnızca oturumla erişilir; `robots.txt` bunları engeller, panel `noindex` gönderir.
- Parolalar scrypt ile saklanır; 5 başarılı olmayan girişten sonra 15 dk kilit.
- Panel yalnızca HTTPS arkasında kullanılmalıdır (`SECURE_COOKIES=true`).
- İsterseniz nginx'te `/yonetim` için IP kısıtı ekleyebilirsiniz.

## Ortam değişkenleri

| Değişken | Varsayılan | Açıklama |
|---|---|---|
| `PORT` / `HOST` | 4321 / 0.0.0.0 | Dinleme adresi |
| `PUBLIC_SITE_URL` | https://www.akortmuhendislik.com | Sitemap/kanonik adres (derlemede kullanılır) |
| `SECURE_COOKIES` | production'da true | Çerezler yalnızca HTTPS |
| `TRUST_PROXY` | false | nginx arkasında true |
| `DATA_DIR` | `data` | **Derleme ile aynı klasör olmalı** (içerik motoru `data/` kullanır) |
| `MAX_UPLOAD_MB` | 25 | Medya yükleme sınırı |
| `SESSION_HOURS` | 12 | Oturum süresi |

## E-posta bildirimi (SMTP)

Yeni form talebi geldiğinde panelde tanımlı alıcılara e-posta gider. `.env` içine ekleyin:

```
SMTP_HOST=mail.alanadiniz.com
SMTP_PORT=587          # 465 ise SSL/TLS, 587 ise STARTTLS
SMTP_USER=bildirim@alanadiniz.com
SMTP_PASS=********
SMTP_FROM="AKORT Mühendislik <bildirim@alanadiniz.com>"
```

Sunucuyu yeniden başlatın; **Panel → Ayarlar (e-posta)** sayfasında alıcıları girin ve "Test e-postası gönder" ile doğrulayın. Parola veritabanına yazılmaz.

## Sitedeki görselleri panelden değiştirme

**Sayfa metinleri › Genel ve Menü › Site görselleri** belgesinde hero, intro, hizmet ve sektör görselleri medya kütüphanesinden seçilir (önce **Medya** sayfasından yükleyin). Taslağı kaydedip **Yayınla**; sunucu seçilen dosyayı `src/assets/images/uploads/` altına kopyalar ve derlemede optimize eder. Boş bırakılan yer yerleşik görseli kullanır.
