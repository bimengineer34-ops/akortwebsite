# GitHub kaynak listesi — otomatik hepsini kurma
Değerlendirme yapılırken repo güncelliği, lisans, paket sürümü, güvenlik, build stack ve mevcut bileşen eşdeğerleri kontrol edilmeli.

| Kaynak | Link | Kullanım | Karar koşulu |
|---|---|---|---|
| Tiptap | https://github.com/ueberdosis/tiptap | Rich text editor | Mevcut editörü değiştirmeyi gerektirecek mi? Lisans/eklenti şartlarını doğrula |
| FullCalendar | https://github.com/fullcalendar/fullcalendar | Social calendar | Mevcut takvim yoksa; premium özellik lisanslarını incele |
| Chart.js | https://github.com/chartjs/Chart.js | KPI grafikleri | Mevcut chart paketi yoksa |
| Sharp | https://github.com/lovell/sharp | Node image pipeline | Stack'te Node servis/build uygunsa; değilse native alternatifi |
| Hangfire | https://github.com/HangfireIO/Hangfire | Background jobs | ASP.NET ise; lisans ve mevcut job sistemi değerlendir |
| Playwright | https://github.com/microsoft/playwright | E2E + screenshot regression | Mevcut test altyapısı yoksa/uygunsa |
| RSSHub | https://github.com/DIYgod/RSSHub | RSS connector | İzinli erişim ve kaynağın ToS uygunluğu teyit edilmişse |
| Mercury Parser | https://github.com/postlight/parser | Article extraction | Güncel bakım/alternatif/güvenlik durumunu kontrol et |
| Redis | https://github.com/redis/redis | Distributed caching | Mevcut host ve yük gerektiriyorsa |
| Fabric.js | https://github.com/fabricjs/fabric.js | Layered template editor | UI stack uyarsa, image renderer mantığına uygun |

Claude internet erişimi varsa stable release docs ve lisans kontrolü yapsın; yoksa gereksiz paket indirmek yerine sürüm sabitleme için todo bıraksın. GitHub sayfası API/servis bağlantısının yerine geçmez.
