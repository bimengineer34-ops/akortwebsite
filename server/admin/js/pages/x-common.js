// Genişletme sayfaları için ortak parçalar (referans düzeni: sayfa başlığı + tarih hapı, sekmeler, boş durum vb.)
import { h, icon } from '../ui.js';

/** Sayfalar arası paylaşılan zaman aralığı (7/30/90 gün) */
export const getRange = () => {
  try { const n = Number(sessionStorage.getItem('akort-kpi-range')); return [7, 30, 90].includes(n) ? n : 30; } catch { return 30; }
};
export const setRange = (n) => { try { sessionStorage.setItem('akort-kpi-range', String(n)); } catch { /* */ } };
const fmtD = (d) => d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' });

/** Referanstaki sağ üst "Son 30 gün · 10 Mar 2025 - 8 Nis 2025" hapı */
export const datePill = (onChange) => {
  const n = getRange();
  const to = new Date(), from = new Date(Date.now() - (n - 1) * 86_400_000);
  const menu = h('div', { class: 'menu hidden' }, [7, 30, 90].map((v) => h('button', { 'aria-current': String(v === n), onclick: (e) => { e.stopPropagation(); setRange(v); menu.classList.add('hidden'); onChange?.(v); } }, `Son ${v} gün`)));
  const pill = h('button', { class: 'datepill', 'aria-haspopup': 'true', onclick: (e) => { e.stopPropagation(); menu.classList.toggle('hidden'); } },
    icon('calendar', 20), h('div', {}, h('b', {}, `Son ${n} gün`), h('span', {}, `${fmtD(from)} - ${fmtD(to)}`)), icon('down', 14), menu);
  document.addEventListener('click', () => menu.classList.add('hidden'), { once: true });
  return pill;
};

/**
 * Sayfa başlığı. Seçenekler (düz nesne): { crumbs: 'Social Studio › Genel Bakış', range: true, onRange }. Diğer argümanlar eylem düğmeleridir.
 */
export const pageHead = (title, lead, ...rest) => {
  const opts = rest.find((x) => x && !(x instanceof Node)) ?? {};
  const actions = rest.filter((x) => x instanceof Node);
  return h('div', { class: 'phead' },
    h('div', { class: 'grow' }, opts.crumbs ? h('div', { class: 'crumbs' }, opts.crumbs) : null, h('h1', {}, title), lead ? h('p', {}, lead) : null),
    ...actions, opts.range ? datePill(opts.onRange) : null);
};

export const tabs = (items, initial, onSelect) => {
  const el = h('div', { class: 'tabs', role: 'tablist' });
  let cur = initial;
  const draw = () => el.replaceChildren(...items.map(([k, label]) => h('button', { role: 'tab', 'aria-selected': String(k === cur), onclick: () => { cur = k; draw(); onSelect(k); } }, label)));
  draw();
  return el;
};

export const stat = (value, label, cls = '') => h('div', { class: `card stat ${cls}` }, h('b', {}, String(value)), h('span', {}, label));

export const needConn = (text) => h('div', { class: 'banner warn' }, icon('alert'), h('div', {}, h('b', {}, 'Bağlantı gerekli. '), text));

export const infoBox = (text, kind = 'info') => h('div', { class: `banner ${kind}` }, icon(kind === 'ok' ? 'check' : kind === 'info' ? 'eye' : 'alert'), h('div', {}, text));

export const scoreChip = (n) => h('span', { class: `chip ${n >= 85 ? 'ok' : n >= 60 ? 'warn' : 'danger'}` }, `${n}`);

export const fmtLocal = (s) => (s ? String(s).replace('T', ' ').slice(0, 16) : '—');

export const empty = (t) => h('div', { class: 'empty' }, t);

/** Bağlı olmayan veri kaynağı için panel içi yer tutucu (sahte grafik yok) */
export const connectBox = (title, text, to = '/entegrasyonlar') =>
  h('div', { class: 'connect-box' }, h('div', { class: 'cb-ic' }, icon('plug', 22)), h('b', {}, title), h('p', {}, text), h('a', { class: 'btn secondary sm', href: `#${to}` }, 'Bağlantıyı kur'));
