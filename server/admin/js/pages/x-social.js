// Social Studio: genel bakış + platform yetenek matrisi, içerik takvimi, onay merkezi (kanban). Yayın adaptörleri bağlı değil → sahte "yayımlandı" yok.
import { api, session } from '../api.js';
import { h, icon, chip, toast, spinner, errorBanner, field, modal, confirmBox, fmtDate } from '../ui.js';
import { pageHead, tabs, stat, infoBox, needConn, empty, fmtLocal } from './x-common.js';

const ST = { taslak: ['Taslak', ''], onay_bekliyor: ['Onay bekliyor', 'warn'], onaylandi: ['Onaylandı', 'info'], planlandi: ['Planlandı', 'ok'], yayimlandi: ['Yayımlandı', 'ok'], hata: ['Hata', 'danger'], revizyon: ['Revizyon', 'warn'] };
const stChip = (s) => chip(ST[s]?.[0] ?? s, ST[s]?.[1] ?? '');
const NEXT = { taslak: [['onay_bekliyor', 'Onaya gönder']], revizyon: [['onay_bekliyor', 'Onaya gönder']], onay_bekliyor: [['onaylandi', 'Onayla'], ['revizyon', 'Revizyon iste']], onaylandi: [['planlandi', 'Planla'], ['revizyon', 'Revizyon iste']], planlandi: [['revizyon', 'Revizyon iste']], hata: [['planlandi', 'Yeniden planla']], yayimlandi: [] };

let platforms = [];

