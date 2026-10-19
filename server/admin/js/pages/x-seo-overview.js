// SEO Analizi — referans düzeni: KPI şeridi, performans grafiği, teknik sağlık, canlı fırsatlar, dizin/site haritası, schema, Google önizleme, en çok görüntülenen sayfalar.
// Yalnızca GERÇEK veriler; Google Arama Konsolu bağlı değilse ilgili kartlar "Bağlantı gerekli" gösterir.
import { api } from '../api.js';
import { h, icon, chip, spinner, errorBanner } from '../ui.js';
import { kpiCard, areaChart, donut, panel, fmtNum } from '../charts.js';
import { pageHead, connectBox, getRange } from './x-common.js';

const dot = (c) => h('i', { class: 'dotc', style: `background:${c}` });
const check = () => h('span', { class: 'okmark' }, icon('check', 14));

export const renderSeo = async (ctx) => {
  ctx.setTitle('SEO Analizi');
  const root = h('div');
  const load = async () => {
    root.replaceChildren(spinner('Site taranıyor…'));
    try {
      const d = await api.get(`/x/seo/ozet?gun=${getRange()}`);
      const k = d.kpi, hl = d.health;
      const kpis = h('div', { class: 'kpis' },
        kpiCard({ ic: 'eye', label: 'Organik Tıklamalar', to: '/entegrasyonlar', connect: true, color: '#0b7bd6' }),
        kpiCard({ ic: 'chart', label: 'Gösterimler', to: '/entegrasyonlar', connect: true, color: '#8b5cf6' }),
        kpiCard({ ic: 'chart2', label: 'Ortalama Sıra', to: '/entegrasyonlar', connect: true, color: '#12b76a' }),
        kpiCard({ ic: 'doc', label: 'Site Haritasındaki Sayfalar', scroll: 'Dizin ve Site Haritası Durumu', value: k.indexed, delta: null, deltaLabel: `${k.pages} sayfa tarandı · ${k.excluded} dizin dışı`, color: '#0b7bd6', series: [], to: '/seo' }));

      const perf = panel('Site Ziyareti (son ' + d.range + ' gün)', h('div', {},
        areaChart({ labels: d.labels, series: [{ name: 'Sayfa görüntüleme', color: '#0b7bd6', values: k.visitSeries }], height: 250 }),
        h('div', { class: 'small muted', style: 'margin-top:6px' }, 'Arama performansı (tıklama/gösterim) Google Arama Konsolu bağlantısı gerektirir; şimdilik çerezsiz site sayacı gösteriliyor.')),
        { ic: 'chart', action: chip(k.visitsDelta === null ? 'Karşılaştırma yok' : `${k.visitsDelta >= 0 ? '↗' : '↘'} %${Math.abs(Math.round(k.visitsDelta))}`, k.visitsDelta >= 0 ? 'ok' : 'danger') });

      const ring = donut({ items: [{ label: 'Puan', value: hl.score, color: hl.score >= 85 ? '#12b76a' : hl.score >= 60 ? '#f79009' : '#f04438' }, { label: 'Eksik', value: 100 - hl.score, color: '#e6edf5' }], center: String(hl.score), sub: '/100', size: 150 });
      ring.querySelector('.donut-legend')?.remove();
      const health = panel('Teknik SEO Sağlığı', h('div', { class: 'row', style: 'gap:18px;align-items:center' }, ring, h('div', { class: 'grow' },
        h('div', { class: 'stat-row' }, dot('#f04438'), h('span', { class: 'grow' }, 'Kritik Hata'), h('b', {}, hl.critical)),
        h('div', { class: 'stat-row' }, dot('#f79009'), h('span', { class: 'grow' }, 'Önemli Uyarı'), h('b', {}, hl.important)),
        h('div', { class: 'stat-row' }, dot('#0b7bd6'), h('span', { class: 'grow' }, 'İyileştirme Önerisi'), h('b', {}, hl.improve)),
        h('div', { class: 'stat-row' }, dot('#12b76a'), h('span', { class: 'grow' }, 'Başarılı Kontrol'), h('b', {}, fmtNum(hl.passed))))),
        { ic: 'shield', action: chip(hl.critical ? 'Dikkat' : 'Sağlıklı', hl.critical ? 'danger' : 'ok') });
      const healthFull = h('div', {}, health.cloneNode ? health : health);

      const opps = panel('Canlı SEO Fırsatları', d.opportunities.length
        ? h('div', {}, d.opportunities.map((o) => h('a', { class: 'listrow', href: `#${o.to}`, style: `--kc:${o.color}` }, h('span', { class: 'lic' }, icon(o.icon, 18)), h('div', { class: 'grow' }, h('b', {}, o.title), h('span', {}, o.sub)), icon('chevron', 16))))
        : h('div', { class: 'empty' }, 'Şu an açık fırsat yok — harika!'), { ic: 'spark', action: chip(`${d.opportunities.length} yeni`, 'info') });

      const sm = d.sitemap;
      const index = panel('Dizin ve Site Haritası Durumu', h('div', {},
        h('div', { class: 'stat-row' }, icon('doc', 18), h('span', { class: 'grow' }, 'Site haritasındaki sayfa'), h('b', {}, sm.urls)),
        h('div', { class: 'stat-row' }, icon('x', 18), h('span', { class: 'grow' }, 'Hariç tutulan (dizin dışı)'), h('b', {}, sm.excluded)),
        h('div', { class: 'stat-row' }, icon('share', 18), h('span', { class: 'grow' }, 'Site haritası durumu'), chip(sm.notInSitemap || sm.orphans ? `${sm.notInSitemap + sm.orphans} uyuşmazlık` : 'Başarılı', sm.notInSitemap || sm.orphans ? 'warn' : 'ok')),
        h('div', { class: 'stat-row' }, icon('edit', 18), h('span', { class: 'grow' }, 'robots.txt'), chip(sm.robots.present ? 'Aktif' : 'Yok', sm.robots.present ? 'ok' : 'danger')),
        h('div', { class: 'stat-row' }, icon('shield', 18), h('span', { class: 'grow' }, '/yonetim robots ile engelli'), chip(sm.robots.adminBlocked ? 'Evet' : 'Hayır', sm.robots.adminBlocked ? 'ok' : 'warn')),
        h('div', { class: 'stat-row' }, icon('search', 18), h('span', { class: 'grow' }, 'Google\'da dizinlenen sayfa'), chip('Google Arama Konsolu gerekli', 'warn'))), { ic: 'doc' });

      const sc = d.schema;
      const rowS = (label, val) => h('div', { class: 'stat-row' }, icon('grid', 18), h('span', { class: 'grow' }, label), check(), h('span', { class: 'muted small' }, val));
      const schema = panel('Schema ve Görsel SEO', h('div', {},
        rowS('Yapılandırılmış veri (Schema)', `${sc.typeKinds} tür aktif`),
        rowS('Hizmet şeması', `${sc.typeCount.Service ?? 0} sayfa`),
        rowS('SSS şeması', `${sc.typeCount.FAQPage ?? 0} sayfa`),
        rowS('Kurum şeması', sc.typeCount.Organization ? 'Aktif' : 'Yok'),
        rowS('Gezinti yolu şeması', `${sc.typeCount.BreadcrumbList ?? 0}/${sc.pages} sayfa`),
        rowS('Görsel alt metinleri', `%${sc.altPct} tanımlı`),
        sc.modernPct !== null ? rowS('Modern görsel biçimi (WebP/AVIF)', `%${sc.modernPct}`) : null), { ic: 'grid' });

      const sp = d.serp;
      const host = (d.siteUrl || location.origin).replace(/^https?:\/\//, '');
      const serp = panel('Google Önizleme', sp
        ? h('div', { class: 'serp' }, h('div', { class: 'serp-url' }, h('span', { class: 'serp-fav' }, 'A'), h('div', {}, h('b', {}, host), h('div', {}, `${host} › ${sp.url === '/' ? 'ana sayfa' : sp.url.slice(1)}`))),
          h('div', { class: 'serp-title' }, sp.title), h('div', { class: 'serp-desc' }, sp.description || 'Arama açıklaması yok'),
          h('div', { class: 'small muted', style: 'margin-top:8px' }, 'Tahmini görünüm; gerçek sonuç Google tarafından belirlenir.'))
        : h('div', { class: 'empty' }, 'Derlenmiş site yok'), { ic: 'search', action: h('a', { class: 'tb-btn', style: 'width:32px;height:32px', href: '#/seo/editor', title: 'Canlı SEO editörü' }, icon('external', 14)) });

      const top = panel('En Çok Görüntülenen Sayfalar', d.topPages.length
        ? h('div', { class: 'tbl-wrap' }, h('table', { class: 'tbl' }, h('thead', {}, h('tr', {}, ['#', 'Sayfa', 'URL', 'Görüntüleme', 'Pay', 'Teknik puan'].map((x) => h('th', {}, x)))),
          h('tbody', {}, d.topPages.map((p, i) => h('tr', {}, h('td', {}, i + 1), h('td', {}, h('b', {}, p.title)), h('td', { class: 'mono muted' }, p.path), h('td', {}, h('b', {}, fmtNum(p.views))),
            h('td', { style: 'min-width:140px' }, h('div', { class: 'progress-bar' }, h('i', { style: `width:${p.pct}%;background:#0b7bd6` }))), h('td', {}, p.score === null ? '—' : chip(String(p.score), p.score >= 85 ? 'ok' : p.score >= 60 ? 'warn' : 'danger')))))))
        : connectBox('Henüz ziyaret verisi yok', 'Çerezsiz sayaç siteyi gezdikçe dolar. Arama tıklamaları için Google Arama Konsolu bağlayın.'), { ic: 'chart2', action: h('a', { class: 'btn secondary sm', href: '#/istatistik' }, 'Tüm Sayfalar') });

      root.replaceChildren(
        pageHead('SEO Analizi', 'Organik büyüme, indeksleme ve arama performansınızı tek yerden yönetin.', { range: true, onRange: load }),
        kpis,
        h('div', { class: 'dash-grid' },
          h('div', { class: 'span-5' }, perf), h('div', { class: 'span-3' }, healthFull), h('div', { class: 'span-4' }, opps),
          h('div', { class: 'span-4' }, index), h('div', { class: 'span-4' }, schema), h('div', { class: 'span-4' }, serp),
          h('div', { class: 'span-12' }, top)),
        h('div', { class: 'small muted', style: 'margin-top:14px' }, 'Bu skorlar açıklanabilir teknik kontrollerdir; Google sıralama skoru DEĞİLDİR.'));
    } catch (e) { root.replaceChildren(errorBanner(e)); }
  };
  load();
  return root;
};
