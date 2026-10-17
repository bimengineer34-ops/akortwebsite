// Sosyal hesap bağlantıları: uygulama bilgisi → "Bağlan" (OAuth) → hesap/sayfa seçimi → bağlantıyı kes
import { api, session } from '../api.js';
import { h, icon, chip, toast, spinner, errorBanner, field, modal, confirmBox } from '../ui.js';

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
  const id = h('input', { class: 'input', autocomplete: 'off', placeholder: 'Client ID / App ID / Client Key' });
  const secret = h('input', { class: 'input', type: 'password', autocomplete: 'off', placeholder: 'Client Secret / App Secret' });
  const redirect = h('input', { class: 'input', readonly: true, value: a.redirectUri, onfocus: (e) => e.target.select() });
  modal({
    title: `${a.label} — uygulama bilgileri`, wide: true,
    body: h('div', { class: 'stack' },
      h('p', { class: 'small muted' }, `1) ${a.label} geliştirici konsolunda bir uygulama oluşturun. 2) Aşağıdaki yönlendirme adresini (Redirect/Callback URL) uygulamaya ekleyin. 3) Client ID ve Secret'ı buraya yapıştırın. Sır şifreli saklanır, geri gösterilmez.`),
      field('Yönlendirme adresi (Redirect URI) — kopyalayın', h('div', { class: 'row' }, h('div', { class: 'grow' }, redirect), h('button', { class: 'btn secondary sm', onclick: async () => { try { await navigator.clipboard.writeText(a.redirectUri); toast('Kopyalandı', 'ok'); } catch { redirect.select(); } } }, 'Kopyala'))),
      field('Client ID', id), field('Client Secret', secret),
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
  return h('div', { class: 'acc', 'data-platform': a.id },
    h('div', { class: 'row' }, pbadge(a.id, 34), h('div', { class: 'grow' }, h('b', {}, a.label), h('div', { class: 'small muted' }, sub)), status),
    a.warning ? h('div', { class: 'small', style: 'color:var(--warn,#b54708);margin-top:6px' }, a.warning) : null,
    h('div', { class: 'row wrap', style: 'gap:6px;margin-top:10px' },
      !admin ? h('span', { class: 'small muted' }, 'Bağlantıyı yalnızca yönetici yapabilir') : [
        a.connected ? null : h('button', { class: 'btn sm', onclick: run(async () => { if (!a.hasApp) return appModal(a, done); const r = await api.post(`/x/sosyal/hesaplar/${a.id}/baglan`); location.href = r.url; }) }, icon('link', 14), a.hasApp ? 'Bağlan' : 'Uygulama bilgilerini gir'),
        a.connected && a.options ? h('button', { class: 'btn secondary sm', onclick: () => pickModal(a, done) }, a.id === 'instagram' ? 'Hesap seç' : 'Sayfa seç') : null,
        a.connected ? h('button', { class: 'btn secondary sm', onclick: run(async () => { const r = await api.post(`/x/sosyal/hesaplar/${a.id}/baglan`); location.href = r.url; }) }, 'Yeniden bağla') : null,
        a.hasApp && !a.connected ? h('button', { class: 'btn ghost sm', onclick: () => appModal(a, done) }, 'Bilgileri değiştir') : null,
        a.connected ? h('button', { class: 'btn danger secondary sm', onclick: async () => { if (await confirmBox({ title: 'Bağlantı kesilsin mi?', message: `${a.label} hesabının erişim belirteçleri silinir. Yayımlanmış paylaşımlar etkilenmez.`, confirmLabel: 'Bağlantıyı kes', danger: true })) { try { await api.post(`/x/sosyal/hesaplar/${a.id}/kes`); toast('Bağlantı kesildi', 'ok'); done(); } catch (er) { toast(er.message, 'err'); } } } }, 'Bağlantıyı kes') : null]),
    h('div', { class: 'small', style: 'margin-top:6px' }, a.publish ? chip('Otomatik yayın', 'ok') : h('span', { class: 'muted' }, 'yalnızca bağlantı (yayın: elle)'), ' · ', h('a', { href: a.docs, target: '_blank', rel: 'noopener noreferrer' }, 'API belgeleri'), ' · ', h('a', { href: '#/entegrasyonlar' }, 'Durum')));
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
