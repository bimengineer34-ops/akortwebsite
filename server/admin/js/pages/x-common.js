// Genişletme sayfaları için ortak parçalar (mevcut tasarım sistemi sınıfları kullanılır)
import { h, icon } from '../ui.js';

export const pageHead = (title, lead, ...actions) =>
  h('div', { class: 'page-head' }, h('div', { class: 'grow' }, h('h1', {}, title), lead ? h('p', {}, lead) : null), ...actions);

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