const editor = (post, onDone, preset = {}) => {
  const p = post ?? { title: '', body: '', hashtags: '', media: '', category: '', campaign: '', platforms: [], scheduled_at: '', ...preset };
  const readOnly = p.status === 'yayimlandi';
  const title = h('input', { class: 'input', value: p.title, maxlength: 140, disabled: readOnly });
  const body = h('textarea', { class: 'textarea', rows: 7, disabled: readOnly }); body.value = p.body;
  const tags = h('input', { class: 'input', value: p.hashtags, placeholder: '#Mühendislik #BIM', disabled: readOnly });
  const media = h('input', { class: 'input', value: p.media, placeholder: '/medya/dosya.webp', disabled: readOnly });
  const cat = h('input', { class: 'input', value: p.category, placeholder: 'ör. Eğitim, Teknoloji', disabled: readOnly });
  const camp = h('input', { class: 'input', value: p.campaign, placeholder: 'Kampanya serisi', disabled: readOnly });
  const when = h('input', { class: 'input', type: 'datetime-local', value: p.scheduled_at ? String(p.scheduled_at).replace(' ', 'T').slice(0, 16) : '', disabled: readOnly });
  const checks = platforms.map((pl) => ({ pl, el: h('input', { type: 'checkbox', checked: p.platforms.includes(pl.id), disabled: readOnly }) }));
  const counts = h('div', { class: 'stack' });
  const upd = () => {
    const sel = checks.filter((c) => c.el.checked).map((c) => c.pl);
    const len = body.value.length + (tags.value ? tags.value.length + 1 : 0);
    counts.replaceChildren(...sel.map((pl) => h('div', { class: `counter${len > pl.limit ? ' over' : ''}` }, `${pl.label}: ${len}/${pl.limit}`)));
  };
  for (const el of [body, tags, ...checks.map((c) => c.el)]) el.addEventListener('input', upd);
  upd();
  const payload = () => ({ title: title.value, body: body.value, hashtags: tags.value, media: media.value, category: cat.value, campaign: camp.value, scheduled_at: when.value || null, platforms: checks.filter((c) => c.el.checked).map((c) => c.pl.id), source_ref: p.source_ref });
  const m = modal({
    title: post ? `Gönderi #${post.id}` : 'Yeni gönderi',
    wide: true,
    body: h('div', { class: 'stack' },
      post ? h('div', { class: 'row wrap' }, stChip(p.status), p.sealed ? chip('İçerik mühürlü (onaylı sürümle aynı)', 'ok') : p.approved_by ? chip('Onaylı sürümden sapma var', 'warn') : null, p.approved_by ? h('span', { class: 'small muted' }, `Onaylayan: ${p.approved_by} · ${fmtDate(p.approved_at)}`) : null) : null,
      p.review_note ? infoBox(`Not: ${p.review_note}`, 'warn') : null,
      field('Başlık (iç kullanım)', title), field('Metin', body), counts,
      h('div', { class: 'grid cols-2' }, field('Etiketler', tags), field('Görsel (medya yolu)', media), field('Kategori', cat), field('Kampanya', camp)),
      field('Planlanan zaman (Europe/Istanbul)', when),
      h('div', { class: 'stack' }, h('b', {}, 'Platformlar'), h('div', { class: 'row wrap' }, checks.map(({ pl, el }) => h('label', { class: 'switch' }, el, h('i'), h('span', {}, pl.label))))),
      post && p.platforms.length ? h('div', { class: 'small muted' }, `Yayın kayıtları: ${Object.keys(p.platform_post_ids).length ? Object.entries(p.platform_post_ids).map(([k, v]) => `${k}: ${v}`).join(' · ') : 'yok'}`) : null,
      NEXT[p.status]?.length && post ? h('div', { class: 'row wrap' }, h('b', {}, 'İş akışı:'), NEXT[p.status].filter(([to]) => to !== 'onaylandi' || session.user.role === 'admin').map(([to, label]) => h('button', { class: `btn ${to === 'revizyon' ? 'secondary' : ''} sm`, onclick: async () => {
        const note = to === 'revizyon' ? prompt('Revizyon notu:') ?? '' : '';
        try { await api.put(`/x/sosyal/gonderiler/${post.id}`, payload()); await api.post(`/x/sosyal/gonderiler/${post.id}/gecis`, { to, note }); toast(`${label}: tamam`, 'ok'); m.close(); onDone(); } catch (e) { toast(e.errors ? e.message : e.message, 'err'); if (e.data?.errors) toast(e.data.errors.join(' · '), 'err'); }
      } }, label))) : null,
      post && (p.status === 'planlandi' || p.status === 'onaylandi') ? h('div', { class: 'row wrap' }, h('b', {}, 'Elle yayımladıysanız:'), p.platforms.filter((x) => !p.platform_post_ids[x]).map((x) => h('button', { class: 'btn secondary sm', onclick: async () => {
        if (!(await confirmBox({ title: 'Yayımlandı olarak işaretle?', message: `${x} platformunda bu gönderiyi kendiniz yayımladığınızı onaylıyorsunuz. Bu işlem geri alınamaz.`, confirmLabel: 'İşaretle' }))) return;
        try { await api.post(`/x/sosyal/gonderiler/${post.id}/elle-yayimlandi`, { platform: x, ref: 'elle' }); toast('İşaretlendi', 'ok'); m.close(); onDone(); } catch (e) { toast(e.message, 'err'); }
      } }, `${x} yayımlandı`))) : null,
      needConn('Platform hesapları (OAuth) bağlı olmadığından otomatik yayın kapalıdır. Onaylı içeriği platformda kendiniz yayımlayıp işaretleyebilirsiniz.')),
    actions: readOnly ? [{ label: 'Kapat', class: 'secondary' }] : [
      post ? { label: 'Sil', class: 'danger secondary', onClick: async () => { if (!(await confirmBox({ title: 'Gönderi silinsin mi?', message: 'Kayıt kalıcı olarak silinir.', confirmLabel: 'Sil', danger: true }))) return false; await api.del(`/x/sosyal/gonderiler/${post.id}`); onDone(); } } : { label: 'Vazgeç', class: 'secondary' },
      { label: 'Kaydet', onClick: async () => { try { await api[post ? 'put' : 'post'](post ? `/x/sosyal/gonderiler/${post.id}` : '/x/sosyal/gonderiler', payload()); toast('Kaydedildi', 'ok'); onDone(); } catch (e) { toast(e.message, 'err'); return false; } } },
    ],
  });
};

