// Genişletme paketi uçtan uca testi (çalışan sunucuya karşı): node scripts/admin/e2e-ext.mjs [http://localhost:4332]
// Yönetici bilgileri .env içindeki ADMIN_EMAIL / ADMIN_PASSWORD'dan okunur (yoksa test atlanır). Test kayıtları sonunda temizlenir.
import '../../server/lib/config.mjs';

const base = process.argv[2] ?? `http://localhost:${process.env.PORT || 4321}`;
const email = process.env.ADMIN_EMAIL, password = process.env.ADMIN_PASSWORD;
if (!email || !password) { console.log('ADMIN_EMAIL/ADMIN_PASSWORD yok — test atlandı'); process.exit(0); }

let cookie = '', csrf = '';
const call = async (method, path, body) => {
  const r = await fetch(base + path, { method, headers: { Accept: 'application/json', ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), Cookie: cookie, ...(method !== 'GET' ? { 'X-CSRF-Token': csrf, Origin: base } : {}) }, body: body !== undefined ? JSON.stringify(body) : undefined });
  const sc = r.headers.getSetCookie?.() ?? [];
  if (sc.length) cookie = sc.map((c) => c.split(';')[0]).join('; ');
  let data = null; try { data = await r.json(); } catch { /* */ }
  return { status: r.status, data };
};
let pass = 0, fail = 0;
const t = (name, ok, extra = '') => { ok ? pass++ : fail++; console.log(`${ok ? '✓' : '✗'} ${name}${ok ? '' : ` — ${extra}`}`); };

const login = await call('POST', '/api/admin/giris', { email, password });
t('giriş', login.status === 200 && login.data.ok, JSON.stringify(login.data));
const st = await call('GET', '/api/admin/durum'); csrf = st.data.user.csrf;
const X = '/api/admin/x';

