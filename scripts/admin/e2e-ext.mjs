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

// entegrasyonlar
const ig = await call('GET', `${X}/entegrasyonlar`);
t('entegrasyon durumu: hiçbir sosyal platform "bağlı" değil', ig.status === 200 && ig.data.other.every((o) => o.connected === false));
t('AI sağlayıcıları listelendi', ig.data.providers.length === 3);
// anahtar yokken üretim
const g0 = await call('POST', `${X}/ai/uret`, { provider: 'openai', task: 'kisalt', text: 'Merhaba dünya' });
t('anahtar yokken AI üretimi 409 "Bağlantı gerekli"', g0.status === 409 && /bağlantı gerekli/i.test(g0.data.error), JSON.stringify(g0.data));
// sır kasası: kaydet → yanıtta düz anahtar yok
const secret = 'sk-test-' + 'x'.repeat(24);
const sk = await call('PUT', `${X}/ai/openai/anahtar`, { key: secret });
t('anahtar kaydedildi, yanıtta yalnızca maskeli ipucu', sk.status === 200 && !JSON.stringify(sk.data).includes(secret), JSON.stringify(sk.data));
const ig2 = await call('GET', `${X}/entegrasyonlar`);
t('entegrasyon listesi anahtarı sızdırmıyor', !JSON.stringify(ig2.data).includes(secret));
const bad = await call('POST', `${X}/ai/openai/test`);
t('sahte anahtarla bağlantı testi hata döner (401/502/429)', [401, 502, 429, 503].includes(bad.status), JSON.stringify(bad));
await call('DELETE', `${X}/ai/openai/anahtar`);
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
// yetkisiz
const anon = await fetch(`${base}${X}/entegrasyonlar`);
t('oturumsuz erişim 401', anon.status === 401);
const anonSec = await fetch(`${base}${X}/ai/openai/anahtar`, { method: 'PUT', headers: { 'Content-Type': 'application/json', Origin: base }, body: JSON.stringify({ key: 'abcdefghijkl' }) });
t('oturumsuz anahtar yazma reddedildi', [401, 403].includes(anonSec.status));

console.log(`\n${pass} geçti, ${fail} kaldı`);
process.exit(fail ? 1 : 0);
