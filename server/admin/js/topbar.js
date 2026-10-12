// Üst çubuk: genel arama (Ctrl+K), tema düğmesi, bildirim zili, yayın düğmesi, kullanıcı kartı
import { api } from './api.js';
import { h, icon, debounce } from './ui.js';

const PAGES = [
  ['Pano', '/'], ['Sayfa metinleri', '/icerik'], ['Blog yazıları', '/blog'], ['Projeler', '/projeler'], ['Yasal metinler', '/yasal'], ['Medya kütüphanesi', '/medya'],
  ['Doğrulama bekleyenler', '/dogrulama'], ['Form talepleri', '/formlar'], ['Bülten aboneleri', '/aboneler'], ['Ziyaret istatistikleri', '/istatistik'],
  ['SEO Intelligence', '/seo'], ['AI İçerik Stüdyosu', '/ai'], ['Social Studio', '/sosyal'], ['Market & Media', '/pazar'], ['Competitor Intelligence', '/rakipler'],
  ['Backlink Intelligence', '/backlink'], ['Yayınla ve geçmiş', '/yayin'], ['Yönlendirmeler', '/yonlendirmeler'], ['Kullanıcılar', '/kullanicilar'],
  ['Etkinlik günlüğü', '/gunluk'], ['Yedekler', '/yedekler'], ['Entegrasyonlar ve API', '/entegrasyonlar'], ['Ayarlar', '/ayarlar'], ['Hesabım', '/hesabim'],
].map(([t, to]) => ({ t, to, k: 'Sayfa' }));

let corpus = null;
const loadCorpus = async () => {
  if (corpus) return corpus;
  corpus = [...PAGES];
  try {
    const [docs, blog, proj] = await Promise.all([api.get('/icerik'), api.get('/girdi/blog'), api.get('/girdi/projects')]);
    for (const d of docs.docs ?? []) corpus.push({ t: `${d.group}: ${d.label}`, to: `/icerik/${d.key}`, k: 'Sayfa metni' });
    for (const e of blog.rows ?? []) corpus.push({ t: e.title, to: `/blog/${e.slug}`, k: 'Blog' });
    for (const e of proj.rows ?? []) corpus.push({ t: e.title, to: `/projeler/${e.slug}`, k: 'Proje' });
  } catch { /* yalnızca sayfalar */ }
  return corpus;
};
const fold = (s) => String(s).toLocaleLowerCase('tr').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ı/g, 'i');

export const buildTopbar = ({ user, onMenu, publishBtn }) => {
  const input = h('input', { type: 'search', placeholder: 'Her şeyde ara…', 'aria-label': 'Genel arama', autocomplete: 'off' });
  const res = h('div', { class: 'gsearch-res hidden', role: 'listbox' });
  let items = [], idx = -1;
  const go = (to) => { location.hash = `#${to}`; input.value = ''; res.classList.add('hidden'); input.blur(); };
  const draw = () => {
    res.replaceChildren(...items.map((it, i) => h('a', { href: `#${it.to}`, class: i === idx ? 'on' : '', onclick: (e) => { e.preventDefault(); go(it.to); } }, it.t, h('small', {}, it.k))));
    res.classList.toggle('hidden', !items.length);
  };
  const search = debounce(async () => {
    const q = fold(input.value.trim());
    if (!q) { items = []; return draw(); }
    const c = await loadCorpus();
    items = c.filter((x) => fold(x.t).includes(q)).slice(0, 9);
    idx = items.length ? 0 : -1;
    draw();
  }, 120);
  input.addEventListener('input', search);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') { idx = Math.min(items.length - 1, idx + 1); draw(); e.preventDefault(); }
    else if (e.key === 'ArrowUp') { idx = Math.max(0, idx - 1); draw(); e.preventDefault(); }
    else if (e.key === 'Enter' && items[idx]) go(items[idx].to);
    else if (e.key === 'Escape') { res.classList.add('hidden'); input.blur(); }
  });
  input.addEventListener('blur', () => setTimeout(() => res.classList.add('hidden'), 150));
  input.addEventListener('focus', () => { loadCorpus(); if (items.length) res.classList.remove('hidden'); });
  document.addEventListener('keydown', (e) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); input.focus(); input.select(); } });

  const themeBtn = h('button', { class: 'tb-btn', 'aria-label': 'Tema değiştir', title: 'Koyu / açık tema', onclick: () => {
    const next = document.documentElement.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', next);
    try { localStorage.setItem('akort-theme', next); } catch { /* özel pencere */ }
  } }, icon('eye', 18));
  const dot = h('span', { class: 'dot hidden' });
  const bell = h('a', { class: 'tb-btn', href: '#/formlar', 'aria-label': 'Yeni form talepleri', title: 'Yeni form talepleri' }, icon('mail', 18), dot);
  const initials = (user.name || user.email).split(/\s+/).map((p) => p[0]).slice(0, 2).join('').toUpperCase();
  const el = h('header', { class: 'topbar' },
    h('button', { class: 'btn ghost icon menu-btn', 'aria-label': 'Menü', onclick: onMenu }, icon('menu')),
    h('div', { class: 'gsearch' }, h('span', { class: 'ic' }, icon('search', 16)), input, h('kbd', {}, 'Ctrl K'), res),
    h('div', { class: 'grow' }), themeBtn, bell, publishBtn,
    h('a', { class: 'userchip', href: '#/hesabim', title: 'Hesabım' }, h('span', { class: 'av' }, initials), h('div', {}, h('b', {}, user.name), h('span', {}, user.role === 'admin' ? 'Yönetici' : 'Editör'))));
  return { el, setBell: (n) => dot.classList.toggle('hidden', !n) };
};
