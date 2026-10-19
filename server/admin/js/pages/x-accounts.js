// Sosyal hesap bağlantıları: uygulama bilgisi → "Bağlan" (OAuth) → hesap/sayfa seçimi → bağlantıyı kes
import { api, session } from '../api.js';
import { h, icon, chip, toast, spinner, errorBanner, field, modal, confirmBox, copyText } from '../ui.js';

const PCOL = { linkedin: '#0a66c2', instagram: '#e1306c', facebook: '#1877f2', youtube: '#ff0000', x: '#111827', tiktok: '#0f172a', threads: '#334155', pinterest: '#e60023' };
const PSHORT = { linkedin: 'in', instagram: 'Ig', facebook: 'f', youtube: '▶', x: 'X', tiktok: 'Tk', threads: '@', pinterest: 'P' };
export const pbadge = (id, size = 22) => h('span', { class: 'pbadge', style: `background:${PCOL[id] ?? '#64748b'};width:${size}px;height:${size}px;font-size:${Math.round(size * 0.5)}px` }, PSHORT[id] ?? id[0].toUpperCase());

/** Başka sağlayıcı sayfasından dönüşte (#/sosyal?baglandi=… / ?baglanti_hata=…) sonucu bildirir */
export const announceReturn = () => {
  const qs = new URLSearchParams((location.hash.split('?')[1] ?? ''));
  const ok = qs.get('baglandi'), err = qs.get('baglanti_hata');
  if (!ok && !err) return;
  history.replaceState(null, '', location.pathname + location.search + location.hash.split('?')[0]);
  if (ok) toast('Hesap bağlandı', 'ok'); else toast(err, 'err');
};

const appModal = (a, done) => {
  const id = h('input', { class: 'input', autocomplete: 'off', placeholder: 'İstemci Kimliği / Uygulama Kimliği' });
  const secret = h('input', { class: 'input', type: 'password', autocomplete: 'off', placeholder: 'İstemci Gizli Anahtarı / Uygulama Gizli Anahtarı' });
  const redirect = h('input', { class: 'input', readonly: true, value: a.redirectUri, onfocus: (e) => e.target.select() });
  modal({
    title: `${a.label} — uygulama bilgileri`, wide: true,
    body: h('div', { class: 'stack' },
      h('p', { class: 'small muted' }, `1) ${a.label} geliştirici konsolunda bir uygulama oluşturun. 2) Aşağıdaki yönlendirme adresini (Redirect/Callback URL) uygulamaya ekleyin. 3) Client ID ve Secret'ı buraya yapıştırın. Sır şifreli saklanır, geri gösterilmez.`),
      field('Yönlendirme adresi (Redirect URI) — kopyalayın', h('div', { class: 'row' }, h('div', { class: 'grow' }, redirect), h('button', { class: 'btn secondary sm', onclick: async () => { try { await copyText(a.redirectUri, 'Kopyalandı'); } catch { redirect.select(); } } }, 'Kopyala'))),
      field('İstemci Kimliği', id), field('İstemci Gizli Anahtarı', secret),
      h('div', { class: 'small' }, h('a', { href: a.url, target: '_blank', rel: 'noopener noreferrer' }, 'Geliştirici konsolu ↗'), ' · ', h('a', { href: a.docs, target: '_blank', rel: 'noopener noreferrer' }, 'API belgeleri ↗')),
      h('div', { class: 'small muted' }, `Gereken: ${a.needs}`)),
    actions: [{ label: 'Vazgeç', class: 'secondary' }, { label: 'Kaydet', close: false, onClick: async (close) => {
      try { await api.put(`/x/sosyal/hesaplar/${a.id}/uygulama`, { clientId: id.value, clientSecret: secret.value }); toast('Uygulama bilgileri kaydedildi — şimdi "Bağlan"a basın', 'ok'); close(); done(); } catch (e) { toast(e.data?.error ?? e.message, 'err'); return false; }
    } }],
  });
};

const pickModal = (a, done) => {
  const sel = h('select', { class: 'input' }, a.options.map((o) => h('option', { value: o.id, selected: a.selected?.id === o.id }, o.label)));
  modal({
    title: `${a.label} — ${a.id === 'instagram' ? 'hesap' : 'sayfa'} seçin`,
    body: h('div', { class: 'stack' }, h('p', { class: 'small muted' }, 'Paylaşımlar yalnızca seçtiğiniz hesaba gönderilir.'), sel),
    actions: [{ label: 'Vazgeç', class: 'secondary' }, { label: 'Seç', close: false, onClick: async (close) => {
      try { await api.post(`/x/sosyal/hesaplar/${a.id}/secim`, { id: sel.value }); toast('Seçim kaydedildi', 'ok'); close(); done(); } catch (e) { toast(e.message, 'err'); return false; }
    } }],
  });
};

