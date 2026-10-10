// Form talepleri ve bülten aboneleri
import { api, session } from '../api.js';
import { h, icon, chip, fmtDate, debounce, toast, confirmBox, errorBanner, spinner, drawer, field } from '../ui.js';

const ST = { yeni: ['Yeni', 'info'], islemde: ['İşlemde', 'warn'], yanitlandi: ['Yanıtlandı', 'ok'], kapali: ['Kapalı', ''], spam: ['Spam', 'danger'] };
const stChip = (s) => chip(ST[s]?.[0] ?? s, ST[s]?.[1] ?? '');

const detail = (id, onDone) => (close) => {
  const box = h('div', { class: 'loading' }, spinner());
  (async () => {
    try {
      const f = await api.get(`/formlar/${id}`);
      const status = h('select', { class: 'select' }, Object.entries(ST).map(([k, [l]]) => h('option', { value: k, selected: k === f.status }, l)));
      const note = h('textarea', { class: 'textarea', rows: 4, placeholder: 'İç not (müşteri görmez)…' });
      note.value = f.note ?? '';
      const extra = Object.entries(f.payload ?? {});
      box.className = 'stack';
      box.replaceChildren(
        h('div', { class: 'card-head' }, h('h3', {}, `Talep #${f.id}`), stChip(f.status), h('button', { class: 'btn ghost sm icon', 'aria-label': 'Kapat', onclick: close }, icon('x'))),
        h('div', { class: 'card-pad stack' },
          h('div', { class: 'grid cols-2' },
            field('Ad Soyad', h('div', {}, h('b', {}, f.name))),
            field('Tarih', h('div', {}, fmtDate(f.created_at))),
            field('E-posta', h('a', { href: `mailto:${f.email}` }, f.email)),
            field('Telefon', f.phone ? h('a', { href: `tel:${f.phone}` }, f.phone) : h('span', { class: 'muted' }, '—')),
            field('Şirket / kurum', h('div', {}, f.company || '—')),
            field('Konu', h('div', {}, f.subject || '—'))),
          field('Mesaj', h('div', { class: 'card card-pad', style: undefined }, h('div', { class: 'md-preview', style: undefined }, f.message.split('\n').map((l) => h('p', {}, l))))),
          extra.length ? field('Ek bilgiler', h('table', { class: 'tbl' }, h('tbody', {}, extra.map(([k, v]) => h('tr', {}, h('td', { class: 'muted' }, k), h('td', {}, Array.isArray(v) ? v.join(', ') : String(v))))))) : null,
          h('div', { class: 'small muted' }, `KVKK onayı: ${f.consent ? 'verildi' : 'yok'} · IP: ${f.ip || '—'}${f.handled_by ? ` · Son işlem: ${f.handled_by}` : ''}`),
          h('hr', { style: undefined }),
          field('Durum', status), field('İç not', note),
          h('div', { class: 'row wrap' },
            h('button', { class: 'btn', onclick: async () => { try { await api.patch(`/formlar/${f.id}`, { status: status.value, note: note.value }); toast('Güncellendi', 'ok'); onDone(); close(); } catch (e) { toast(e.message, 'err'); } } }, 'Kaydet'),
            h('a', { class: 'btn secondary', href: `mailto:${f.email}?subject=${encodeURIComponent('Re: ' + (f.subject || 'AKORT Mühendislik talebiniz'))}` }, icon('mail', 16), 'E-postayla yanıtla'),
            h('span', { class: 'grow' }),
            session.user.role === 'admin' ? h('button', { class: 'btn danger secondary', onclick: async () => {
              if (!(await confirmBox({ title: 'Talep silinsin mi?', message: 'Bu kayıt kalıcı olarak silinir.', confirmLabel: 'Sil', danger: true }))) return;
              await api.del(`/formlar/${f.id}`); toast('Silindi', 'ok'); onDone(); close();
            } }, icon('trash', 16), 'Sil') : null)));
      if (f.status === 'yeni') api.patch(`/formlar/${f.id}`, { status: 'islemde' }).then(onDone).catch(() => {});
    } catch (e) { box.replaceChildren(errorBanner(e)); }
  })();
  return box;
};