/* ---------- sekmeler ---------- */
const overview = async () => {
  const d = await api.get('/x/sosyal');
  platforms = d.platforms;
  const capc = (v) => (v ? chip('Destekli', 'ok') : chip('Yok', ''));
  return h('div', { class: 'stack' },
    h('div', { class: 'grid cols-4' }, stat(d.summary.total, 'Toplam gönderi'), stat(d.summary.byStatus.taslak ?? 0, 'Taslak'), stat(d.summary.byStatus.onay_bekliyor ?? 0, 'Onay bekliyor'), stat((d.summary.byStatus.planlandi ?? 0) + (d.summary.byStatus.onaylandi ?? 0), 'Onaylı / planlı')),
    h('div', { class: 'card' }, h('div', { class: 'card-head' }, h('h3', {}, 'Platform bağlantıları ve yetenek matrisi'), chip('Hiçbiri bağlı değil', 'warn')),
      h('div', { class: 'tbl-wrap' }, h('table', { class: 'tbl' }, h('thead', {}, h('tr', {}, ['Platform', 'Karakter', 'Yazı', 'Görsel', 'Carousel', 'Zamanlama', 'Analitik', 'Gereken bağlantı'].map((x) => h('th', {}, x)))),
        h('tbody', {}, d.platforms.map((p) => h('tr', {}, h('td', {}, h('b', {}, p.label)), h('td', {}, p.limit), h('td', {}, capc(p.caps.yazi)), h('td', {}, capc(p.caps.gorsel)), h('td', {}, capc(p.caps.carousel)), h('td', {}, capc(p.caps.zamanla)), h('td', {}, capc(p.caps.insights)), h('td', { class: 'small muted' }, p.needs))))))),
    d.summary.upcoming.length ? h('div', { class: 'card card-pad stack' }, h('h3', {}, 'Yaklaşan onaylı yayınlar'), h('ul', {}, d.summary.upcoming.map((u) => h('li', {}, `${fmtLocal(u.scheduled_at)} — ${u.title} (${u.platforms.join(', ')})`)))) : null,
    h('div', { class: 'card card-pad stack' }, h('h3', {}, 'Yaklaşan özel günler'), h('p', { class: 'small muted' }, 'Yalnızca sabit tarihli resmî/uluslararası günler; kullanmadan önce doğrulayın. Otomatik yayın kapalıdır — taslak oluşturup onaya göndermeniz gerekir.'),
      d.specialDays.length ? h('table', { class: 'tbl' }, h('tbody', {}, d.specialDays.map((s) => h('tr', {}, h('td', {}, fmtDate(`${s.date}T00:00`).split(' ').slice(0, 3).join(' ')), h('td', {}, h('b', {}, s.name)), h('td', {}, `${s.inDays} gün kaldı`), h('td', {}, h('button', { class: 'btn secondary sm', onclick: () => editor(null, () => location.reload(), { title: s.name, category: 'Özel Gün', scheduled_at: `${s.date}T10:00` }) }, 'Taslak oluştur')))))) : empty('90 gün içinde özel gün yok.')));
};

const calendar = async () => {
  const wrap = h('div', { class: 'stack' });
  let cur = new Date(); cur.setDate(1);
  const grid = h('div', { style: 'display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:6px' });
  const title = h('h3', { class: 'grow' });
  const load = async () => {
    const from = new Date(cur.getFullYear(), cur.getMonth(), 1), to = new Date(cur.getFullYear(), cur.getMonth() + 1, 1);
    const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    title.textContent = cur.toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' });
    const rows = (await api.get(`/x/sosyal/gonderiler?bas=${iso(from)}&bit=${iso(to)}`)).rows;
    const cells = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'].map((x) => h('div', { class: 'small muted', style: 'text-align:center;font-weight:600' }, x));
    const offset = (from.getDay() + 6) % 7;
    for (let i = 0; i < offset; i++) cells.push(h('div'));
    const days = new Date(cur.getFullYear(), cur.getMonth() + 1, 0).getDate();
    for (let day = 1; day <= days; day++) {
      const key = `${iso(from).slice(0, 8)}${String(day).padStart(2, '0')}`;
      const mine = rows.filter((r) => String(r.scheduled_at ?? r.created_at).slice(0, 10) === key);
      cells.push(h('div', { class: 'card', style: 'min-height:84px;padding:6px;display:grid;gap:4px;align-content:start' },
        h('div', { class: 'small muted' }, day),
        ...mine.slice(0, 3).map((r) => h('button', { class: 'btn secondary sm', style: 'height:auto;padding:3px 6px;justify-content:flex-start;text-align:left;font-size:11.5px', onclick: () => editor(r, load) }, `${String(r.scheduled_at ?? '').slice(11, 16)} ${r.title}`.trim())),
        mine.length > 3 ? h('div', { class: 'small muted' }, `+${mine.length - 3} daha`) : null));
    }
    grid.replaceChildren(...cells);
  };
  wrap.append(h('div', { class: 'row' }, h('button', { class: 'btn secondary sm', onclick: () => { cur.setMonth(cur.getMonth() - 1); load(); } }, icon('chevron', 14)), title, h('button', { class: 'btn secondary sm', onclick: () => { cur.setMonth(cur.getMonth() + 1); load(); } }, icon('chevron', 14)), h('button', { class: 'btn sm', onclick: () => editor(null, load) }, icon('plus', 14), 'Yeni içerik')), grid);
  await load();
  return wrap;
};

