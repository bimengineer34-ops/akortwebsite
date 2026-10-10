// Medya kütüphanesi (sayfa) ve seçici (modal)
import { api } from '../api.js';
import { h, icon, chip, fmtSize, fmtDate, debounce, toast, confirmBox, errorBanner, modal, spinner, drawer, field } from '../ui.js';

const isImage = (m) => m.mime.startsWith('image/');
const thumbUrl = (m) => {
  const v = m.variants.find((x) => x.width === 640) ?? m.variants[0];
  return v ? `/medya/${v.file}` : `/medya/${m.filename}`;
};
const thumb = (m) => h('div', { class: 'media-thumb' }, isImage(m) ? h('img', { src: thumbUrl(m), alt: m.alt || '', loading: 'lazy' }) : (m.mime === 'application/pdf' ? 'PDF' : 'MP4'));

const uploadFiles = async (files, onEach) => {
  let ok = 0;
  for (const f of files) {
    try {
      const m = await api.upload(f.name, f);
      ok++;
      onEach?.(m);
    } catch (e) {
      toast(`${f.name}: ${e.message}`, 'err');
    }
  }
  if (ok) toast(`${ok} dosya yüklendi`, 'ok');
  return ok;
};

const dropzone = (onFiles) => {
  const input = h('input', { type: 'file', multiple: true, class: 'sr-only', accept: 'image/png,image/jpeg,image/webp,image/gif,application/pdf,video/mp4', onchange: (e) => { onFiles([...e.target.files]); e.target.value = ''; } });
  const dz = h('div', { class: 'dropzone', tabindex: 0, role: 'button', 'aria-label': 'Dosya yükle',
    onclick: () => input.click(), onkeydown: (e) => (e.key === 'Enter' || e.key === ' ') && input.click(),
    ondragover: (e) => { e.preventDefault(); dz.classList.add('over'); }, ondragleave: () => dz.classList.remove('over'),
    ondrop: (e) => { e.preventDefault(); dz.classList.remove('over'); onFiles([...e.dataTransfer.files]); } },
    icon('upload', 22), h('div', {}, h('b', {}, 'Dosyaları sürükleyin'), ' veya seçmek için tıklayın'),
    h('div', { class: 'small' }, 'PNG, JPG, WEBP, GIF, PDF, MP4 · görseller otomatik optimize edilir ve SEO uyumlu dosya adı alır'), input);
  return dz;
};

const detailPanel = (m, { onChange, onDelete }) => (close) => {
  const alt = h('input', { class: 'input', value: m.alt, placeholder: 'Görselin kısa, anlamlı açıklaması (erişilebilirlik ve SEO)' });
  const title = h('input', { class: 'input', value: m.title });
  const name = h('input', { class: 'input', value: m.filename.replace(/\.[a-z0-9]+$/, '') });
  const usage = h('div', { class: 'small muted' }, 'Kullanım kontrol ediliyor…');
  api.get(`/medya/${m.id}/kullanim`).then((r) => usage.replaceChildren(r.used.length ? h('div', {}, h('b', {}, 'Kullanıldığı yerler:'), h('ul', {}, r.used.map((u) => h('li', {}, h('a', { href: `#/icerik/${u.key}`, onclick: close }, u.label)))))
    : 'Hiçbir içerik belgesinde kullanılmıyor.')).catch(() => {});
  const url = `${location.origin}/medya/${m.filename}`;
  return h('div', { class: 'stack', style: undefined },
    h('div', { class: 'card-head' }, h('h3', {}, 'Dosya ayrıntısı'), h('button', { class: 'btn ghost sm icon', 'aria-label': 'Kapat', onclick: close }, icon('x'))),
    h('div', { class: 'card-pad stack' },
      isImage(m) ? h('img', { src: `/medya/${m.filename}`, alt: m.alt, style: undefined, class: 'md-preview', width: 560 }) : h('div', { class: 'empty card' }, m.mime),
      h('div', { class: 'row wrap small muted' }, chip(m.mime), chip(fmtSize(m.size)), m.width ? chip(`${m.width}×${m.height}`) : null, `Yüklendi: ${fmtDate(m.created_at)} · ${m.user_email ?? ''}`),
      field('Adres (kopyala)', h('div', { class: 'row' }, h('input', { class: 'input mono', readOnly: true, value: `/medya/${m.filename}` }), h('button', { class: 'btn secondary sm', onclick: async () => { await navigator.clipboard?.writeText(url); toast('Adres kopyalandı', 'ok'); } }, icon('copy', 15), 'Kopyala'))),
      isImage(m) ? field('Alt metin', alt, m.alt ? null : 'Alt metin eksik — erişilebilirlik ve SEO için doldurun.') : null,
      field('Başlık', title),
      field('Dosya adı (SEO)', name, 'Küçük harf, Türkçe karaktersiz, tire ile ayrılmış önerilir; kullanımdaki bağlantılar bu değişiklikten etkilenir.'),
      usage,
      h('div', { class: 'row' },
        h('button', { class: 'btn', onclick: async () => {
          try {
            const r = await api.patch(`/medya/${m.id}`, { alt: alt.value, title: title.value, name: name.value });
            toast('Kaydedildi', 'ok');
            onChange?.(r);
            close();
          } catch (e) { toast(e.message, 'err'); }
        } }, 'Kaydet'),
        h('span', { class: 'grow' }),
        h('button', { class: 'btn danger secondary', onclick: async () => {
          if (!(await confirmBox({ title: 'Dosya silinsin mi?', message: `${m.filename} kalıcı olarak silinecek.`, confirmLabel: 'Sil', danger: true }))) return;
          try { await api.del(`/medya/${m.id}`); toast('Silindi', 'ok'); onDelete?.(); close(); } catch (e) { toast(e.message, 'err'); }
        } }, icon('trash', 16), 'Sil'))));
};

