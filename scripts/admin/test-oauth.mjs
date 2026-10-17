// Sosyal hesap bağlantısı (OAuth) ve paylaşım testi — yerel SAHTE sağlayıcı sunucusuyla; gerçek platforma istek gitmez:
//   node scripts/admin/test-oauth.mjs
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'akort-oauth-'));
process.env.DATA_DIR = path.join(tmp, 'data');
delete process.env.NODE_ENV;

const calls = [];
let failTweets = false, hangLinkedin = false;
const mock = http.createServer((req, res) => {
  let body = '';
  req.on('data', (c) => (body += c));
  req.on('end', () => {
    const u = new URL(req.url, 'http://x');
    calls.push({ m: req.method, p: u.pathname, auth: req.headers.authorization, body, q: Object.fromEntries(u.searchParams) });
    const j = (o, s = 200, h = {}) => { res.writeHead(s, { 'Content-Type': 'application/json', ...h }); res.end(JSON.stringify(o)); };
    switch (u.pathname) {
      case '/linkedin/token': return j({ access_token: 'li-access', expires_in: 3600, refresh_token: 'li-refresh' });
      case '/linkedin/userinfo': return j({ sub: 'abc123', name: 'Test Kişi' });
      case '/linkedin/posts': return hangLinkedin ? undefined : j({}, 201, { 'x-restli-id': 'urn:li:share:999' });
      case '/x/token': return body.includes('grant_type=refresh_token') ? j({ access_token: 'x-access2', expires_in: 7200, refresh_token: 'x-refresh2' }) : j({ access_token: 'x-access', expires_in: 1, refresh_token: 'x-refresh' });
      case '/x/me': return j({ data: { id: '77', username: 'akort' } });
      case '/x/tweets': return failTweets ? j({ detail: 'Forbidden' }, 403) : j({ data: { id: 'tw-1' } }, 201);
      case '/facebook/token': return j({ access_token: body.includes('fb_exchange_token') ? 'fb-long' : 'fb-short', expires_in: 5000000 });
      case '/facebook/me': return j({ id: 'u1', name: 'FB Kullanıcı' });
      case '/facebook/accounts': return j({ data: [{ id: 'p1', name: 'Sayfa Bir', access_token: 'page-tok-1', instagram_business_account: { id: 'ig1', username: 'akort_ig' } }, { id: 'p2', name: 'Sayfa İki', access_token: 'page-tok-2' }] });
      case '/linkedin/images': return j({ value: { uploadUrl: `http://127.0.0.1:${mock.address().port}/linkedin/upload`, image: 'urn:li:image:img1' } });
      case '/linkedin/upload': return j({}, 201);
      case '/x/media': return j({ data: { id: 'media-9' } });
      case '/facebook/photos': return j({ id: 'ph1', post_id: 'p1_photo7' });
      case '/facebook/ig-media': return j({ id: 'cr1' });
      case '/facebook/ig-publish': return j({ id: 'ig-post-3' });
      case '/threads/token': return j({ access_token: 'th-access-token', expires_in: 3600 });
      case '/threads/me': return j({ id: 'th1', username: 'akort' });
      case '/threads/long': return j({ access_token: 'th-long-token', expires_in: 5000000 });
      case '/threads/create': return j({ id: 'thc1' });
      case '/threads/publish': return j({ id: 'th-post-1' });
      case '/pinterest/token': return j({ access_token: 'pin-access-token', expires_in: 3600, refresh_token: 'pin-refresh-token' });
      case '/pinterest/me': return j({ username: 'akortpin' });
      case '/pinterest/boards': return j({ items: [{ id: 'b1', name: 'Projeler' }, { id: 'b2', name: 'Blog' }] });
      case '/pinterest/pins': return j({ id: 'pin-1' }, 201);
      case '/facebook/feed': return j({ id: 'p1_555' });
      default: return j({ error: 'yok' }, 404);
    }
  });
});
await new Promise((r) => mock.listen(0, '127.0.0.1', r));
process.env.OAUTH_TEST_BASE = `http://127.0.0.1:${mock.address().port}`;