const card = (a, done, admin) => {
  const run = (fn) => async (e) => { const btn = e.currentTarget; btn.disabled = true; try { await fn(); } catch (er) { toast(er.data?.error ?? er.message, 'err'); btn.disabled = false; } };
  const needsPick = a.connected && a.options && !a.selected;
  const status = a.connected ? (needsPick ? chip('Seçim gerekli', 'warn') : chip('Bağlı', 'ok')) : a.status === 'yenilenmeli' ? chip('Yeniden bağlayın', 'warn') : a.hasApp ? chip('Hazır — bağlanın', 'info') : chip('Bağlı değil');
  const sub = a.connected ? `${a.account?.label ?? ''}${a.selected ? ` → ${a.selected.label}` : ''}` : a.hasApp ? 'uygulama bilgileri kayıtlı' : 'hesap bağlı değil';
  const connect = () => run(async () => { const r = await api.post(`/x/sosyal/hesaplar/${a.id}/baglan`); location.href = r.url; });
  const buttons = !admin ? [h('span', { class: 'small muted acc-wide' }, 'Bağlantıyı yalnızca yönetici yapabilir')] : [
    a.connected ? null : h('button', { class: 'btn sm acc-wide', onclick: run(async () => { if (!a.hasApp) return appModal(a, done); const r = await api.post(`/x/sosyal/hesaplar/${a.id}/baglan`); location.href = r.url; }) }, icon('link', 14), a.hasApp ? 'Bağlan' : 'Uygulama bilgilerini gir'),
    a.connected && a.options ? h('button', { class: 'btn secondary sm', onclick: () => pickModal(a, done) }, a.id === 'instagram' ? 'Hesap seç' : 'Sayfa seç') : null,
    a.connected ? h('button', { class: 'btn secondary sm', onclick: connect() }, 'Yeniden bağla') : null,
    a.hasApp && !a.connected ? h('button', { class: 'btn secondary sm', onclick: () => appModal(a, done) }, 'Bilgileri düzenle') : null,
    a.connected ? h('button', { class: 'btn danger secondary sm', onclick: async () => { if (await confirmBox({ title: 'Bağlantı kesilsin mi?', message: `${a.label} hesabının erişim belirteçleri silinir. Yayımlanmış paylaşımlar etkilenmez.`, confirmLabel: 'Bağlantıyı kes', danger: true })) { try { await api.post(`/x/sosyal/hesaplar/${a.id}/kes`); toast('Bağlantı kesildi', 'ok'); done(); } catch (er) { toast(er.message, 'err'); } } } }, 'Bağlantıyı kes') : null,
  ];
  return h('div', { class: `acc${a.connected && !needsPick ? ' is-on' : ''}`, 'data-platform': a.id },
    h('div', { class: 'acc-head' }, pbadge(a.id, 38), h('div', { class: 'acc-id' }, h('b', { title: a.label }, a.label), h('span', { class: 'acc-sub', title: sub }, sub))),
    h('div', { class: 'acc-status' }, status, a.publish ? chip('Otomatik yayın', 'ok') : chip('Yalnızca bağlantı')),
    a.warning ? h('div', { class: 'acc-warn' }, a.warning) : null,
    h('div', { class: 'acc-actions' }, buttons),
    h('div', { class: 'acc-foot' }, a.publish ? null : h('span', {}, 'Yayın: elle işaretlenir'), h('a', { href: a.docs, target: '_blank', rel: 'noopener noreferrer' }, 'API belgeleri'), h('a', { href: '#/entegrasyonlar' }, 'Durum')));
};

/** Hesap kartları ızgarası; `limit` ile ilk N platform */
export const accountsGrid = (limit = 99) => {
  const root = h('div');
  const admin = () => session.user.role === 'admin';
  const load = async () => {
    root.replaceChildren(spinner());
    try {
      const { accounts } = await api.get('/x/sosyal/hesaplar');
      root.replaceChildren(h('div', { class: 'acc-grid' }, accounts.slice(0, limit).map((a) => card(a, load, admin()))));
    } catch (e) { root.replaceChildren(errorBanner(e)); }
  };
  load();
  return root;
};