// "Beni hatırla": çerez ömrü
const maxAge = async (remember) => {
  const r = await fetch(`${base}/api/admin/giris`, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: base }, body: JSON.stringify({ email, password, remember }) });
  return Number(/max-age=(\d+)/i.exec(r.headers.get('set-cookie') ?? '')?.[1]);
};
t('"Beni hatırla" kapalıyken oturum çerezi kısa (saatlik)', (await maxAge(false)) <= 24 * 3600);
t('"Beni hatırla" açıkken oturum çerezi 30 gün', (await maxAge(true)) === 30 * 24 * 3600);
// entegrasyonlar
const ig = await call('GET', `${X}/entegrasyonlar`);
t('entegrasyon durumu: hiçbir sosyal platform "bağlı" değil', ig.status === 200 && ig.data.other.every((o) => o.connected === false));
t('AI sağlayıcıları listelendi', ig.data.providers.length === 3);
// sır kasası testleri GERÇEK kullanıcı anahtarına dokunmaz: OpenAI zaten bağlıysa bu bölüm atlanır
const openaiConnected = ig.data.providers.find((p) => p.id === 'openai')?.connected;
if (openaiConnected) console.log('(OpenAI anahtarı kayıtlı — kasa testleri gerçek anahtarı korumak için atlandı)');
else {
  const g0 = await call('POST', `${X}/ai/uret`, { provider: 'openai', task: 'kisalt', text: 'Merhaba dünya' });
  t('anahtar yokken AI üretimi 409 "Bağlantı gerekli"', g0.status === 409 && /bağlantı gerekli/i.test(g0.data.error), JSON.stringify(g0.data));
  const secret = 'sk-test-' + 'x'.repeat(24);
  const sk = await call('PUT', `${X}/ai/openai/anahtar`, { key: secret });
  t('anahtar kaydedildi, yanıtta yalnızca maskeli ipucu', sk.status === 200 && !JSON.stringify(sk.data).includes(secret), JSON.stringify(sk.data));
  const ig2 = await call('GET', `${X}/entegrasyonlar`);
  t('entegrasyon listesi anahtarı sızdırmıyor', !JSON.stringify(ig2.data).includes(secret));
  const bad = await call('POST', `${X}/ai/openai/test`);
  t('sahte anahtarla bağlantı testi hata döner (401/502/429)', [401, 502, 429, 503].includes(bad.status), JSON.stringify(bad));
  await call('DELETE', `${X}/ai/openai/anahtar`);
}
// SEO
const scan = await call('GET', `${X}/seo/tarama?yenile=1`);
t('SEO taraması çalışıyor', scan.status === 200 && scan.data.total > 0, JSON.stringify(scan.data).slice(0, 200));
t('SEO taraması sayfa başına puan üretiyor', scan.data.pages?.every((p) => typeof p.score === 'number'));
const speed = await call('GET', `${X}/seo/hiz`);
t('hız raporu gerçek dosya boyutu veriyor', speed.status === 200 && speed.data.available && speed.data.html.count > 0);
const ents = await call('GET', `${X}/seo/girdiler`);
t('SEO editörü girdileri listeliyor', ents.status === 200 && ents.data.rows.length > 0);
// Social
const mk = await call('POST', `${X}/sosyal/gonderiler`, { title: 'E2E test', body: 'Test metni', platforms: ['linkedin'], scheduled_at: '2030-01-01T10:00' });
t('sosyal gönderi oluşturuldu (taslak)', mk.status === 200 && mk.data.status === 'taslak', JSON.stringify(mk.data));
const pid = mk.data.id;
const skip = await call('POST', `${X}/sosyal/gonderiler/${pid}/gecis`, { to: 'planlandi' });
t('onaysız doğrudan planlama engellendi', skip.status === 409, JSON.stringify(skip.data));
const pub = await call('POST', `${X}/sosyal/gonderiler/${pid}/gecis`, { to: 'yayimlandi' });
t('"yayımlandı" doğrudan verilemez', pub.status === 409);
t('onaya gönder', (await call('POST', `${X}/sosyal/gonderiler/${pid}/gecis`, { to: 'onay_bekliyor' })).status === 200);
const ap = await call('POST', `${X}/sosyal/gonderiler/${pid}/gecis`, { to: 'onaylandi' });
t('yönetici onayı + hash mühürü', ap.status === 200 && ap.data.sealed === true, JSON.stringify(ap.data));
const edit = await call('PUT', `${X}/sosyal/gonderiler/${pid}`, { title: 'E2E test', body: 'DEĞİŞTİ', platforms: ['linkedin'], scheduled_at: '2030-01-01T10:00' });
t('onaydan sonra içerik değişince mühür düşer ve "revizyon" olur', edit.status === 200 && edit.data.status === 'revizyon' && edit.data.sealed === false, JSON.stringify(edit.data));
const long = await call('POST', `${X}/sosyal/gonderiler`, { title: 'X uzun', body: 'a'.repeat(300), platforms: ['x'] });
const lg = await call('POST', `${X}/sosyal/gonderiler/${long.data.id}/gecis`, { to: 'onay_bekliyor' });
t('X için 280 karakter sınırı doğrulaması', lg.status === 422, JSON.stringify(lg.data));
await call('DELETE', `${X}/sosyal/gonderiler/${pid}`); await call('DELETE', `${X}/sosyal/gonderiler/${long.data.id}`);
const sum = await call('GET', `${X}/sosyal`);
t('özel günler yalnızca kaynak notuyla', sum.data.specialDays.every((d) => d.source));
// Pazar / SSRF
const ssrf = await call('POST', `${X}/pazar/kaynaklar`, { name: 'yerel', url: 'http://127.0.0.1:4332/api/saglik', kind: 'rss' });
const ssrfFetch = ssrf.status === 200 ? await call('POST', `${X}/pazar/kaynaklar/${(await call('GET', `${X}/pazar`)).data.sources.find((s) => s.name === 'yerel')?.id}/cek`) : null;
t('yerel adrese RSS çekimi engellendi (SSRF)', ssrfFetch && ssrfFetch.status >= 400 && /engellendi|erişim/i.test(JSON.stringify(ssrfFetch.data)), JSON.stringify(ssrfFetch));
const pz = await call('GET', `${X}/pazar`);
for (const s of pz.data.sources.filter((x) => x.name === 'yerel')) await call('DELETE', `${X}/pazar/kaynaklar/${s.id}`);
const feed = await call('POST', `${X}/pazar/kaynaklar`, { name: 'E2E BBC', url: 'https://feeds.bbci.co.uk/news/technology/rss.xml', kind: 'rss' });
if (feed.status === 200) {
  const fid = (await call('GET', `${X}/pazar`)).data.sources.find((s) => s.name === 'E2E BBC').id;
  const f1 = await call('POST', `${X}/pazar/kaynaklar/${fid}/cek`);
  if (f1.status === 200) {
    t('RSS gerçek besleme okundu', f1.data.added > 0, JSON.stringify(f1.data));
    const f2 = await call('POST', `${X}/pazar/kaynaklar/${fid}/cek`);
    t('ikinci çekimde yinelenenler eklenmedi (dedupe/ETag)', f2.status === 200 && (f2.data.added === 0), JSON.stringify(f2.data));
    const items = await call('GET', `${X}/pazar/ogeler`);
    t('öğelerde kaynak URL ve tespit zamanı var', items.data.rows.every((r) => r.canonical_url && r.fetched_at));
  } else console.log(`(ağ yok / besleme okunamadı: ${f1.status} ${JSON.stringify(f1.data)} — RSS testi atlandı)`);
  await call('DELETE', `${X}/pazar/kaynaklar/${fid}`);
}
// Rakip & backlink
const cp = await call('POST', `${X}/rakipler`, { name: 'E2E', url: 'http://127.0.0.1:4332' });
const cid = (await call('GET', `${X}/rakipler`)).data.rows.find((r) => r.name === 'E2E')?.id;
const cc = await call('POST', `${X}/rakipler/${cid}/kontrol`);
t('rakip izleme yerel adresi engelliyor', cp.status === 200 && cc.status >= 400, JSON.stringify(cc));
await call('DELETE', `${X}/rakipler/${cid}`);
const bl = await call('POST', `${X}/backlink`, { name: 'E2E dizin', url: 'https://example.com', status: 'kazanildi' });
t('"kazanıldı" durumu elle verilemez', bl.status === 409, JSON.stringify(bl.data));
const bl2 = await call('POST', `${X}/backlink`, { name: 'E2E dizin', url: 'https://example.com', kind: 'dizin' });
const bid = (await call('GET', `${X}/backlink`)).data.rows.find((r) => r.name === 'E2E dizin')?.id;
t('backlink fırsatı eklendi', bl2.status === 200 && bid);
await call('DELETE', `${X}/backlink/${bid}`);
// KPI panosu (kullanıcı tanımlı)
const kp = await call('GET', `${X}/kpi`);
t('KPI panosu varsayılan kartlarla geliyor', kp.status === 200 && kp.data.cards.length >= 3 && kp.data.catalog.length >= 15, JSON.stringify(kp.data).slice(0, 200));
t('akış KPI\'larında seri uzunluğu = seçili gün', kp.data.cards.filter((c) => c.flow).every((c) => c.series.length === kp.data.range));
const kset = await call('PUT', `${X}/kpi`, { range: 7, cards: [{ id: 'visits', target: 100 }, { id: 'seo_score' }, { id: 'nope' }] });
t('KPI tercihi kaydedildi, bilinmeyen KPI atıldı', kset.status === 200 && kset.data.cards.length === 2 && kset.data.cards[0].target === 100, JSON.stringify(kset.data));
const kp2 = await call('GET', `${X}/kpi`);
t('kayıtlı tercih geri okunuyor (7 gün, hedefli kart)', kp2.data.range === 7 && kp2.data.cards[0].id === 'visits' && kp2.data.cards[0].target === 100);
t('geçersiz hedef reddedildi', (await call('PUT', `${X}/kpi`, { cards: [{ id: 'visits', target: -5 }] })).status === 400);
t('boş KPI listesi reddedildi', (await call('PUT', `${X}/kpi`, { cards: [] })).status === 400);
await call('PUT', `${X}/kpi`, { range: 30, cards: ['visits', 'forms', 'conversion', 'seo_score', 'social_awaiting'].map((id) => ({ id })) });
const gr = await call('GET', `${X}/grafik?gun=30`);
t('grafik verisi (30 günlük seriler + dağılımlar)', gr.status === 200 && gr.data.visits.length === 30 && gr.data.forms.length === 30 && Array.isArray(gr.data.socialStatus), JSON.stringify(gr.data).slice(0, 160));
// referans ekran uç noktaları (SEO / hız / pazar / rakip / sosyal / marka)
const so = await call('GET', `${X}/seo/ozet?gun=30`);
t('SEO genel bakış: gerçek tarama verisi + sitemap + schema', so.status === 200 && so.data.kpi.pages > 0 && so.data.health.passed >= 0 && so.data.schema.typeKinds > 0, JSON.stringify(so.data).slice(0, 160));
t('SEO genel bakış: sahte metrik yok (GSC alanları dönmüyor)', !('clicks' in so.data.kpi) && !('impressions' in so.data.kpi));
const ents2 = await call('GET', `${X}/seo/girdiler`);
const first = ents2.data.rows.find((r) => r.kind === 'blog');
const il = await call('GET', `${X}/seo/ic-baglanti/blog/${first.slug}`);
t('iç bağlantı önerisi çalışıyor', il.status === 200 && Array.isArray(il.data.rows));
const hz = await call('GET', `${X}/hiz`);
t('Speed Engine: yerel ağırlık ölçümü', hz.status === 200 && hz.data.local.available && hz.data.local.html.count > 0);
const lp = await call('POST', `${X}/hiz/test`, { url: 'http://127.0.0.1:4332', strategy: 'mobile' });
t('PageSpeed testi yerel adresi reddediyor', lp.status === 400, JSON.stringify(lp.data));
const cc2 = await call('POST', `${X}/hiz/onbellek-temizle`);
t('önbellek temizleme çalışıyor', cc2.status === 200 && typeof cc2.data.cleared === 'number');
const pr = await call('POST', `${X}/hiz/veritabani-temizle`);
t('veritabanı temizliği çalışıyor', pr.status === 200 && typeof pr.data.sessions === 'number');
const mo = await call('GET', `${X}/pazar/ozet?gun=30`);
t('Market genel bakış', mo.status === 200 && mo.data.news.series.length === 30);
const ro = await call('GET', `${X}/rakip-ozet?gun=30`);
t('Rakip genel bakış', ro.status === 200 && ro.data.changeSeries.length === 30);
const sz = await call('GET', `${X}/sosyal/ozet?gun=30`);
t('Social genel bakış: hiçbir hesap bağlı değil', sz.status === 200 && sz.data.platforms.every((p) => p.connected === false) && sz.data.perfCreated.length === 30);
const ht = await call('POST', `${X}/sosyal/hashtag`, { text: 'bim enerji' });
t('hashtag önerisi (gerçek etiketlerden)', ht.status === 200 && ht.data.tags.length > 0);
const sd = sz.data.specialDays[0];
if (sd) {
  const on = await call('PUT', `${X}/sosyal/ozelgun`, { date: sd.date, enabled: true });
  t('özel gün otomasyonu açılıyor', on.status === 200);
  await call('PUT', `${X}/sosyal/ozelgun`, { date: sd.date, enabled: false });
}
const bd = await call('GET', `${X}/marka`);
t('Brand Kit: gerçek palet + ikonlar + logolar', bd.status === 200 && bd.data.palette.length >= 8 && bd.data.icons.length > 10 && bd.data.logos.length === 4);
const rn = await call('POST', `${X}/marka/onizle`, { template: 'duyuru', title: 'Test Başlık', subtitle: 'Alt başlık', theme: 'koyu', format: 'ig-kare' });
t('marka şablonu PNG üretiyor', rn.status === 200 && rn.data.mime === 'image/png' && Buffer.from(rn.data.data, 'base64').subarray(1, 4).toString() === 'PNG');
const rnBad = await call('POST', `${X}/marka/onizle`, { title: 'x', bg: '../../etc/passwd' });
t('şablon arka planı yol gezintisini reddediyor', rnBad.status >= 400);
// yetkisiz
const anon = await fetch(`${base}${X}/entegrasyonlar`);
t('oturumsuz erişim 401', anon.status === 401);
const anonSec = await fetch(`${base}${X}/ai/openai/anahtar`, { method: 'PUT', headers: { 'Content-Type': 'application/json', Origin: base }, body: JSON.stringify({ key: 'abcdefghijkl' }) });
t('oturumsuz anahtar yazma reddedildi', [401, 403].includes(anonSec.status));

console.log(`\n${pass} geçti, ${fail} kaldı`);
process.exit(fail ? 1 : 0);