const oauth = await import('../../server/lib/ext/oauth.mjs');
const social = await import('../../server/lib/ext/social.mjs');
const { q } = await import('../../server/lib/db.mjs');
const { hasSecret, getSecret } = await import('../../server/lib/ext/vault.mjs');

let pass = 0, fail = 0;
const t = (name, ok, extra = '') => { ok ? pass++ : fail++; console.log(`${ok ? '✓' : '✗'} ${name}${ok ? '' : ` — ${extra}`}`); };
const rej = async (fn) => { try { await fn(); return null; } catch (e) { return e; } };
const admin = { email: 'a@test', role: 'admin' };
const base = 'https://panel.example.test';

// --- uygulama bilgisi
t('uygulama bilgisi olmadan bağlanılamaz', (await rej(() => oauth.startAuth('linkedin', admin, base)))?.status === 409);
t('geçersiz Client ID reddedilir', !!(await rej(() => oauth.saveApp('linkedin', 'a b', 'x y', admin))));
oauth.saveApp('linkedin', 'li-client-id', 'li-client-secret', admin);
t('uygulama bilgisi kasada şifreli saklanır', hasSecret('social.linkedin.id') && getSecret('social.linkedin.secret') === 'li-client-secret');
const list0 = oauth.listAccounts(base);
t('listede sır yok, yönlendirme adresi var', !JSON.stringify(list0).includes('li-client-secret') && list0.find((a) => a.id === 'linkedin').redirectUri === `${base}/api/admin/x/oauth/cb/linkedin`);

// --- LinkedIn akışı
const authUrl = new URL(oauth.startAuth('linkedin', admin, base));
const state = authUrl.searchParams.get('state');
t('yetkilendirme adresi doğru (client_id, redirect, state, kapsam)', authUrl.searchParams.get('client_id') === 'li-client-id' && authUrl.searchParams.get('redirect_uri') === `${base}/api/admin/x/oauth/cb/linkedin` && state.length > 20 && authUrl.searchParams.get('scope').includes('w_member_social'), authUrl.href);
t('yanlış state reddedilir', (await rej(() => oauth.handleCallback('linkedin', { state: 'sahte', code: 'c' })))?.status === 400);
const done = await oauth.handleCallback('linkedin', { state, code: 'auth-code' });
t('geri çağrı hesabı bağlar', done.label === 'Test Kişi' && oauth.listAccounts(base).find((a) => a.id === 'linkedin').connected);
t('belirteçler kasada, listede yok', getSecret('social.linkedin.access') === 'li-access' && !JSON.stringify(oauth.listAccounts(base)).includes('li-access'));
t('state tek kullanımlık', (await rej(() => oauth.handleCallback('linkedin', { state, code: 'auth-code' })))?.status === 400);
const tokenCall = calls.find((c) => c.p === '/linkedin/token');
t('belirteç isteği code + client bilgilerini içerir', /code=auth-code/.test(tokenCall.body) && /client_secret=li-client-secret/.test(tokenCall.body) && /grant_type=authorization_code/.test(tokenCall.body));
const deny = oauth.startAuth('linkedin', admin, base);
t('kullanıcı reddederse hata mesajı', /reddetti/.test((await rej(() => oauth.handleCallback('linkedin', { state: new URL(deny).searchParams.get('state'), error: 'access_denied' })))?.message ?? ''));

// --- X: PKCE + yenileme
oauth.saveApp('x', 'x-client-id', 'x-client-secret', admin);
const xa = new URL(oauth.startAuth('x', admin, base));
t('X için PKCE (S256) kullanılır', xa.searchParams.get('code_challenge_method') === 'S256' && xa.searchParams.get('code_challenge')?.length >= 40);
await oauth.handleCallback('x', { state: xa.searchParams.get('state'), code: 'xc' });
const xTok = calls.find((c) => c.p === '/x/token');
t('X belirteç isteğinde code_verifier + Basic kimlik doğrulama', /code_verifier=/.test(xTok.body) && /^Basic /.test(xTok.auth ?? ''));
t('süresi dolmak üzere olan belirteç yenilenir', (await oauth.accessToken('x')) === 'x-access2' && getSecret('social.x.refresh') === 'x-refresh2');

