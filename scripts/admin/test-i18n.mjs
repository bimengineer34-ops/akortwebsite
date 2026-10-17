// İngilizce site çekirdeği birim testi (sahte çevirmenle; gerçek AI çağrısı yok): node scripts/admin/test-i18n.mjs
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'akort-i18n-'));
process.env.DATA_DIR = path.join(tmp, 'data');
process.env.I18N_FAKE = '1';
process.env.PUBLIC_SITE_URL = 'https://www.example.test';
delete process.env.NODE_ENV;
const i18n = await import('../../server/lib/ext/i18n.mjs');
const { setSetting } = await import('../../server/lib/db.mjs');

const dist = path.join(tmp, 'dist');
fs.mkdirSync(path.join(dist, 'hizmetler'), { recursive: true });
const page = (title, body, extraHead = '') => `<!doctype html><html lang="tr"><head><meta charset="utf-8"><title>${title}</title><meta name="description" content="Mühendislik danışmanlığı hizmetleri"><link rel="canonical" href="https://www.example.test/hizmetler/bim">${extraHead}<script type="application/ld+json">{"@context":"https://schema.org","@type":"Service","name":"BIM Danışmanlığı","url":"https://www.example.test/hizmetler/bim","description":"Koordinasyon hizmeti"}</script></head><body><header><a href="/arama" aria-label="Sitede ara"><svg><path d="M0"/></svg></a><span data-lang-switch hidden></span></header><main>${body}<script>const x = "Türkçe metin değişmemeli";</script></main></body></html>`;
fs.writeFileSync(path.join(dist, 'index.html'), page('Ana Sayfa | AKORT', '<h1>Uyumun <em>Mühendisliği</em></h1><p>Projenizi <a href="/hizmetler/bim" class="lnk">BIM hizmetlerimizle</a> güçlendirin. <br>Hemen <b>başlayın</b>.</p><img src="/medya/a.png" alt="Şantiye görüntüsü"><a href="/belge.pdf">Broşür</a><form action="/api/iletisim" data-messages=\'{"success":"Mesajınız alındı","error":"Bir hata oluştu"}\'><input placeholder="Adınız" type="text"><button>Gönder</button></form><code>kod bloğu</code>'));
fs.writeFileSync(path.join(dist, 'hizmetler', 'bim.html'), page('BIM | AKORT', '<h1>BIM Danışmanlığı</h1><p>Koordinasyon hizmeti.</p><a href="/">Ana sayfa</a>'));
fs.writeFileSync(path.join(dist, 'arama-index.json'), JSON.stringify([{ title: 'BIM Danışmanlığı', url: '/hizmetler/bim', type: 'Hizmet', text: 'Koordinasyon hizmeti.' }]));
fs.writeFileSync(path.join(dist, 'sitemap-0.xml'), '<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>https://www.example.test/</loc></url><url><loc>https://www.example.test/hizmetler/bim</loc></url></urlset>');

let pass = 0, fail = 0;
const t = (name, ok, extra = '') => { ok ? pass++ : fail++; console.log(`${ok ? '✓' : '✗'} ${name}${ok ? '' : ` — ${extra}`}`); };
const rd = (p) => fs.readFileSync(path.join(dist, p), 'utf8');

// 1) kapalıyken hiçbir şey üretilmez
setSetting('i18n.mode', 'kapali');
await i18n.generate(dist);
t('kapalı modda /en üretilmez', !fs.existsSync(path.join(dist, 'en')));
t('kapalı modda TR sayfa bozulmaz', rd('index.html').includes('Uyumun'));

// 2) açık, çeviri yok → sayfalar yayınlanmaz, eksikler bulunur
setSetting('i18n.mode', 'otomatik');
const r0 = await i18n.generate(dist);
t('çeviri yokken EN sayfa yayınlanmaz', r0.published === 0 && !fs.existsSync(path.join(dist, 'en', 'index.html')));
const missing = i18n.scanMissing(dist);
t('eksik metinler bulundu (başlık, paragraf, alt, placeholder, JSON-LD, mesajlar, indeks)', missing.size >= 12, String(missing.size));
t('kod bloğu ve script içeriği çeviri adayı değil', ![...missing.values()].some((k) => /kod bloğu|Türkçe metin değişmemeli/.test(k)));
t('satır içi etiketler yer tutucuya çevrildi', [...missing.values()].some((k) => /<1>BIM hizmetlerimizle<\/1> güçlendirin/.test(k)), JSON.stringify([...missing.values()].slice(0, 6)));

