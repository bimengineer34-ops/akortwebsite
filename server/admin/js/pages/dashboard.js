import { api, session } from '../api.js';
import { h, icon, chip, fmtDate } from '../ui.js';

const statusChip = (s) => ({ yeni: chip('Yeni', 'info'), islemde: chip('İşlemde', 'warn'), yanitlandi: chip('Yanıtlandı', 'ok'), kapali: chip('Kapalı'), spam: chip('Spam', 'danger') }[s] ?? chip(s));

export const renderDashboard = async (ctx) => {
  ctx.setTitle('Pano');
  const d = await api.get('/pano');
  const pending = d.drafts.length + (d.entriesDirty ? 1 : 0);
  const stat = (to, n, label, cls = '') => h('a', { class: `card stat ${cls}`, href: `#${to}` }, h('b', {}, String(n)), h('span', {}, label));
  const lb = d.lastBuild;

  const head = h('div', { class: 'page-head' },
    h('div', { class: 'grow' }, h('h1', {}, `Merhaba, ${session.user.name.split(' ')[0]}`), h('p', {}, 'Sitenizin içeriğini, taleplerini ve yayınlarını buradan yönetin.')),
    h('a', { class: 'btn secondary', href: '/', target: '_blank', rel: 'noopener' }, icon('external', 16), 'Siteyi aç'));

  const publishBanner = pending
    ? h('div', { class: 'banner warn' }, icon('alert'),
        h('div', { class: 'grow' }, h('b', {}, `${pending} değişiklik yayın bekliyor.`), h('div', { class: 'small' }, 'Kaydedilen taslaklar siteye "Yayınla" ile yansır.')),
        h('a', { class: 'btn sm', href: '#/yayin' }, 'Yayına git'))
    : h('div', { class: 'banner ok' }, icon('check'), h('div', {}, h('b', {}, 'Her şey yayında.'), ` Son yayın: ${fmtDate(d.lastPublish)}`));

  const verifyBanner = d.unverifiedCount
    ? h('div', { class: 'banner info' }, icon('shield'),
        h('div', { class: 'grow' }, h('b', {}, `${d.unverifiedCount} alan doğrulanmayı bekliyor.`), h('div', { class: 'small' }, 'Doğrulanmamış rakam ve iddialar canlı sitede gösterilmez.')),
        h('a', { class: 'btn secondary sm', href: '#/dogrulama' }, 'Listeyi gör'))
    : null;

  const stats = h('div', { class: 'grid cols-4' },
    stat('/formlar', d.forms.fresh, 'Yeni form talebi', d.forms.fresh ? 'alert' : ''),
    stat('/aboneler', d.subscribers, 'Aktif bülten abonesi'),
    stat('/blog', d.blog.total, `Blog yazısı${d.blog.drafts ? ` (${d.blog.drafts} taslak)` : ''}`),
    stat('/projeler', d.projects.total, `Proje${d.projects.drafts ? ` (${d.projects.drafts} taslak)` : ''}`));

  const formRows = d.recentForms.map((f) =>
    h('tr', { class: `clickable${f.status === 'yeni' ? ' fresh' : ''}`, onclick: () => ctx.nav(`/formlar/${f.id}`) },
      h('td', {}, h('b', {}, f.name), h('div', { class: 'muted small' }, f.subject || f.email)),
      h('td', {}, statusChip(f.status)),
      h('td', { class: 'muted small' }, fmtDate(f.created_at))));
  const formsCard = h('div', { class: 'card' },
    h('div', { class: 'card-head' }, h('h3', {}, 'Son form talepleri'), h('a', { href: '#/formlar', class: 'small' }, 'Tümü')),
    formRows.length ? h('div', { class: 'tbl-wrap' }, h('table', { class: 'tbl' }, h('tbody', {}, formRows))) : h('div', { class: 'empty' }, 'Henüz form talebi yok.'));

  const auditRows = d.recentAudit.map((a) =>
    h('tr', {}, h('td', {}, h('b', {}, a.action), h('div', { class: 'muted small' }, `${a.user_email}${a.target ? ' · ' + a.target : ''}`)), h('td', { class: 'muted small' }, fmtDate(a.ts))));
  const auditCard = h('div', { class: 'card' },
    h('div', { class: 'card-head' }, h('h3', {}, 'Son etkinlik'), session.user.role === 'admin' ? h('a', { href: '#/gunluk', class: 'small' }, 'Tümü') : null),
    h('div', { class: 'tbl-wrap' }, h('table', { class: 'tbl' }, h('tbody', {}, auditRows))));

  const quick = h('div', { class: 'card card-pad stack' },
    h('h3', {}, 'Hızlı işlemler'),
    h('div', { class: 'row wrap' },
      h('a', { class: 'btn secondary', href: '#/blog/yeni' }, icon('plus', 16), 'Yeni blog yazısı'),
      h('a', { class: 'btn secondary', href: '#/projeler/yeni' }, icon('plus', 16), 'Yeni proje'),
      h('a', { class: 'btn secondary', href: '#/medya' }, icon('upload', 16), 'Görsel yükle'),
      h('a', { class: 'btn secondary', href: '#/icerik' }, icon('edit', 16), 'Sayfa metinleri')));

  const buildChip = lb
    ? h('span', {}, chip(lb.status === 'basarili' ? 'Başarılı' : lb.status === 'running' ? 'Sürüyor' : 'Başarısız', lb.status === 'basarili' ? 'ok' : lb.status === 'running' ? 'info' : 'danger'), ' ', fmtDate(lb.finished_at ?? lb.started_at))
    : 'henüz yok';
  const sys = h('div', { class: 'card card-pad stack' },
    h('h3', {}, 'Sistem durumu'),
    h('div', { class: 'small stack' },
      h('div', {}, 'Son yayın: ', buildChip),
      h('div', {}, `İçerik belgesi: ${d.docs} · Medya: ${d.media} dosya`),
      h('div', { class: 'muted' }, `Node ${d.node} · çalışma süresi ${Math.floor(d.uptime / 3600)} sa ${Math.floor((d.uptime % 3600) / 60)} dk`)));

  return h('div', { class: 'stack' }, head, publishBanner, verifyBanner, stats,
    h('div', { class: 'grid cols-2' }, formsCard, auditCard),
    h('div', { class: 'grid cols-2' }, quick, sys));
};
