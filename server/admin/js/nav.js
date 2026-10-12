// Yan menü — referans ekran görüntülerindeki sıra ve adlandırma; alt menüler etkin sayfada açılır
import { h, icon } from './ui.js';

export const NAV = [
  { to: '/', label: 'Dashboard', ic: 'home', exact: true },
  { to: '/icerik', label: 'Pages', ic: 'doc' },
  { to: '/blog', label: 'Blog', ic: 'blog' },
  { to: '/projeler', label: 'Projects', ic: 'project' },
  { to: '/medya', label: 'Media Library', ic: 'image' },
  { to: '/seo', label: 'SEO Intelligence', ic: 'chart', sub: [{ to: '/seo', label: 'Genel Bakış', exact: true }, { to: '/seo/editor', label: 'Canlı SEO Editörü' }] },
  { to: '/pazar', label: 'Market & Media Intelligence', ic: 'radar' },
  { to: '/rakipler', label: 'Competitor Intelligence', ic: 'eye' },
  { to: '/backlink', label: 'Backlink Intelligence', ic: 'link' },
  { to: '/hiz', label: 'Speed Engine', ic: 'bolt' },
  { to: '/ai', label: 'AI Content Studio', ic: 'spark' },
  { to: '/sosyal', label: 'Social Studio', ic: 'share', sub: [
    { to: '/sosyal', label: 'Genel Bakış', exact: true }, { to: '/sosyal/takvim', label: 'İçerik Takvimi' }, { to: '/sosyal/onay', label: 'Onay Merkezi' },
    { to: '/sosyal/marka', label: 'Brand Kit' }, { to: '/sosyal/arsiv', label: 'İçerik Arşivi' } ] },
  { to: '/formlar', label: 'CRM / Leads', ic: 'users', badge: 'forms', sub: [{ to: '/formlar', label: 'Form talepleri' }, { to: '/aboneler', label: 'Bülten aboneleri' }] },
  { to: '/yayin', label: 'Workflow Automation', ic: 'rocket', badge: 'pending', sub: [{ to: '/yayin', label: 'Yayınla ve geçmiş' }, { to: '/yonlendirmeler', label: 'Yönlendirmeler' }] },
  { to: '/istatistik', label: 'Analytics', ic: 'chart2' },
  { to: '/entegrasyonlar', label: 'Settings', ic: 'gear', sub: [
    { to: '/entegrasyonlar', label: 'Entegrasyonlar ve API' }, { to: '/dil', label: 'İngilizce Yayın (EN)' }, { to: '/ayarlar', label: 'E-posta ayarları', admin: true }, { to: '/yasal', label: 'Yasal metinler' },
    { to: '/dogrulama', label: 'Doğrulama bekleyenler', badge: 'verify' }, { to: '/kullanicilar', label: 'Kullanıcılar', admin: true }, { to: '/gunluk', label: 'Etkinlik günlüğü', admin: true },
    { to: '/yedekler', label: 'Yedekler', admin: true } ] },
];

const matches = (path, it) => (it.exact ? path === it.to : path === it.to || path.startsWith(`${it.to}/`));

export const buildNav = (user, onNavigate) => {
  const el = h('nav', { class: 'nav', 'aria-label': 'Ana menü' });
  const entries = [];
  const badge = (b, soft) => (b ? h('span', { class: `badge${soft ? ' soft' : ''} hidden`, dataset: { badge: b } }) : null);
  for (const it of NAV) {
    if (it.admin && user.role !== 'admin') continue;
    const subs = (it.sub ?? []).filter((s) => !s.admin || user.role === 'admin');
    const a = h('a', { href: `#${subs.length ? subs[0].to : it.to}`, class: 'nav-item', onclick: onNavigate }, icon(it.ic), h('span', {}, it.label), badge(it.badge), subs.length ? h('span', { class: 'chev' }, icon('down', 14)) : null);
    const box = h('div', { class: 'nav-group' }, a);
    const subLinks = subs.map((s) => {
      const sa = h('a', { href: `#${s.to}`, class: 'nav-sub', onclick: onNavigate }, h('span', {}, s.label), badge(s.badge, true));
      return { s, sa };
    });
    if (subLinks.length) box.append(h('div', { class: 'nav-subs' }, subLinks.map((x) => x.sa)));
    el.append(box);
    entries.push({ it, a, box, subLinks });
  }
  const update = (path) => {
    for (const e of entries) {
      const subOn = e.subLinks.find((x) => matches(path, x.s));
      const on = e.subLinks.length ? !!subOn || matches(path, e.it) : matches(path, e.it);
      e.a.classList.toggle('on', on);
      if (on) e.a.setAttribute('aria-current', 'page'); else e.a.removeAttribute('aria-current');
      e.box.classList.toggle('open', on && e.subLinks.length > 0);
      for (const x of e.subLinks) x.sa.classList.toggle('on', x === subOn);
    }
  };
  return { el, update };
};
