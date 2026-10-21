// Sayfa metinleri: belge listesi ve şema güdümlü belge editörü
import { api, session } from '../api.js';
import { h, icon, chip, fmtDate, debounce, toast, confirmBox, errorBanner, modal, spinner } from '../ui.js';
import { createEditor, deepEqual } from '../editor.js';
import { openMediaPicker } from './media.js';

/** Belge anahtarı → sitedeki karşılık gelen sayfa (önizleme bağlantısı) */
const PAGE_OF = (key) => {
  const p = key.split('.')[0];
  const map = { home: '/', about: '/hakkimizda', servicesPage: '/hizmetler', services: '/hizmetler', expertisePage: '/uzmanlik-alanlari', projectsPage: '/projeler', blog: '/blog', contactPage: '/iletisim', faq: '/iletisim', workModel: '/calisma-modeli', process: '/', navigation: '/', footer: '/', site: '/', assistant: '/' };
  if (key.startsWith('serviceContent.sectors')) return '/uzmanlik-alanlari';
  if (key.startsWith('serviceContent')) return '/hizmetler';
  return map[p] ?? '/';
};

export const renderDocList = async (ctx) => {
  ctx.setTitle('Sayfa metinleri');
  const { docs } = await api.get('/icerik');
  const search = h('input', { class: 'input', type: 'search', placeholder: 'Belge ara… (ör. hero, iletişim, menü)' });
  const list = h('div', { class: 'stack' });
  const draw = () => {
    const q = search.value.trim().toLocaleLowerCase('tr');
    list.replaceChildren();
    const groups = new Map();
    for (const d of docs) {
      if (q && !`${d.group} ${d.label} ${d.key}`.toLocaleLowerCase('tr').includes(q)) continue;
      if (!groups.has(d.group)) groups.set(d.group, []);
      groups.get(d.group).push(d);
    }
    if (!groups.size) list.append(h('div', { class: 'empty card' }, 'Eşleşen belge yok.'));
    for (const [g, items] of groups) {
      list.append(h('div', { class: 'card' },
        h('div', { class: 'card-head' }, h('h3', {}, g), chip(`${items.length} belge`)),
        h('div', { class: 'tbl-wrap' }, h('table', { class: 'tbl' }, h('tbody', {}, items.map((d) =>
          h('tr', { class: 'clickable', onclick: () => ctx.nav(`/icerik/${d.key}`) },
            h('td', {}, h('b', {}, d.label)),
            h('td', {}, d.draft ? chip('Taslak var', 'warn') : d.published ? chip('Özelleştirildi', 'info') : chip('Varsayılan')),
            h('td', { class: 'muted small' }, d.draft ? fmtDate(d.draftAt) : d.published ? fmtDate(d.publishedAt) : ''),
            h('td', { style: undefined }, icon('chevron', 16)))))))));
    }
  };
  search.addEventListener('input', debounce(draw, 120));
  draw();
  return h('div', { class: 'stack' },
    h('div', { class: 'page-head' }, h('div', { class: 'grow' }, h('h1', {}, 'Sayfa metinleri'), h('p', {}, 'Sitedeki tüm başlıkları, metinleri, menüleri, iletişim bilgilerini ve hizmet/sektör sayfalarını düzenleyin. Değişiklikler önce taslak olarak kaydedilir; "Yayınla" ile siteye yansır.'))),
    h('div', { class: 'card card-pad' }, search), list);
};