export const renderForms = async (ctx, openId) => {
  ctx.setTitle('Form talepleri');
  let status = '';
  const search = h('input', { class: 'input', type: 'search', placeholder: 'Ad, e-posta, şirket veya mesajda ara…' });
  const tabs = h('div', { class: 'tabs', role: 'tablist' });
  const body = h('tbody');
  const info = h('span', { class: 'muted small' });
  let counts = {};
  const load = async () => {
    body.replaceChildren(h('tr', {}, h('td', { colspan: 5 }, spinner())));
    try {
      const r = await api.get(`/formlar?durum=${status}&ara=${encodeURIComponent(search.value)}&limit=100`);
      counts = r.counts;
      drawTabs();
      info.textContent = `${r.total} kayıt`;
      body.replaceChildren();
      if (!r.rows.length) body.append(h('tr', {}, h('td', { colspan: 5, class: 'empty' }, 'Kayıt yok.')));
      for (const f of r.rows) {
        body.append(h('tr', { class: `clickable${f.status === 'yeni' ? ' fresh' : ''}`, onclick: () => open(f.id) },
          h('td', {}, h('b', {}, f.name), h('div', { class: 'muted small' }, f.company || f.email)),
          h('td', { class: 'small' }, f.subject || '—'),
          h('td', { class: 'small muted' }, f.preview),
          h('td', {}, stChip(f.status)),
          h('td', { class: 'small muted' }, fmtDate(f.created_at))));
      }
      ctx.refreshBadges();
    } catch (e) { body.replaceChildren(h('tr', {}, h('td', { colspan: 5 }, errorBanner(e)))); }
  };
  const drawTabs = () => {
    tabs.replaceChildren(...[['', 'Tümü', Object.values(counts).reduce((a, b) => a + b, 0)], ...Object.entries(ST).map(([k, [l]]) => [k, l, counts[k] ?? 0])].map(([k, l, n]) =>
      h('button', { role: 'tab', 'aria-selected': String(status === k), onclick: () => { status = k; load(); } }, `${l} (${n})`)));
  };
  const open = (id) => drawer(detail(id, load));
  search.addEventListener('input', debounce(load, 250));
  await load();
  if (openId) open(Number(openId));
  return h('div', { class: 'stack' },
    h('div', { class: 'page-head' }, h('div', { class: 'grow' }, h('h1', {}, 'Form talepleri'), h('p', {}, 'İletişim formundan gelen hizmet talepleri. KVKK onayı ve iç notlarla takip edin.')),
      h('a', { class: 'btn secondary', href: '/api/admin/formlar.csv' }, icon('download', 16), 'CSV indir')),
    tabs, h('div', { class: 'card card-pad row wrap' }, h('div', { class: 'grow' }, search), info),
    h('div', { class: 'card' }, h('div', { class: 'tbl-wrap' }, h('table', { class: 'tbl' }, h('thead', {}, h('tr', {}, ['Gönderen', 'Konu', 'Mesaj', 'Durum', 'Tarih'].map((t) => h('th', {}, t)))), body))));
};

export const renderSubscribers = async (ctx) => {
  ctx.setTitle('Bülten aboneleri');
  const search = h('input', { class: 'input', type: 'search', placeholder: 'E-posta ara…' });
  const body = h('tbody');
  const info = h('span', { class: 'muted small' });
  const load = async () => {
    try {
      const r = await api.get(`/aboneler?ara=${encodeURIComponent(search.value)}&limit=300`);
      info.textContent = `${r.total} abone`;
      body.replaceChildren();
      if (!r.rows.length) body.append(h('tr', {}, h('td', { colspan: 4, class: 'empty' }, 'Abone yok.')));
      for (const s of r.rows) {
        body.append(h('tr', {}, h('td', {}, h('b', {}, s.email)), h('td', {}, s.status === 'aktif' ? chip('Aktif', 'ok') : chip('Çıktı')), h('td', { class: 'small muted' }, fmtDate(s.created_at)),
          h('td', {}, h('div', { class: 'row' },
            h('button', { class: 'btn ghost sm', onclick: async () => { await api.patch(`/aboneler/${s.id}`, { status: s.status === 'aktif' ? 'cikti' : 'aktif' }); load(); } }, s.status === 'aktif' ? 'Çıkar' : 'Aktifleştir'),
            session.user.role === 'admin' ? h('button', { class: 'btn ghost sm icon', 'aria-label': 'Sil', onclick: async () => { if (await confirmBox({ title: 'Abone silinsin mi?', message: s.email, confirmLabel: 'Sil', danger: true })) { await api.del(`/aboneler/${s.id}`); load(); } } }, icon('trash', 15)) : null))));
      }
    } catch (e) { body.replaceChildren(h('tr', {}, h('td', { colspan: 4 }, errorBanner(e)))); }
  };
  search.addEventListener('input', debounce(load, 250));
  await load();
  return h('div', { class: 'stack' },
    h('div', { class: 'page-head' }, h('div', { class: 'grow' }, h('h1', {}, 'Bülten aboneleri'), h('p', {}, 'Blog sayfasındaki bülten formundan gelen e-posta adresleri (KVKK onaylı).')),
      h('a', { class: 'btn secondary', href: '/api/admin/aboneler.csv' }, icon('download', 16), 'CSV indir')),
    h('div', { class: 'card card-pad row wrap' }, h('div', { class: 'grow' }, search), info),
    h('div', { class: 'card' }, h('div', { class: 'tbl-wrap' }, h('table', { class: 'tbl' }, h('thead', {}, h('tr', {}, ['E-posta', 'Durum', 'Kayıt', ''].map((t) => h('th', {}, t)))), body))));
};