// 3) sahte çeviri → yayın
await i18n.translateMissing(missing);
const r1 = await i18n.generate(dist);
t('çeviri sonrası tüm sayfalar yayınlandı', r1.published === 2 && fs.existsSync(path.join(dist, 'en', 'index.html')) && fs.existsSync(path.join(dist, 'en', 'services', 'bim.html')), JSON.stringify(r1.pages?.map((p) => [p.url, p.missing])));
const en = rd('en/index.html');
t('EN: html lang="en"', /<html[^>]*lang="en"/.test(en));
t('EN: metin çevrildi', en.includes('[EN] Projenizi') || en.includes('[EN] '));
t('EN: satır içi bağlantı korundu ve /en önekli', /<a[^>]*href="\/en\/services\/bim"[^>]*class="lnk"|<a[^>]*class="lnk"[^>]*href="\/en\/services\/bim"/.test(en), en.slice(en.indexOf('<main'), en.indexOf('<main') + 400));
t('EN: kalın/vurgu etiketi korundu', /<b>\[EN\] başlayın<\/b>|<b>\[EN\] başlayın/.test(en) || en.includes('<b>'));
t('EN: alt ve placeholder çevrildi', en.includes('alt="[EN] Şantiye görüntüsü"') && en.includes('placeholder="[EN] Adınız"'));
t('EN: /api, /medya ve dosya bağlantıları değişmedi', en.includes('action="/api/iletisim"') && en.includes('src="/medya/a.png"') && en.includes('href="/belge.pdf"'));
t('EN: script içeriği değişmedi', en.includes('Türkçe metin değişmemeli'));
t('EN: kod bloğu değişmedi', en.includes('<code>kod bloğu</code>'));
t('EN: data-messages çevrildi', /data-messages="[^"]*\[EN\] Mesajınız alındı/.test(en), en.match(/data-messages="[^"]*"/)?.[0]);
t('EN: meta açıklama çevrildi', /<meta name="description" content="\[EN\]/.test(en));
t('EN: canonical /en', en.includes('rel="canonical" href="https://www.example.test/en/services/bim"') || /canonical[^>]*\/en\/hizmetler\/bim/.test(en));
t('EN: hreflang tr+en+x-default', en.includes('hreflang="tr"') && en.includes('hreflang="en"') && en.includes('x-default'));
t('EN: dil anahtarı TR\'ye gider', /data-lang-switch[^>]*><a href="\/hizmetler\/bim" hreflang="tr"[^>]*class="lang-opt"/.test(rd('en/services/bim.html')), rd('en/services/bim.html').match(/<span data-lang-switch[\s\S]*?<\/span>/)?.[0]);
t('EN: JSON-LD çevrildi ve url /en', /"name":"\[EN\] BIM Danışmanlığı"/.test(en) && en.includes('"url":"https://www.example.test/en/services/bim"'));
const tr = rd('index.html');
t('TR: dil anahtarı EN\'e gider', /data-lang-switch[^>]*><span class="lang-cur" lang="tr"[^>]*>TR<\/span><a href="\/en" hreflang="en"/.test(tr), tr.match(/<span data-lang-switch[\s\S]*?<\/span>/)?.[0]);
t('TR: içerik bozulmadı', tr.includes('Uyumun <em>Mühendisliği</em>') && tr.includes('Türkçe metin değişmemeli'));
t('TR: hreflang eklendi', tr.includes('hreflang="en"'));
t('EN arama indeksi üretildi, url /en', fs.existsSync(path.join(dist, 'en', 'arama-index.json')) && JSON.parse(rd('en/arama-index.json'))[0].url === '/en/services/bim');
const sm = rd('sitemap-0.xml');
t('sitemap: EN adresleri + xhtml alternatifleri', sm.includes('https://www.example.test/en/services/bim') && sm.includes('xmlns:xhtml') && sm.includes('hreflang="en"'));
t('sitemap yedeği alındı', fs.existsSync(path.join(dist, 'sitemap-0.tr.xml')));

// 4) idempotent: ikinci üretim aynı çıktı
const before = rd('index.html');
await i18n.generate(dist);
t('ikinci üretim TR sayfayı değiştirmez (idempotent)', rd('index.html') === before && (rd('index.html').match(/data-lang-switch/g) ?? []).length === 1);
t('hreflang tekrarlanmıyor', (rd('index.html').match(/hreflang="en"/g) ?? []).length === 2); // 1 link rel + 1 anahtar

// 5) TR içerik değişirse eski EN kalmaz (tam çeviri olmayan sayfa atlanır)
fs.writeFileSync(path.join(dist, 'hizmetler', 'bim.html'), page('BIM | AKORT', '<h1>BIM Danışmanlığı</h1><p>Yepyeni bir paragraf eklendi.</p>'));
const r2 = await i18n.generate(dist);
t('metni değişen sayfa çevrilene kadar EN\'de yayınlanmaz', !fs.existsSync(path.join(dist, 'en', 'services', 'bim.html')) && r2.published === 1);
t('değişen sayfanın TR\'sinde EN anahtarı kalkar', /data-lang-switch hidden/.test(rd('hizmetler/bim.html')));

// 6) elle düzenleme korunur, etiketsiz çeviri reddedilir
const row = (await import('../../server/lib/db.mjs')).q.get("SELECT hash, src FROM i18n_tm WHERE src LIKE '%<1>%' LIMIT 1");
let rejected = false;
try { i18n.editTm(row.hash, 'etiket yok', false, { email: 'test' }); } catch (e) { rejected = e.status === 422; }
t('etiketleri bozan elle çeviri reddedilir', rejected);
i18n.editTm(row.hash, row.src.replace(/[^<>/\d\s]+/g, 'X').replace(/\s+/g, ' '), true, { email: 'test' });
await i18n.translateMissing(new Map([[row.hash, row.src]]));
const st = (await import('../../server/lib/db.mjs')).q.get('SELECT status FROM i18n_tm WHERE hash = ?', row.hash).status;
t('onaylı çeviri yeniden çevirmede ezilmez', st === 'onayli', st);

// 7) kapatınca temizlik
setSetting('i18n.mode', 'kapali');
await i18n.generate(dist);
t('kapatınca /en silinir', !fs.existsSync(path.join(dist, 'en')));
t('kapatınca TR geri döner (hreflang/anahtar yok)', !rd('index.html').includes('hreflang="en"') && /data-lang-switch hidden/.test(rd('index.html')));
t('kapatınca sitemap eski haline döner', !rd('sitemap-0.xml').includes('/en/') && !fs.existsSync(path.join(dist, 'sitemap-0.tr.xml')));

// --- İngilizce adres (slug) eşlemesi
t('slug: varsayılan üst düzey eşleme', i18n.enPath('/hizmetler/bim') === '/en/services/bim' && i18n.enPath('/') === '/en' && i18n.enPath('/hakkimizda') === '/en/about');
t('slug: bilinmeyen adım Türkçe kalır', i18n.enPath('/blog/yeni-yazi') === '/en/blog/yeni-yazi');
i18n.setSlugs({ 'yeni-yazi': 'new-post', bim: 'bim-services' }, { email: 'x' });
t('slug: özel eşleme uygulanır', i18n.enPath('/blog/yeni-yazi') === '/en/blog/new-post' && i18n.enPath('/hizmetler/bim') === '/en/services/bim-services');
t('slug: aynı EN adres iki sayfaya verilemez', (() => { try { i18n.setSlugs({ a: 'same', b: 'same' }, { email: 'x' }); return false; } catch (e) { return /iki farklı/.test(e.message); } })());
t('slug: ayrılmış/geçersiz adres reddedilir', (() => { let n = 0; for (const v of ['api', 'Bad Slug']) { try { i18n.setSlugs({ a: v }, { email: 'x' }); } catch { n++; } } return n === 2; })());
i18n.setSlugs({}, { email: 'x' });
// --- eski adres yönlendirmesi
t('yönlendirme: Türkçe biçimli /en adresi güncele gider', i18n.legacyEnRedirect('/en/hizmetler/bim') === '/en/services/bim' && i18n.legacyEnRedirect('/en/services/bim') === null && i18n.legacyEnRedirect('/hizmetler') === null);
i18n.setSlugs({ 'uzmanlik-alanlari': 'expertise-areas' }, { email: 'x' });
t('yönlendirme: değiştirilen önceki EN adres yeniye gider', i18n.legacyEnRedirect('/en/expertise/kampusler') === '/en/expertise-areas/kampusler' && i18n.legacyEnRedirect('/en/uzmanlik-alanlari/kampusler') === '/en/expertise-areas/kampusler');
i18n.setSlugs({}, { email: 'x' });
t('yönlendirme: varsayılana dönünce zincir bozulmaz', i18n.legacyEnRedirect('/en/expertise-areas/x') === '/en/expertise/x' && i18n.legacyEnRedirect('/en/expertise/x') === null);

console.log(`\n${pass} geçti, ${fail} kaldı`);
try { fs.rmSync(tmp, { recursive: true, force: true }); } catch { /* SQLite dosyası süreç bitince serbest kalır */ }
process.exit(fail ? 1 : 0);