const board = async () => {
  const rows = (await api.get('/x/sosyal/gonderiler')).rows;
  const cols = ['taslak', 'onay_bekliyor', 'revizyon', 'onaylandi', 'planlandi', 'yayimlandi', 'hata'];
  const reload = () => location.reload();
  return h('div', { class: 'stack' },
    infoBox('Akış: Taslak → Onay bekliyor → Onaylandı → Planlandı → Yayımlandı. Onay yalnızca yöneticiden gelir; onaylanan metin+medya+platform+zaman SHA-256 ile mühürlenir, içerik değişirse onay düşer. Otomatik doğrudan yayın kapalıdır.'),
    h('div', { style: 'display:grid;grid-auto-flow:column;grid-auto-columns:minmax(230px,1fr);gap:12px;overflow-x:auto;align-items:start' }, cols.map((c) => {
      const items = rows.filter((r) => r.status === c);
      return h('div', { class: 'card card-pad stack', style: 'background:#f8fafc' }, h('div', { class: 'row' }, h('b', { class: 'grow' }, ST[c][0]), chip(String(items.length))),
        items.length ? items.map((r) => h('button', { class: 'card card-pad', style: 'text-align:left;cursor:pointer;display:grid;gap:4px', onclick: () => editor(r, reload) }, h('b', {}, r.title), h('span', { class: 'small muted' }, `${fmtLocal(r.scheduled_at)} · ${r.platforms.join(', ') || 'platform yok'}`), r.sealed ? chip('Mühürlü', 'ok') : null)) : h('div', { class: 'small muted' }, '—'));
    })));
};

export const renderSocial = async (ctx) => {
  ctx.setTitle('Social Studio');
  const body = h('div');
  const show = async (k) => {
    body.replaceChildren(spinner());
    try { body.replaceChildren(await { genel: overview, takvim: calendar, onay: board }[k]()); } catch (e) { body.replaceChildren(errorBanner(e)); }
  };
  try { platforms = (await api.get('/x/sosyal')).platforms; } catch (e) { return errorBanner(e); }
  const fromBlog = h('button', { class: 'btn secondary', onclick: async () => {
    const posts = (await api.get('/x/seo/girdiler')).rows.filter((r) => r.kind === 'blog' && !r.draft);
    if (!posts.length) return toast('Yayında blog yazısı yok', 'err');
    const sel = h('select', { class: 'select' }, posts.map((r) => h('option', { value: r.slug }, r.title)));
    modal({ title: 'Blogdan sosyal taslak türet', body: field('Blog yazısı', sel, 'Metin yazının özetinden ve bağlantıdan oluşur; sonra düzenleyip onaya gönderirsiniz.'), actions: [{ label: 'Vazgeç', class: 'secondary' }, { label: 'Taslak oluştur', onClick: async () => {
      try { const p = await api.post(`/x/sosyal/blogdan/${sel.value}`); toast('Taslak oluşturuldu', 'ok'); editor(p, () => location.reload()); } catch (e) { toast(e.message, 'err'); return false; }
    } }] });
  } }, 'Blogdan türet');
  const el = h('div', {}, pageHead('Social Studio', 'İçerik takvimi, onay iş akışı ve platform yetenek matrisi.', fromBlog, h('button', { class: 'btn', onclick: () => editor(null, () => location.reload()) }, icon('plus', 16), 'Yeni içerik')),
    tabs([['genel', 'Genel bakış'], ['takvim', 'İçerik takvimi'], ['onay', 'Onay merkezi']], 'genel', show), body);
  show('genel');
  return el;
};
