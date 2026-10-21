// Yan menü — referans ekran görüntülerindeki sıra ve adlandırma; alt menüler etkin sayfada açılır
import { h, icon } from './ui.js';

export const NAV = [
  { to: '/', label: 'Pano', ic: 'home', exact: true },
  { to: '/icerik', label: 'Sayfalar', ic: 'doc', area: 'icerik' },
  { to: '/blog', label: 'Blog', ic: 'blog', area: 'icerik' },
  { to: '/projeler', label: 'Projeler', ic: 'project', area: 'icerik' },
  { to: '/medya', label: 'Medya Kütüphanesi', ic: 'image', area: 'medya' },
  { to: '/seo', label: 'SEO Analizi', ic: 'chart', area: 'seo', sub: [{ to: '/seo', label: 'Genel Bakış', exact: true }, { to: '/seo/editor', label: 'Canlı SEO Editörü' }] },
  { to: '/pazar', label: 'Pazar ve Medya Takibi', ic: 'radar', area: 'seo' },
  { to: '/rakipler', label: 'Rakip Analizi', ic: 'eye', area: 'seo' },
  { to: '/backlink', label: 'Geri Bağlantı Analizi', ic: 'link', area: 'seo' },
  { to: '/hiz', label: 'Hız Motoru', ic: 'bolt', area: 'seo' },
  { to: '/ai', label: 'Yapay Zekâ İçerik Stüdyosu', ic: 'spark', area: 'ai' },
  { to: '/orkestra', label: 'Yapay Zekâ Orkestrası', ic: 'radar', area: 'orkestra', orch: true, badge: 'orch', sub: [
    { to: '/orkestra', label: 'Pano', exact: true }, { to: '/orkestra/komut', label: 'Komut Merkezi' }, { to: '/orkestra/ajanlar', label: 'Ajanlar' }, { to: '/orkestra/akislar', label: 'İş Akışı Oluşturucu' },
    { to: '/orkestra/izleme', label: 'Görev İzleme' }, { to: '/orkestra/onay', label: 'Onay Merkezi' }, { to: '/orkestra/model', label: 'Model ve API' }, { to: '/orkestra/kayit', label: 'Kayıtlar & Analitik' } ] },
  { to: '/sosyal', label: 'Sosyal Medya Stüdyosu', ic: 'share', area: 'sosyal', sub: [
    { to: '/sosyal', label: 'Genel Bakış', exact: true }, { to: '/sosyal/takvim', label: 'İçerik Takvimi' }, { to: '/sosyal/onay', label: 'Onay Merkezi' },
    { to: '/sosyal/marka', label: 'Marka Seti' }, { to: '/sosyal/arsiv', label: 'İçerik Arşivi' } ] },
  { to: '/formlar', label: 'CRM / Talepler', ic: 'users', area: 'crm', crm: true, badge: 'forms', sub: [{ to: '/formlar', label: 'Form talepleri' }, { to: '/aboneler', label: 'Bülten aboneleri' }] },
  { to: '/yayin', label: 'Yayın ve Otomasyon', ic: 'rocket', area: 'yayin', badge: 'pending', sub: [{ to: '/yayin', label: 'Yayınla ve geçmiş' }, { to: '/yonlendirmeler', label: 'Yönlendirmeler' }] },
  { to: '/istatistik', label: 'İstatistikler', ic: 'chart2' },
  { to: '/entegrasyonlar', label: 'Ayarlar', ic: 'gear', sub: [
    { to: '/entegrasyonlar', label: 'Entegrasyonlar ve API' }, { to: '/dil', label: 'İngilizce Yayın (EN)' }, { to: '/ayarlar', label: 'E-posta ayarları', admin: true }, { to: '/yasal', label: 'Yasal metinler' },
    { to: '/dogrulama', label: 'Doğrulama bekleyenler', badge: 'verify' }, { to: '/kullanicilar', label: 'Kullanıcılar', admin: true }, { to: '/gunluk', label: 'Etkinlik günlüğü', admin: true },
    { to: '/yedekler', label: 'Yedekler', admin: true } ] },
];

/** Kullanıcı bu alanda yazabilir mi? (sunucudaki rbac.mjs ile aynı kaynak: /durum → user.areas) */
export const canWrite = (user, area) => !!user?.areas && (user.areas.includes('*') || user.areas.includes(area));
/** Yol → alan (salt okunur uyarısı için) */
export const areaOfPath = (path) => { const t = path.split('/')[1] ?? ''; return ({ icerik: 'icerik', blog: 'icerik', projeler: 'icerik', yasal: 'icerik', medya: 'medya', seo: 'seo', pazar: 'seo', rakipler: 'seo', backlink: 'seo', hiz: 'seo', ai: 'ai', sosyal: 'sosyal', formlar: 'crm', aboneler: 'crm', yayin: 'yayin', yonlendirmeler: 'icerik', dil: 'dil' })[t] ?? null; };

const matches = (path, it) => (it.exact ? path === it.to : path === it.to || path.startsWith(`${it.to}/`));

export const buildNav = (user, onNavigate) => {
  const el = h('nav', { class: 'nav', 'aria-label': 'Ana menü' });
  const entries = [];
  const badge = (b, soft) => (b ? h('span', { class: `badge${soft ? ' soft' : ''} hidden`, dataset: { badge: b } }) : null);
  for (const it of NAV) {
    if (it.admin && user.role !== 'admin') continue;
    if (it.crm && user.readCrm === false) continue; // kişisel veri: bu rol göremez
    if (it.orch && !['admin', 'editor'].includes(user.role)) continue; // Yapay Zekâ Orkestrası görevleri yalnızca yönetici/editör
    const subs = (it.sub ?? []).filter((s) => !s.admin || user.role === 'admin');
    const a = h('a', { href: `#${subs.length ? subs[0].to : it.to}`, class: 'nav-item', onclick: onNavigate }, icon(it.ic), h('span', {}, it.label), badge(it.badge), (it.area && !canWrite(user, it.area)) ? h('span', { class: 'ro-tag', title: 'Bu alanda yalnızca görüntüleyebilirsiniz' }, 'salt okunur') : null, subs.length ? h('span', { class: 'chev' }, icon('down', 14)) : null);
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