export const renderDocEditor = async (ctx, key) => {
  const [doc, iconsRes] = await Promise.all([api.get(`/icerik/${key}`), api.get('/simgeler').catch(() => ({ icons: [] }))]);
  ctx.setTitle(doc.label);
  const baseline = () => doc.draft ?? doc.published ?? doc.defaults;
  let saved = baseline(); // son kaydedilen/yayındaki hâl (karşılaştırma için)
  let dirty = false;
  const dot = h('span', { class: 'dirty-dot hidden', title: 'Kaydedilmemiş değişiklik' });
  const status = h('span', { class: 'muted small' });
  const saveBtn = h('button', { class: 'btn', onclick: () => save() }, icon('check', 16), 'Taslağı kaydet');
  const errBox = h('div');

  const editor = createEditor({
    value: baseline(),
    defaults: doc.defaults,
    icons: iconsRes.icons,
    pickMedia: () => openMediaPicker({ type: 'image' }),
    onChange: () => {
      dirty = true;
      dot.classList.remove('hidden');
      saveBtn.disabled = false;
      status.textContent = 'Kaydedilmemiş değişiklikler var';
    },
  });
  ctx.setLeaveGuard(() => !dirty || confirm('Kaydedilmemiş değişiklikleriniz var. Sayfadan ayrılmak istiyor musunuz?'));
  saveBtn.disabled = true;

  async function save() {
    errBox.replaceChildren();
    saveBtn.disabled = true;
    try {
      const value = editor.getValue();
      await api.put(`/icerik/${key}`, { value });
      saved = value;
      dirty = false;
      dot.classList.add('hidden');
      status.textContent = 'Taslak kaydedildi — yayınlamak için "Yayınla"ya gidin';
      toast('Taslak kaydedildi', 'ok');
      doc.draft = value;
      ctx.refreshBadges();
      drawSide();
    } catch (e) {
      errBox.replaceChildren(errorBanner(e));
      saveBtn.disabled = false;
      errBox.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
  }

  const side = h('div', { class: 'editor-side' });
  const drawSide = () => {
    const customised = !deepEqual(doc.draft ?? doc.published ?? doc.defaults, doc.defaults);
    side.replaceChildren(
      h('div', { class: 'card card-pad stack' },
        h('h3', {}, 'Durum'),
        h('div', { class: 'row wrap' }, doc.draft ? chip('Taslak var', 'warn') : null, doc.published ? chip('Yayında özelleştirilmiş', 'info') : chip('Varsayılan metin'), customised ? chip('Varsayılandan farklı') : null),
        doc.draft ? h('div', { class: 'small muted' }, `Taslak: ${fmtDate(doc.draftAt)}${doc.draftBy ? ' · ' + doc.draftBy : ''}`) : null,
        doc.published ? h('div', { class: 'small muted' }, `Yayın: ${fmtDate(doc.publishedAt)}`) : null,
        h('a', { class: 'btn secondary sm', href: PAGE_OF(key), target: '_blank', rel: 'noopener' }, icon('external', 15), 'İlgili sayfayı aç')),
      h('div', { class: 'card card-pad stack' },
        h('h3', {}, 'İşlemler'),
        h('button', { class: 'btn secondary sm', onclick: showVersions }, icon('history', 15), 'Sürüm geçmişi'),
        doc.draft ? h('button', { class: 'btn secondary sm', onclick: discard }, icon('undo', 15), 'Taslağı at (yayındakine dön)') : null,
        h('button', { class: 'btn danger secondary sm', onclick: resetDefaults }, icon('trash', 15), 'Varsayılan metne döndür'),
        h('div', { class: 'hint' }, 'Varsayılana döndürme de taslak olarak kaydedilir; "Yayınla" ile geçerli olur.')),
      h('div', { class: 'card card-pad small stack' },
        h('b', {}, 'İpuçları'),
        h('div', { class: 'muted' }, '• Kartlarda ▲▼ ile sırayı, ⧉ ile çoğaltmayı kullanın.'),
        h('div', { class: 'muted' }, '• "Doğrulanmadı" işaretli rakam ve iddialar canlı sitede görünmez.'),
        h('div', { class: 'muted' }, '• Bağlantılar /sayfa, #bölüm, https://… veya mailto:/tel: ile başlamalı.')));
  };
  drawSide();

  async function discard() {
    if (!(await confirmBox({ title: 'Taslak atılsın mı?', message: 'Kaydedilmiş taslak silinir; içerik yayındaki hâline döner.', confirmLabel: 'Taslağı at', danger: true }))) return;
    await api.del(`/icerik/${key}/taslak`);
    toast('Taslak atıldı', 'ok');
    dirty = false;
    ctx.refreshBadges();
    location.reload();
  }
  async function resetDefaults() {
    if (!(await confirmBox({ title: 'Varsayılana dönülsün mü?', message: 'Bu belgedeki tüm özelleştirmeler varsayılan metinle değiştirilir (taslak olarak). Sürüm geçmişinden geri alabilirsiniz.', confirmLabel: 'Varsayılana döndür', danger: true }))) return;
    await api.post(`/icerik/${key}/sifirla`);
    toast('Varsayılan metin taslak olarak kaydedildi', 'ok');
    dirty = false;
    ctx.refreshBadges();
    location.reload();
  }
  async function showVersions() {
    const body = h('div', {}, spinner());
    modal({ title: 'Sürüm geçmişi', body, wide: false });
    try {
      const { versions } = await api.get(`/icerik/${key}/surumler`);
      body.replaceChildren(versions.length
        ? h('table', { class: 'tbl' }, h('tbody', {}, versions.map((v) => h('tr', {},
            h('td', {}, chip(v.kind, v.kind === 'yayın' ? 'ok' : ''), h('div', { class: 'muted small' }, `${fmtDate(v.created_at)} · ${v.user_email ?? ''}`), v.note ? h('div', { class: 'small' }, v.note) : null),
            h('td', {}, h('button', { class: 'btn secondary sm', onclick: async () => {
              const ver = await api.get(`/icerik/${key}/surum/${v.id}`);
              editor.replace(ver.json);
              dirty = true;
              dot.classList.remove('hidden');
              saveBtn.disabled = false;
              status.textContent = `${fmtDate(v.created_at)} sürümü forma yüklendi — kaydetmeniz gerekir`;
              document.querySelector('.overlay')?.remove();
            } }, 'Forma yükle'))))))
        : h('div', { class: 'empty' }, 'Henüz sürüm yok.'));
    } catch (e) {
      body.replaceChildren(errorBanner(e));
    }
  }

  return h('div', {},
    h('div', { class: 'page-head' }, h('div', { class: 'grow' }, h('div', { class: 'crumbs' }, h('a', { href: '#/icerik' }, 'Sayfa metinleri'), ' › ', doc.group), h('h1', {}, doc.label, ' ', dot), h('p', { class: 'mono muted' }, key))),
    errBox,
    h('div', { class: 'editor-layout' }, editor.el, side),
    h('div', { class: 'savebar' }, saveBtn, status, h('span', { class: 'grow' }), h('a', { class: 'btn ghost', href: '#/icerik' }, 'Listeye dön')));
};

void session;