// --- gönderi hazırla
const mk = (platforms, o = {}) => {
  let p = social.savePost(0, { title: 'Test', body: 'Merhaba dünya', hashtags: '#akort', platforms, scheduled_at: '2030-01-01T10:00', ...o }, admin);
  p = social.transition(p.id, 'onay_bekliyor', admin);
  return social.transition(p.id, 'onaylandi', admin);
};
const draft = social.savePost(0, { title: 'Taslak', body: 'x', platforms: ['linkedin'] }, admin);
t('taslak gönderi paylaşılamaz', (await rej(() => oauth.publishNow(draft.id, 'linkedin', admin)))?.status === 409);
const p1 = mk(['linkedin', 'x']);
const r1 = await oauth.publishNow(p1.id, 'linkedin', admin);
t('LinkedIn: onaylı gönderi paylaşılır, kimlik kaydedilir', r1.platform_post_ids.linkedin === 'urn:li:share:999', JSON.stringify(r1.platform_post_ids));
const liCall = calls.find((c) => c.p === '/linkedin/posts');
t('LinkedIn isteği doğru yazar + sürüm başlığı + metin', JSON.parse(liCall.body).author === 'urn:li:person:abc123' && /Merhaba dünya/.test(JSON.parse(liCall.body).commentary) && liCall.auth === 'Bearer li-access');
t('aynı platforma ikinci kez gönderilemez (tekrar yok)', (await rej(() => oauth.publishNow(p1.id, 'linkedin', admin)))?.status === 409 && calls.filter((c) => c.p === '/linkedin/posts').length === 1);
t('yalnızca birine yayımlanınca durum "yayımlandı" olmaz', social.getPost(p1.id).status !== 'yayimlandi');
failTweets = true;
const e2 = await rej(() => oauth.publishNow(p1.id, 'x', admin));
t('platform reddederse hata iletilir, gönderi yayımlanmış sayılmaz', e2?.status === 502 && !social.getPost(p1.id).platform_post_ids.x && /Yayın hatası/.test(social.getPost(p1.id).review_note ?? ''), e2?.message);
failTweets = false;
const r2 = await oauth.publishNow(p1.id, 'x', admin);
t('kesin ret sonrası yeniden denenebilir; tüm platformlar bitince "yayımlandı"', r2.status === 'yayimlandi' && r2.platform_post_ids.x === 'tw-1', JSON.stringify(r2));

// --- içerik mühür kontrolü
const p3 = mk(['linkedin']);
q.run(`UPDATE social_posts SET content_hash = 'degisti' WHERE id = ?`, p3.id);
t('mühür bozulmuşsa paylaşılmaz', (await rej(() => oauth.publishNow(p3.id, 'linkedin', admin)))?.status === 409);
const p4 = mk(['linkedin'], { media: '/medya/a.png' });
t('görselli gönderi otomatik paylaşılmaz (açık hata)', (await rej(() => oauth.publishNow(p4.id, 'linkedin', admin)))?.status === 422);
const p5 = mk(['youtube'], { media: '/medya/v.mp4' });
t('yayın adaptörü olmayan platform açıkça reddedilir', /otomatik yayın henüz desteklenmiyor/.test((await rej(() => oauth.publishNow(p5.id, 'youtube', admin)))?.message ?? ''));
const p6 = mk(['threads']);
t('bağlı olmayan hesapla paylaşılmaz', (await rej(() => oauth.publishNow(p6.id, 'threads', admin)))?.status === 409);

// --- zaman aşımı: sonuç belirsiz → çift gönderim kilidi
{
  oauth.disconnect('linkedin', admin); oauth.saveApp('linkedin', 'li-client-id', 'li-client-secret', admin);
  const s = new URL(oauth.startAuth('linkedin', admin, base)).searchParams.get('state');
  await oauth.handleCallback('linkedin', { state: s, code: 'c2' });
  hangLinkedin = true;
  const p7 = mk(['linkedin']);
  const origFetch = globalThis.fetch;
  globalThis.fetch = (u, o) => (String(u).endsWith('/linkedin/posts') ? Promise.reject(Object.assign(new Error('timeout'), { name: 'TimeoutError' })) : origFetch(u, o));
  const e = await rej(() => oauth.publishNow(p7.id, 'linkedin', admin));
  globalThis.fetch = origFetch;
  t('zaman aşımında belirsiz sonuç bildirilir', e?.status === 504 && /kontrol edin/.test(e.message), e?.message);
  t('belirsiz sonuçta otomatik yeniden deneme engellenir', (await rej(() => oauth.publishNow(p7.id, 'linkedin', admin)))?.status === 409);
  hangLinkedin = false;
}

