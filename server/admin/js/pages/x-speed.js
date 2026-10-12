// Speed Engine — referans düzeni. PageSpeed Insights çalıştırmaları + yerel ağırlık analizi; olmayan veri uydurulmaz.
import { api, session } from '../api.js';
import { h, icon, chip, toast, spinner, errorBanner, field, modal, confirmBox, fmtDate } from '../ui.js';
import { kpiCard, areaChart, panel, fmtNum } from '../charts.js';
import { pageHead, connectBox, getRange, empty } from './x-common.js';

const kb = (n) => (n >= 1024 ? `${(n / 1024).toFixed(1)} MB` : `${n} KB`);
const tone = (v, good, mid) => (v <= good ? 'ok' : v <= mid ? 'warn' : 'danger');

const runTest = (defUrl, done) => {
  const url = h('input', { class: 'input', value: defUrl, placeholder: 'https://www.alanadiniz.com' });
  const body = h('div', { class: 'stack' }, h('div', { class: 'banner info' }, icon('eye'), h('div', {}, 'Google PageSpeed Insights herkese açık bir adresi test eder (yerel adresler test edilemez). Mobil ve masaüstü sırayla çalıştırılır; her biri ~20–40 sn sürebilir.')), field('Test edilecek adres', url));
  const m = modal({ title: 'Web sitesini test et', body, actions: [{ label: 'Vazgeç', class: 'secondary' }, { label: 'Testi başlat', close: false, onClick: async () => {
    body.replaceChildren(spinner('Mobil test çalışıyor…'));
    try {
      await api.post('/x/hiz/test', { url: url.value, strategy: 'mobile' });
      body.replaceChildren(spinner('Masaüstü test çalışıyor…'));
      await api.post('/x/hiz/test', { url: url.value, strategy: 'desktop' });
      toast('Test tamamlandı', 'ok'); m.close(); done();
    } catch (e) { m.close(); toast(e.message, 'err'); }
    return false;
  } }] });
};

