// Blog yazıları, projeler ve yasal metinler: liste + alan şemasına dayalı editör + Markdown editörü
import { api } from '../api.js';
import { h, icon, chip, fmtDate, toast, confirmBox, errorBanner, field } from '../ui.js';
import { openMediaPicker } from './media.js';
import { createRichEditor } from '../richtext.js';

const KINDS = {
  blog: { path: '/blog', apiKind: 'blog', title: 'Blog yazıları', one: 'Blog yazısı', newLabel: 'Yeni yazı', site: (s) => `/blog/${s}` },
  projeler: { path: '/projeler', apiKind: 'projects', title: 'Projeler', one: 'Proje', newLabel: 'Yeni proje', site: (s) => `/projeler/${s}` },
  yasal: { path: '/yasal', apiKind: 'legal', title: 'Yasal metinler', one: 'Yasal metin', newLabel: '', site: (s) => `/${s === 'cerez-politikasi' ? 'cerez-tercihleri' : s === 'kvkk' ? 'kvkk' : s}` },
};

const TR = { ç: 'c', ğ: 'g', ı: 'i', ö: 'o', ş: 's', ü: 'u', Ç: 'c', Ğ: 'g', İ: 'i', I: 'i', Ö: 'o', Ş: 's', Ü: 'u' };
const slugify = (s) => s.replace(/[çğıöşüÇĞİIÖŞÜ]/g, (c) => TR[c]).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 90);

/* ---------------- içerik editörü: zengin metin (WYSIWYG), Markdown olarak saklanır ---------------- */
const mdEditor = (initial, onChange) => createRichEditor({ value: initial, onChange, pickMedia: () => openMediaPicker({ type: 'image' }) });

/* ---------------- liste ---------------- */
export const renderEntryList = async (ctx, k) => {
  const K = KINDS[k];
  ctx.setTitle(K.title);
  const { rows, meta } = await api.get(`/girdi/${K.apiKind}`);
  const q = h('input', { class: 'input', type: 'search', placeholder: 'Ara…' });
  const body = h('tbody');
  const draw = () => {
    const s = q.value.trim().toLocaleLowerCase('tr');
    body.replaceChildren();
    const list = rows.filter((r) => !s || `${r.title} ${r.slug} ${r.category}`.toLocaleLowerCase('tr').includes(s));
    if (!list.length) body.append(h('tr', {}, h('td', { colspan: 4, class: 'empty' }, 'Kayıt yok.')));
    for (const r of list) {
      body.append(h('tr', { class: 'clickable', onclick: () => ctx.nav(`${K.path}/${r.slug}`) },
        h('td', {}, h('b', {}, r.title), h('div', { class: 'muted small mono' }, r.slug)),
        h('td', {}, k === 'yasal' ? (r.draft ? chip('Onaylanmadı — "hazırlanıyor" gösterilir', 'warn') : chip('Onaylı', 'ok')) : (r.draft ? chip('Taslak', 'warn') : chip('Yayında', 'ok')), r.featured ? ' ' : '', r.featured ? chip('Öne çıkan', 'info') : null),
        h('td', { class: 'muted small' }, r.category),
        h('td', { class: 'muted small' }, r.date ? fmtDate(r.date) : fmtDate(r.updatedAt))));
    }
  };
  q.addEventListener('input', draw);
  draw();
  return h('div', { class: 'stack' },
    h('div', { class: 'page-head' }, h('div', { class: 'grow' }, h('h1', {}, K.title), h('p', {}, k === 'yasal' ? 'Hukuki metinler firma/hukuk danışmanı tarafından sağlanmalıdır. "Onaylı" işaretlenmezse sayfa "hazırlanıyor" gösterir ve arama motorlarına kapalı kalır.' : 'Taslak olarak işaretli girdiler canlı sitede görünmez. Kaydettikten sonra "Yayınla" ile siteye yansıtın.')),
      K.newLabel ? h('a', { class: 'btn', href: `#${K.path}/yeni` }, icon('plus', 16), K.newLabel) : null),
    h('div', { class: 'card card-pad' }, q),
    h('div', { class: 'card' }, h('div', { class: 'tbl-wrap' }, h('table', { class: 'tbl' }, h('thead', {}, h('tr', {}, ['Başlık', 'Durum', 'Kategori / sektör', 'Tarih'].map((t) => h('th', {}, t)))), body))),
    meta ? null : null);
};

/* ---------------- editör ---------------- */
const getPath = (o, p) => p.split('.').reduce((a, k) => (a == null ? a : a[k]), o);
const setPath = (o, p, v) => {
  const ks = p.split('.');
  const last = ks.pop();
  let cur = o;
  for (const k of ks) cur = cur[k] ??= {};
  cur[last] = v;
};