// --- Facebook: sayfa seçimi
oauth.saveApp('facebook', 'fb-app-id', 'fb-app-secret', admin);
const fa = new URL(oauth.startAuth('facebook', admin, base));
t('Facebook kapsamları virgülle ayrılır', fa.searchParams.get('scope').includes('pages_manage_posts') && fa.searchParams.get('scope').includes(','));
await oauth.handleCallback('facebook', { state: fa.searchParams.get('state'), code: 'fc' });
let fb = oauth.listAccounts(base).find((a) => a.id === 'facebook');
t('birden çok sayfa varsa seçim istenir', fb.connected && fb.options.length === 2 && !fb.selected);
const p8 = mk(['facebook']);
t('sayfa seçilmeden paylaşılmaz', (await rej(() => oauth.publishNow(p8.id, 'facebook', admin)))?.status === 409);
await oauth.selectAccount('facebook', 'p1', admin);
fb = oauth.listAccounts(base).find((a) => a.id === 'facebook');
t('seçilen sayfa kaydedilir, sayfa belirteci kasada', fb.selected.id === 'p1' && getSecret('social.facebook.page') === 'page-tok-1');
t('geçersiz seçim reddedilir', (await rej(() => oauth.selectAccount('facebook', 'yok', admin)))?.status === 400);
const r8 = await oauth.publishNow(p8.id, 'facebook', admin);
const feed = calls.find((c) => c.p === '/facebook/feed');
t('Facebook sayfa akışına sayfa belirteciyle paylaşılır', r8.platform_post_ids.facebook === 'p1_555' && /access_token=page-tok-1/.test(feed.body) && /message=Merhaba/.test(feed.body));
oauth.saveApp('instagram', 'ig-app', 'ig-secret-1', admin);
const ia = new URL(oauth.startAuth('instagram', admin, base));
await oauth.handleCallback('instagram', { state: ia.searchParams.get('state'), code: 'ic' });
const ig = oauth.listAccounts(base).find((a) => a.id === 'instagram');
t('Instagram: yalnızca Instagram hesabı bağlı sayfalar listelenir (tek → otomatik seçilir)', ig.options.length === 1 && ig.selected?.label.includes('akort_ig'), JSON.stringify(ig.options));