export const renderMedia = async (ctx) => {
  ctx.setTitle('Medya kütüphanesi');
  let type = '';
  const search = h('input', { class: 'input', type: 'search', placeholder: 'Dosya adı veya alt metin ara…' });
  const typeSel = h('select', { class: 'select', style: undefined, onchange: (e) => { type = e.target.value; load(); } },
    h('option', { value: '' }, 'Tüm dosyalar'), h('option', { value: 'image' }, 'Görseller'), h('option', { value: 'document' }, 'PDF / video'));
  const grid = h('div', { class: 'media-grid' });
  const info = h('div', { class: 'muted small' });
  const load = async () => {
    grid.replaceChildren(spinner());
    try {
      const r = await api.get(`/medya?ara=${encodeURIComponent(search.value)}&tur=${type}&limit=120`);
      info.textContent = `${r.total} dosya`;
      grid.replaceChildren();
      if (!r.rows.length) grid.append(h('div', { class: 'empty' }, 'Henüz dosya yok. Yukarıdaki alana görsel sürükleyin.'));
      for (const m of r.rows) {
        grid.append(h('button', { class: 'media-item', onclick: () => drawer(detailPanel(m, { onChange: load, onDelete: load })) },
          thumb(m), h('div', { class: 'meta' }, h('b', {}, m.filename), isImage(m) && !m.alt ? h('span', { class: 'miss' }, 'Alt metin eksik') : h('span', { class: 'muted' }, fmtSize(m.size)))));
      }
    } catch (e) { grid.replaceChildren(errorBanner(e)); }
  };
  search.addEventListener('input', debounce(load, 250));
  const dz = dropzone(async (files) => { dz.classList.add('over'); await uploadFiles(files); dz.classList.remove('over'); load(); });
  await load();
  return h('div', { class: 'stack' },
    h('div', { class: 'page-head' }, h('div', { class: 'grow' }, h('h1', {}, 'Medya kütüphanesi'), h('p', {}, 'Görsel, PDF ve video yükleyin; alt metin ve SEO dosya adlarını yönetin. Yüklenen görseller otomatik olarak webp varyantlarına dönüştürülür.'))),
    dz,
    h('div', { class: 'card card-pad row wrap' }, h('div', { class: 'grow' }, search), typeSel, info),
    grid);
};

/** Başka sayfalardan çağrılan medya seçici. Seçilen medya nesnesini döndürür (veya null). */
export const openMediaPicker = ({ type = '' } = {}) =>
  new Promise((resolve) => {
    let chosen = null;
    const search = h('input', { class: 'input', type: 'search', placeholder: 'Ara…' });
    const grid = h('div', { class: 'media-grid' });
    const load = async () => {
      grid.replaceChildren(spinner());
      try {
        const r = await api.get(`/medya?ara=${encodeURIComponent(search.value)}&tur=${type}&limit=120`);
        grid.replaceChildren();
        if (!r.rows.length) grid.append(h('div', { class: 'empty' }, 'Dosya yok — aşağıdan yükleyin.'));
        for (const m of r.rows) {
          const item = h('button', { class: 'media-item', type: 'button', onclick: () => { chosen = m; mdl.close(); }, ondblclick: () => { chosen = m; mdl.close(); } },
            thumb(m), h('div', { class: 'meta' }, h('b', {}, m.filename), h('span', { class: 'muted' }, fmtSize(m.size))));
          grid.append(item);
        }
      } catch (e) { grid.replaceChildren(errorBanner(e)); }
    };
    search.addEventListener('input', debounce(load, 250));
    const dz = dropzone(async (files) => { await uploadFiles(files); load(); });
    const mdl = modal({ title: 'Medya seç', wide: true, onClose: () => resolve(chosen), body: h('div', { class: 'stack' }, h('div', { class: 'row' }, h('div', { class: 'grow' }, search)), grid, dz) });
    load();
  });