export const renderSpeed = async (ctx) => {
  ctx.setTitle('Speed Engine');
  const root = h('div');
  const load = async () => {
    root.replaceChildren(spinner());
    try {
      const d = await api.get(`/x/hiz?gun=${getRange()}`);
      const L = d.local, P = d.psi, lm = P.latest.mobile, ld = P.latest.desktop, fm = P.first.mobile, fd = P.first.desktop;
      const delta = (c, f, inv = false) => (c && f && f !== c ? (inv ? ((f - c) / f) * 100 : ((c - f) / f) * 100) : null);
      const hasPsi = !!(lm || ld);
      const kpis = hasPsi
        ? h('div', { class: 'kpis' },
          kpiCard({ ic: 'chart', label: 'Mobil Performans', scroll: 'Site Performans Trendi', value: lm?.perf ?? '—', delta: delta(lm?.perf, fm?.perf), color: '#12b76a', series: P.runs.filter((r) => r.strategy === 'mobile').map((r) => r.perf) }),
          kpiCard({ ic: 'grid', label: 'Masaüstü Performans', scroll: 'Site Performans Trendi', value: ld?.perf ?? '—', delta: delta(ld?.perf, fd?.perf), color: '#0b7bd6', series: P.runs.filter((r) => r.strategy === 'desktop').map((r) => r.perf) }),
          kpiCard({ ic: 'bolt', label: 'LCP (Largest Contentful Paint)', scroll: 'Site Performans Trendi', value: lm?.lcp ? (lm.lcp / 1000).toFixed(1) : '—', unit: 'sn', delta: delta(lm?.lcp, fm?.lcp, true), goodUp: true, color: '#8b5cf6', series: P.runs.filter((r) => r.strategy === 'mobile').map((r) => r.lcp ?? 0) }),
          kpiCard({ ic: 'eye', scroll: 'Site Performans Trendi', label: lm?.inp ? 'INP (alan verisi)' : 'TBT (INP yerine, laboratuvar)', value: lm?.inp ?? (lm?.tbt ? Math.round(lm.tbt) : '—'), unit: 'ms', color: '#0b7bd6', series: P.runs.filter((r) => r.strategy === 'mobile').map((r) => r.tbt ?? 0) }),
          kpiCard({ ic: 'doc', label: 'CLS (Cumulative Layout Shift)', scroll: 'Site Performans Trendi', value: lm?.cls !== null && lm?.cls !== undefined ? Number(lm.cls).toFixed(2) : '—', color: '#f79009', series: P.runs.filter((r) => r.strategy === 'mobile').map((r) => r.cls ?? 0) }))
        : h('div', { class: 'kpis' },
          kpiCard({ ic: 'doc', label: 'Ortalama HTML boyutu', scroll: 'Sayfa Ağırlığı (yerel ölçüm)', value: L.html.avgKb, unit: 'KB', color: '#0b7bd6', deltaLabel: `${L.html.count} sayfa` }),
          kpiCard({ ic: 'bolt', label: 'JavaScript toplamı', scroll: 'Kritik İyileştirme Önerileri', value: kb(L.js.totalKb), color: '#f79009', deltaLabel: `${L.js.count} dosya` }),
          kpiCard({ ic: 'edit', label: 'CSS toplamı', scroll: 'Kritik İyileştirme Önerileri', value: kb(L.css.totalKb), color: '#8b5cf6', deltaLabel: `${L.css.count} dosya` }),
          kpiCard({ ic: 'image', label: 'Görsel toplamı', scroll: 'Kritik İyileştirme Önerileri', value: kb(L.images.totalKb), color: '#12b76a', deltaLabel: `${L.images.count} dosya` }),
          kpiCard({ ic: 'check', label: 'Modern görsel oranı (WebP/AVIF)', scroll: 'Kritik İyileştirme Önerileri', value: L.images.count ? Math.round((L.images.modern / L.images.count) * 100) : 0, unit: '%', color: '#06b6d4', target: 90 }));

      const trend = panel('Site Performans Trendi', P.runs.length >= 2
        ? areaChart({ labels: P.runs.filter((r) => r.strategy === 'mobile').map((r) => r.ts.slice(5, 10).replace('-', '/')), series: [{ name: 'Mobil Skor', color: '#12b76a', values: P.runs.filter((r) => r.strategy === 'mobile').map((r) => r.perf) }, { name: 'Masaüstü Skor', color: '#0b7bd6', values: P.runs.filter((r) => r.strategy === 'desktop').map((r) => r.perf).slice(-P.runs.filter((r) => r.strategy === 'mobile').length) }], height: 250 })
        : connectBox('Trend için en az 2 test gerekli', 'Sağdaki "Web Sitesini Test Et" ile PageSpeed testi çalıştırın; her test bu grafiğe bir nokta ekler.', '/hiz'), { ic: 'chart' });

      const opt = (label, sub, st, kind) => h('div', { class: 'listrow' }, h('span', { class: 'lic', style: '--kc:#0b7bd6' }, icon('check', 16)), h('div', { class: 'grow' }, h('b', {}, label), h('span', {}, sub)), chip(st, kind));
      const ctrl = panel('Optimizasyon Kontrolleri', h('div', {},
        opt('Lazy Load (Görsel Yükleme)', 'Görseller ihtiyaç halinde yüklenir', d.lazyPct === null ? '—' : `%${d.lazyPct} görselde`, d.lazyPct >= 60 ? 'ok' : 'warn'),
        opt('CSS Optimizasyonu', 'Derlemede minify + kritik CSS satır içi (Astro)', 'Aktif', 'ok'),
        opt('JavaScript Erteleme', 'Betikler type=module (varsayılan ertelenir)', 'Aktif', 'ok'),
        opt('Görsel Sıkıştırma', 'WebP/AVIF dönüşümü (Astro + sharp)', L.images.count ? `%${Math.round((L.images.modern / L.images.count) * 100)} modern` : '—', 'ok'),
        opt('CDN (İçerik Dağıtım Ağı)', L.cdn.reason, 'Bağlı değil', 'warn'),
        h('div', { class: 'listrow' }, h('span', { class: 'lic', style: '--kc:#0b7bd6' }, icon('archive', 16)), h('div', { class: 'grow' }, h('b', {}, 'Veritabanı Temizliği'), h('span', {}, d.caches.lastPrune ? `Son temizlik: ${fmtDate(d.caches.lastPrune)}` : 'Süresi dolmuş oturum/eski kayıtları temizler')),
          session.user.role === 'admin' ? h('button', { class: 'btn secondary sm', onclick: async (e) => { e.target.disabled = true; try { const r = await api.post('/x/hiz/veritabani-temizle'); toast(`Temizlendi: ${r.sessions} oturum, ${r.loginAttempts} giriş kaydı, ${r.jobs} iş`, 'ok'); load(); } catch (er) { toast(er.message, 'err'); e.target.disabled = false; } } }, 'Şimdi temizle') : null)), { ic: 'gear' });

      const tile = (cls, ic, t, s, fn) => h('button', { class: `qtile ${cls}`, onclick: fn }, icon(ic, 22), h('div', { class: 'grow' }, h('b', {}, t), h('span', {}, s)), icon('chevron', 16));
      const quick = panel('Hızlı İşlemler', h('div', { class: 'stack' },
        tile('red', 'trash', 'Önbelleği Temizle', 'Sunucudaki gzip önbelleği boşaltılır', async () => { if (session.user.role !== 'admin') return toast('Yönetici yetkisi gerekir', 'err'); const r = await api.post('/x/hiz/onbellek-temizle'); toast(`Önbellek temizlendi (${r.cleared} giriş)`, 'ok'); load(); }),
        tile('blue', 'history', 'Varlıkları Yeniden Oluştur', 'Siteyi baştan derler (CSS, JS, görseller)', async () => { if (!(await confirmBox({ title: 'Site yeniden derlensin mi?', message: 'Yayınlanmamış taslaklar etkilenmez. Birkaç dakika sürebilir.', confirmLabel: 'Derle' }))) return; try { await api.post('/yeniden-derle'); toast('Derleme başlatıldı — Workflow Automation sayfasından izleyin', 'ok'); } catch (e) { toast(e.message, 'err'); } }),
        tile('green', 'rocket', 'Web Sitesini Test Et', 'Google PageSpeed Insights ile analiz et', () => runTest((d.siteUrl ?? '') || location.origin, load))), { ic: 'bolt' });

      const cacheSt = panel('Önbellek Durumu', h('div', {},
        h('div', { class: 'stat-row' }, h('span', { class: 'grow' }, 'Sayfa önbelleği (ETag + yeniden doğrulama)'), chip('Aktif', 'ok')),
        h('div', { class: 'stat-row' }, h('span', { class: 'grow' }, 'Tarayıcı önbelleği (statik varlıklar)'), chip('Aktif', 'ok')),
        h('div', { class: 'stat-row' }, h('span', { class: 'grow' }, 'Yönetim/API yanıtları'), chip('no-store', 'ok')),
        h('div', { class: 'stat-row' }, h('span', { class: 'grow' }, 'CDN önbelleği'), chip('Bağlı değil', 'warn')),
        h('div', { class: 'stat-row' }, h('span', { class: 'grow' }, 'Son temizleme'), h('span', { class: 'small' }, d.caches.lastClear ? fmtDate(d.caches.lastClear) : '—'))), { ic: 'archive' });

      const pages = panel('Sayfa Ağırlığı (yerel ölçüm)', d.pages.length ? h('div', { class: 'tbl-wrap' }, h('table', { class: 'tbl' }, h('thead', {}, h('tr', {}, ['URL', 'HTML', 'Görsel', 'Lazy', 'Betik', 'CSS', 'Durum'].map((x) => h('th', {}, x)))),
        h('tbody', {}, d.pages.map((p) => h('tr', {}, h('td', { class: 'mono' }, p.path), h('td', {}, p.kb === null ? '—' : `${p.kb} KB`), h('td', {}, p.imgs ?? '—'), h('td', {}, p.imgs ? `${p.lazy}/${p.imgs}` : '—'), h('td', {}, p.scripts ?? '—'), h('td', {}, p.styles ?? '—'),
          h('td', {}, p.kb === null ? '—' : chip(p.kb <= 120 ? 'İyi' : p.kb <= 220 ? 'Orta' : 'Ağır', tone(p.kb, 120, 220)))))))) : empty('Henüz ziyaret verisi yok'), { ic: 'doc', action: h('span', { class: 'small muted' }, 'En çok ziyaret edilen sayfalar') });

      const ba = (label, a, b, inv) => h('div', { style: 'margin-bottom:14px' }, h('div', { class: 'small', style: 'margin-bottom:4px' }, label),
        h('div', { class: 'row', style: 'gap:8px' }, h('span', { class: 'small muted', style: 'width:42px' }, 'İlk'), h('div', { class: 'grow progress-bar' }, h('i', { style: `width:${Math.min(100, inv ? Math.max(8, 100 - a * 10) : a)}%;background:#8b5cf6` })), h('b', {}, inv ? a.toFixed(1) : a)),
        h('div', { class: 'row', style: 'gap:8px;margin-top:4px' }, h('span', { class: 'small muted', style: 'width:42px' }, 'Son'), h('div', { class: 'grow progress-bar' }, h('i', { style: `width:${Math.min(100, inv ? Math.max(8, 100 - b * 10) : b)}%;background:#12b76a` })), h('b', {}, inv ? b.toFixed(1) : b)));
      const before = panel('Optimizasyon Öncesi / Sonrası (ilk ve son test)', fm && lm && fm.id !== lm.id
        ? h('div', {}, ba('Performans Skoru (Mobil)', fm.perf, lm.perf), fd && ld ? ba('Performans Skoru (Masaüstü)', fd.perf, ld.perf) : null, fm.lcp && lm.lcp ? ba('LCP (sn) ↓ daha iyi', fm.lcp / 1000, lm.lcp / 1000, true) : null)
        : connectBox('Karşılaştırma için en az 2 test gerekli', 'Bir optimizasyondan önce ve sonra test çalıştırın; ilk ve son test burada karşılaştırılır.', '/hiz'), { ic: 'chart' });

      const recs = panel('Kritik İyileştirme Önerileri', d.recs.length ? h('div', {}, d.recs.map((r, i) => h('div', { class: 'listrow' }, h('span', { class: 'numdot', style: `--nc:${['#f04438', '#f79009', '#12b76a', '#0b7bd6', '#8b5cf6'][i % 5]}` }, String(r.n)), h('div', { class: 'grow' }, h('b', {}, r.title), h('span', {}, r.text))))) : h('div', { class: 'empty' }, 'Öneri yok — harika!'), { ic: 'spark' });

      root.replaceChildren(
        pageHead('Speed Engine', 'Web sitenizin performansını ölçün, önbelleği yönetin ve görsel/varlık ağırlığını azaltın.', { range: true, onRange: load }),
        hasPsi ? null : h('div', { class: 'banner info', style: 'margin-bottom:14px' }, icon('eye'), h('div', {}, h('b', {}, 'Core Web Vitals henüz ölçülmedi. '), 'Aşağıda derlenmiş sitenin gerçek dosya ağırlığı gösteriliyor; "Web Sitesini Test Et" ile PageSpeed (Lighthouse) skorlarını ekleyin.')),
        kpis,
        h('div', { class: 'dash-grid' }, h('div', { class: 'span-6' }, trend), h('div', { class: 'span-3' }, ctrl), h('div', { class: 'span-3' }, h('div', { class: 'stack' }, quick, cacheSt)),
          h('div', { class: 'span-5' }, pages), h('div', { class: 'span-3' }, before), h('div', { class: 'span-4' }, recs)),
        h('div', { class: 'small muted', style: 'margin-top:14px' }, 'Sentetik (laboratuvar) ve alan (CrUX) verisi ayrıdır. Alan verisi için sitenin Google\'da yeterli gerçek kullanıcı trafiği olmalıdır.'));
    } catch (e) { root.replaceChildren(errorBanner(e)); }
  };
  load();
  return root;
};
void fmtNum;