// --- görselli paylaşım
{
  const mdir = path.join(process.env.DATA_DIR, 'media'); fs.mkdirSync(mdir, { recursive: true });
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
  fs.writeFileSync(path.join(mdir, 'test.png'), png); fs.writeFileSync(path.join(mdir, 'test.jpg'), Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), png]));
  const imgPost = (pl, media) => mk(pl, { media, title: 'Görselli' });
  const li = await oauth.publishNow(imgPost(['linkedin'], '/medya/test.png').id, 'linkedin', admin).catch((e) => e);
  const liPosts = calls.filter((c) => c.p === '/linkedin/posts');
  t('LinkedIn görselli: görsel yüklenir, gönderiye medya id eklenir', li.platform_post_ids?.linkedin && JSON.parse(liPosts.at(-1).body).content?.media?.id === 'urn:li:image:img1' && calls.some((c) => c.p === '/linkedin/upload' && c.m === 'PUT'), li.message);
  const xr = await oauth.publishNow(imgPost(['x'], '/medya/test.png').id, 'x', admin).catch((e) => e);
  t('X görselli: medya yüklenir, tweet media_ids taşır', xr.platform_post_ids?.x && JSON.parse(calls.filter((c) => c.p === '/x/tweets').at(-1).body).media?.media_ids?.[0] === 'media-9' && calls.some((c) => c.p === '/x/media' && c.m === 'POST'), xr.message);
  const fbr = await oauth.publishNow(imgPost(['facebook'], '/medya/test.png').id, 'facebook', admin).catch((e) => e);
  t('Facebook görselli: /photos ucuna görsel adresi + sayfa belirteci', fbr.platform_post_ids?.facebook === 'p1_photo7' && /url=http/.test(calls.filter((c) => c.p === '/facebook/photos').at(-1).body) && /access_token=page-tok-1/.test(calls.filter((c) => c.p === '/facebook/photos').at(-1).body), fbr.message);
  const igPng = await oauth.publishNow(imgPost(['instagram'], '/medya/test.png').id, 'instagram', admin).catch((e) => e);
  t('Instagram PNG reddedilir (yalnızca JPEG)', igPng?.status === 422, igPng?.message);
  const igr = await oauth.publishNow(imgPost(['instagram'], '/medya/test.jpg').id, 'instagram', admin).catch((e) => e);
  t('Instagram JPEG: önce container, sonra yayın', igr.platform_post_ids?.instagram === 'ig-post-3' && calls.some((c) => c.p === '/facebook/ig-media') && calls.some((c) => c.p === '/facebook/ig-publish'), igr.message);
  oauth.saveApp('threads', 'th-app-id', 'th-app-secret', admin);
  await oauth.handleCallback('threads', { state: new URL(oauth.startAuth('threads', admin, base)).searchParams.get('state'), code: 'tc' });
  const thr = await oauth.publishNow(imgPost(['threads'], '/medya/test.png').id, 'threads', admin).catch((e) => e);
  t('Threads görselli: media_type=IMAGE + image_url', thr.platform_post_ids?.threads === 'th-post-1' && /media_type=IMAGE/.test(calls.filter((c) => c.p === '/threads/create').at(-1).body), thr.message);
  oauth.saveApp('pinterest', 'pin-app-id', 'pin-app-secret', admin);
  await oauth.handleCallback('pinterest', { state: new URL(oauth.startAuth('pinterest', admin, base)).searchParams.get('state'), code: 'pc' });
  const pin = oauth.listAccounts(base).find((a) => a.id === 'pinterest');
  t('Pinterest: panolar listelenir, seçim istenir', pin.connected && pin.options.length === 2 && !pin.selected);
  const pp = imgPost(['pinterest'], '/medya/test.png');
  t('pano seçilmeden pin atılmaz', (await rej(() => oauth.publishNow(pp.id, 'pinterest', admin)))?.status === 409);
  await oauth.selectAccount('pinterest', 'b2', admin);
  const pr = await oauth.publishNow(pp.id, 'pinterest', admin).catch((e) => e);
  t('Pinterest: seçilen panoya pin oluşturulur', pr.platform_post_ids?.pinterest === 'pin-1' && JSON.parse(calls.filter((c) => c.p === '/pinterest/pins').at(-1).body).board_id === 'b2', pr.message);
  t('video/bilinmeyen biçim reddedilir', (await rej(async () => { fs.writeFileSync(path.join(mdir, 'v.mp4'), 'x'); await oauth.publishNow(imgPost(['linkedin'], '/medya/v.mp4').id, 'linkedin', admin); }))?.status === 422);
  t('kitaplıkta olmayan görsel reddedilir', (await rej(() => oauth.publishNow(imgPost(['linkedin'], '/medya/yok.png').id, 'linkedin', admin)))?.status === 422);
}

// --- kesme
oauth.disconnect('facebook', admin);
t('bağlantı kesilince belirteçler silinir', !hasSecret('social.facebook.access') && !hasSecret('social.facebook.page') && !oauth.listAccounts(base).find((a) => a.id === 'facebook').connected);
oauth.removeApp('x', admin);
t('uygulama bilgisi kaldırılınca bağlantı ve sırlar silinir', !hasSecret('social.x.id') && !hasSecret('social.x.access'));
t('günlükte belirteç/sır yok', !q.all('SELECT * FROM audit').some((r) => /li-access|x-access|page-tok|li-client-secret/.test(JSON.stringify(r))));

mock.close();
console.log(`\n${pass} geçti, ${fail} başarısız`);
process.exit(fail ? 1 : 0);