export const renderEntryEditor = async (ctx, k, slug) => {
  const K = KINDS[k];
  const isNew = slug === null;
  let entry;
  if (isNew) {
    const listing = await api.get(`/girdi/${K.apiKind}`);
    entry = { kind: K.apiKind, slug: '', data: { ...structuredClone(listing.meta.defaults), pubDate: new Date().toISOString().slice(0, 10) }, body: '', fields: listing.meta.fields, previews: {} };
  } else entry = await api.get(`/girdi/${K.apiKind}/${slug}`);
  ctx.setTitle(isNew ? K.newLabel : entry.data.title ?? slug);

  const data = structuredClone(entry.data);
  let dirty = false;
  const errBox = h('div');
  const status = h('span', { class: 'muted small' });
  const dot = h('span', { class: 'dirty-dot hidden' });
  const saveBtn = h('button', { class: 'btn', onclick: () => save() }, icon('check', 16), isNew ? 'Oluştur' : 'Kaydet');
  const touch = () => { dirty = true; dot.classList.remove('hidden'); status.textContent = 'Kaydedilmemiş değişiklikler var'; };
  ctx.setLeaveGuard(() => !dirty || confirm('Kaydedilmemiş değişiklikleriniz var. Sayfadan ayrılmak istiyor musunuz?'));

  const slugInput = h('input', { class: 'input mono', value: entry.slug, readOnly: !isNew, placeholder: 'adres-metni', oninput: (e) => { slugTouched = true; entry.slug = e.target.value; touch(); } });
  let slugTouched = !isNew;
  const bodyEd = mdEditor(entry.body, touch);

  const control = (f) => {
    const v = getPath(data, f.name);
    const set = (val) => { setPath(data, f.name, val); touch(); };
    switch (f.type) {
      case 'text':
      case 'date': {
        const input = h('input', { class: 'input', type: f.type === 'date' ? 'date' : 'text', value: v ?? '', oninput: (e) => { set(e.target.value); counter(e.target.value); if (f.name === 'title' && isNew && !slugTouched) { slugInput.value = slugify(e.target.value); entry.slug = slugInput.value; } } });
        const cn = f.max ? h('div', { class: 'counter' }) : null;
        const counter = (s) => { if (cn) { cn.textContent = `${s.length} / ${f.max}`; cn.classList.toggle('over', s.length > f.max); } };
        counter(v ?? '');
        return h('div', {}, input, cn);
      }
      case 'textarea': {
        const ta = h('textarea', { class: 'textarea', rows: f.rows ?? 3, oninput: (e) => { set(e.target.value); counter(e.target.value); } });
        ta.value = v ?? '';
        const cn = f.max || f.min ? h('div', { class: 'counter' }) : null;
        const counter = (s) => { if (cn) { cn.textContent = `${s.length}${f.max ? ` / ${f.max}` : ''}`; cn.classList.toggle('over', (f.max && s.length > f.max) || (f.min && s.length < f.min && s.length > 0)); } };
        counter(v ?? '');
        return h('div', {}, ta, cn);
      }
      case 'select':
        return h('select', { class: 'select', onchange: (e) => set(e.target.value) }, !v ? h('option', { value: '' }, '— seçiniz —') : null, f.options.map((o) => h('option', { value: o.value, selected: o.value === v }, o.label)));
      case 'number':
        return h('input', { class: 'input', type: 'number', value: v ?? 0, oninput: (e) => set(e.target.value === '' ? 0 : Number(e.target.value)) });
      case 'bool':
        return h('label', { class: 'switch' }, h('input', { type: 'checkbox', checked: !!v, onchange: (e) => set(e.target.checked) }), h('i'), h('span', {}, f.label));
      case 'tags': {
        const input = h('input', { class: 'input', value: (v ?? []).join(', '), placeholder: 'virgülle ayırın', oninput: (e) => set(e.target.value.split(',').map((s) => s.trim()).filter(Boolean)) });
        return input;
      }
      case 'media': {
        const img = h('img', { alt: '', style: undefined, width: 96, class: 'md-preview', src: entry.previews?.cover && f.name === 'cover' ? entry.previews.cover : '' });
        const input = h('input', { class: 'input mono', value: v ?? '', placeholder: 'Medya kütüphanesinden seçin', oninput: (e) => { set(e.target.value); img.classList.toggle('hidden', !e.target.value); } });
        if (!img.src || img.src === location.href) img.classList.add('hidden');
        return h('div', { class: 'stack' }, h('div', { class: 'row' }, input,
          h('button', { type: 'button', class: 'btn secondary', onclick: async () => { const m = await openMediaPicker({ type: 'image' }); if (m) { input.value = m.url; img.src = m.url; img.classList.remove('hidden'); set(m.url); if (f.name === 'cover' && m.alt && !data.coverAlt) { data.coverAlt = m.alt; document.getElementById('f-coverAlt')?.setAttribute('value', m.alt); const el = document.getElementById('f-coverAlt'); if (el) el.value = m.alt; } } } }, icon('image', 16), 'Medya seç'),
          v ? h('button', { type: 'button', class: 'btn ghost', onclick: () => { input.value = ''; set(''); img.classList.add('hidden'); } }, 'Kaldır') : null), img);
      }
      case 'verifiable': {
        const cur = v ?? { value: '', verified: false };
        if (!v) setPath(data, f.name, cur), null;
        const flag = h('label', { class: `vflag${cur.verified ? '' : ' unv'}` });
        const txt = h('span', {}, cur.verified ? 'Doğrulandı' : 'Doğrulanmadı');
        flag.append(h('input', { type: 'checkbox', checked: cur.verified, onchange: (e) => { cur.verified = e.target.checked; flag.classList.toggle('unv', !cur.verified); txt.textContent = cur.verified ? 'Doğrulandı' : 'Doğrulanmadı'; if (!v) setPath(data, f.name, cur); touch(); } }), txt);
        return h('div', { class: 'vrow' }, h('input', { class: 'input', value: cur.value, oninput: (e) => { cur.value = e.target.value; setPath(data, f.name, cur); touch(); } }), flag,
          h('input', { class: 'input note', placeholder: 'Doğrulama notu / kaynak', value: cur.note ?? '', oninput: (e) => { cur.note = e.target.value || undefined; setPath(data, f.name, cur); touch(); } }));
      }
      case 'verifiable-list': {
        const arr = (data[f.name] ??= []);
        const box = h('div', { class: 'stack' });
        const draw = () => {
          box.replaceChildren();
          arr.forEach((it, i) => {
            const flag = h('label', { class: `vflag${it.verified ? '' : ' unv'}` });
            const txt = h('span', {}, it.verified ? 'Doğrulandı' : 'Doğrulanmadı');
            flag.append(h('input', { type: 'checkbox', checked: it.verified, onchange: (e) => { it.verified = e.target.checked; flag.classList.toggle('unv', !it.verified); txt.textContent = it.verified ? 'Doğrulandı' : 'Doğrulanmadı'; touch(); } }), txt);
            box.append(h('div', { class: 'list-row' }, h('input', { class: 'input', value: it.value, oninput: (e) => { it.value = e.target.value; touch(); } }), flag,
              h('button', { type: 'button', class: 'btn ghost sm icon', 'aria-label': 'Sil', onclick: () => { arr.splice(i, 1); touch(); draw(); } }, icon('trash', 15))));
          });
          box.append(h('div', {}, h('button', { type: 'button', class: 'btn secondary sm', onclick: () => { arr.push({ value: '', verified: false }); touch(); draw(); } }, icon('plus', 15), 'Sonuç ekle')));
        };
        draw();
        return box;
      }
      case 'gallery': {
        const arr = (data[f.name] ??= []);
        const box = h('div', { class: 'stack' });
        const draw = () => {
          box.replaceChildren();
          arr.forEach((g, i) => box.append(h('div', { class: 'list-row' },
            h('input', { class: 'input mono', value: g.src, placeholder: 'Görsel', oninput: (e) => { g.src = e.target.value; touch(); } }),
            h('input', { class: 'input', value: g.alt ?? '', placeholder: 'Alt metin (zorunlu)', oninput: (e) => { g.alt = e.target.value; touch(); } }),
            h('button', { type: 'button', class: 'btn ghost sm icon', 'aria-label': 'Sil', onclick: () => { arr.splice(i, 1); touch(); draw(); } }, icon('trash', 15)))));
          box.append(h('div', {}, h('button', { type: 'button', class: 'btn secondary sm', onclick: async () => { const m = await openMediaPicker({ type: 'image' }); if (m) { arr.push({ src: m.url, alt: m.alt || '' }); touch(); draw(); } } }, icon('image', 15), 'Görsel ekle')));
        };
        draw();
        return box;
      }
      default:
        return h('div', {}, `(${f.type})`);
    }
  };

  const fieldsEl = h('div', { class: 'stack' });
  const seo = [];
  for (const f of entry.fields) {
    if (f.name.startsWith('seo.')) { seo.push(f); continue; }
    const c = control(f);
    if (c.id === undefined && f.name === 'coverAlt') c.querySelector?.('input')?.setAttribute('id', 'f-coverAlt');
    fieldsEl.append(f.type === 'bool' ? h('div', {}, c, f.hint ? h('div', { class: 'hint' }, f.hint) : null) : field(f.label + (f.required ? ' *' : ''), c, f.hint));
  }
  if (seo.length) {
    const sbody = h('div', { class: 'fset-body' }, seo.map((f) => (f.type === 'bool' ? control(f) : field(f.label, control(f), f.hint))));
    const fs = h('div', { class: 'fset collapsed' }, h('div', { class: 'fset-head', onclick: () => fs.classList.toggle('collapsed'), style: undefined }, h('span', { class: 'ttl' }, 'Arama motoru (SEO) ayarları'), icon('chevron', 16)), sbody);
    fieldsEl.append(fs);
  }

  async function save() {
    errBox.replaceChildren();
    saveBtn.disabled = true;
    try {
      const slugVal = (entry.slug || '').trim();
      if (isNew && !slugVal) throw Object.assign(new Error('Adres (slug) boş olamaz'), { data: null });
      await api.put(`/girdi/${K.apiKind}/${isNew ? slugVal : slug}`, { data, body: bodyEd.get(), create: isNew });
      dirty = false;
      dot.classList.add('hidden');
      toast(isNew ? 'Oluşturuldu' : 'Kaydedildi — siteye yansıması için "Yayınla"', 'ok');
      ctx.refreshBadges();
      if (isNew) ctx.nav(`${K.path}/${slugVal}`);
      else status.textContent = 'Kaydedildi — yayınlamak için "Yayınla"ya gidin';
    } catch (e) {
      errBox.replaceChildren(errorBanner(e));
      errBox.scrollIntoView({ block: 'center', behavior: 'smooth' });
    } finally {
      saveBtn.disabled = false;
    }
  }

  const draftNote = k === 'yasal' ? null : h('div', { class: 'banner info' }, icon('alert'), h('div', {}, 'Bu girdi ', h('b', {}, 'Taslak'), ' işaretliyken canlı sitede görünmez. Yayına almak için "Taslak" anahtarını kapatın, kaydedin ve "Yayınla"yı kullanın.'));

  return h('div', {},
    h('div', { class: 'page-head' }, h('div', { class: 'grow' }, h('div', { class: 'crumbs' }, h('a', { href: `#${K.path}` }, K.title), ' › ', isNew ? 'Yeni' : entry.data.title ?? slug), h('h1', {}, isNew ? K.newLabel : entry.data.title ?? slug, ' ', dot),
      isNew ? null : h('p', { class: 'mono muted' }, `${K.apiKind}/${slug}.md`)),
      !isNew && k !== 'yasal' ? h('button', { class: 'btn danger secondary', onclick: async () => {
        if (!(await confirmBox({ title: 'Silinsin mi?', message: `"${entry.data.title ?? slug}" silinecek (dosya çöp klasörüne taşınır, yedekten geri alınabilir).`, confirmLabel: 'Sil', danger: true }))) return;
        try { await api.del(`/girdi/${K.apiKind}/${slug}`); dirty = false; toast('Silindi', 'ok'); ctx.refreshBadges(); ctx.nav(K.path); } catch (e) { toast(e.message, 'err'); }
      } }, icon('trash', 16), 'Sil') : null),
    errBox, draftNote,
    h('div', { class: 'stack' },
      h('div', { class: 'card card-pad stack' }, isNew ? field('Adres (slug)', slugInput, 'Yalnızca küçük harf, rakam ve tire. Başlıktan otomatik üretilir; oluşturduktan sonra değiştirilemez.') : null, fieldsEl),
      h('div', { class: 'card card-pad stack' }, h('h3', {}, 'İçerik Editörü'), h('div', { class: 'hint' }, 'WordPress benzeri görsel editör: biçimlendirmeyi araç çubuğundan yapın, görselleri medya kütüphanesinden ekleyin. İçerik Markdown olarak saklanır; isterseniz "Kaynak" düğmesiyle ham Markdown içeriğini düzenleyebilirsiniz.'), bodyEd.el)),
    h('div', { class: 'savebar' }, saveBtn, status, h('span', { class: 'grow' }),
      !isNew && k !== 'yasal' ? h('a', { class: 'btn ghost', href: K.site(slug), target: '_blank', rel: 'noopener' }, icon('external', 15), 'Sitede aç (yayınlandıysa)') : null,
      h('a', { class: 'btn ghost', href: `#${K.path}` }, 'Listeye dön')));
};

void slugify;
