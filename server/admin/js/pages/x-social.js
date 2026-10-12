// Social Studio — Genel Bakış, İçerik Takvimi, Onay Merkezi, Brand Kit, İçerik Arşivi (referans düzenleri).
// Platform OAuth bağlı olmadığı için erişim/etkileşim metrikleri "Bağlantı gerekli" gösterir; sahte rakam ve sahte "yayımlandı" yok.
import { api, session } from '../api.js';
import { h, icon, chip, toast, spinner, errorBanner, field, modal, fmtDate, debounce } from '../ui.js';
import { kpiCard, areaChart, donut, hbars, panel, ring, PALETTE } from '../charts.js';
import { pageHead, tabs, infoBox, empty, fmtLocal, connectBox, getRange } from './x-common.js';
import { editor, ST, stChip, setPlatforms } from './x-social-editor.js';

const PCOL = { linkedin: '#0a66c2', instagram: '#e1306c', facebook: '#1877f2', youtube: '#ff0000', x: '#111827', tiktok: '#111827', threads: '#222222', pinterest: '#e60023' };
const PSHORT = { linkedin: 'in', instagram: 'Ig', facebook: 'f', youtube: '▶', x: 'X', tiktok: 'Tk', threads: '@', pinterest: 'P' };
const pbadge = (id, size = 22) => h('span', { class: 'pbadge', style: `background:${PCOL[id] ?? '#64748b'};width:${size}px;height:${size}px;font-size:${Math.round(size * 0.5)}px` }, PSHORT[id] ?? id[0].toUpperCase());
const CATC = ['#0b7bd6', '#12b76a', '#f79009', '#8b5cf6', '#ec4899', '#06b6d4'];
const reload = () => location.reload();
const todayKey = () => new Date().toLocaleDateString('sv-SE');

/* ====================== GENEL BAKIŞ ====================== */
export const renderSocialOverview = async (ctx) => {
  ctx.setTitle('Social Studio');
  const root = h('div');
  const load = async () => {
    root.replaceChildren(spinner());
    try {
      const o = await api.get(`/x/sosyal/ozet?gun=${getRange()}`);
      setPlatforms(o.platforms);
      const k = o.kpi;
      const kpis = h('div', { class: 'kpis' },
        kpiCard({ ic: 'users', label: 'Toplam Erişim', to: '/entegrasyonlar', connect: true, color: '#0b7bd6' }),
        kpiCard({ ic: 'eye', label: 'Etkileşim Oranı', to: '/entegrasyonlar', connect: true, color: '#ec4899' }),
        kpiCard({ ic: 'share', label: 'Planlanan Paylaşımlar', value: k.planned, deltaLabel: `${k.awaiting} onay bekliyor`, series: o.perfPlanned, color: '#12b76a', to: '/sosyal/takvim' }),
        kpiCard({ ic: 'chart', label: 'Takipçi Artışı', to: '/entegrasyonlar', connect: true, color: '#8b5cf6' }));

      const accounts = panel('Bağlı Sosyal Medya Hesapları', h('div', { class: 'acc-grid' }, o.platforms.slice(0, 6).map((p) => h('div', { class: 'acc' }, h('div', { class: 'row' }, pbadge(p.id, 34), h('div', {}, h('b', {}, p.label), h('div', { class: 'small muted' }, 'hesap bağlı değil'))),
        h('a', { class: 'btn secondary sm', style: 'width:100%;margin-top:10px', href: p.url, target: '_blank', rel: 'noopener noreferrer', title: p.needs }, icon('external', 14), 'Bağlan (geliştirici konsolu)'),
        h('div', { class: 'small', style: 'margin-top:6px' }, h('a', { href: p.docs, target: '_blank', rel: 'noopener noreferrer' }, 'API belgeleri'), ' · ', h('a', { href: '#/entegrasyonlar' }, 'Durum'))))),
        { ic: 'users', action: h('a', { class: 'btn secondary sm', href: '#/entegrasyonlar' }, 'Hesap Yönetimi') });

      const cons = o.consistency;
      const brand = panel('İçerik Kalite Skoru', cons.score === null ? connectBox('Henüz içerik yok', 'İlk içeriğinizi oluşturunca görsel, hashtag, karakter sınırı ve onay disiplini kriterleri burada puanlanır.', '/sosyal/takvim')
        : h('div', { class: 'row', style: 'gap:16px;align-items:center;flex-wrap:wrap' }, ring(cons.score, { size: 130, sub: '/100' }), h('div', { class: 'grow', style: 'min-width:180px' }, cons.criteria.filter((c) => c.score !== null).map((c) => h('div', { class: 'stat-row' }, h('span', { class: 'okmark' }, icon('check', 14)), h('span', { class: 'grow' }, c.label), h('b', {}, c.score))))),
        { ic: 'shield', action: h('span', { class: 'small muted' }, 'kural tabanlı; marka sesi skoru değildir') });

      const perf = panel('İçerik Üretim ve Planlama', h('div', {}, areaChart({ labels: o.perfLabels, series: [{ name: 'Oluşturulan içerik', color: '#0b7bd6', values: o.perfCreated }, { name: 'Planlanan yayın', color: '#8b5cf6', values: o.perfPlanned }], height: 230 }), h('div', { class: 'small muted' }, 'Erişim ve etkileşim grafikleri platform hesapları bağlandığında bu panelde görünür.')), { ic: 'chart', action: chip(`Son ${o.range} gün`) });

      const up = panel('Yaklaşan Paylaşımlar', o.upcoming.length ? h('div', {}, o.upcoming.map((u) => h('button', { class: 'listrow link', onclick: async () => editor(await api.get(`/x/sosyal/gonderiler/${u.id}`), reload) }, h('span', { class: 'thumb' }, u.media ? h('img', { src: u.media, alt: '' }) : icon('image', 18)), h('div', { class: 'grow' }, h('b', {}, u.title), h('span', {}, `${fmtLocal(u.scheduled_at)}`)), h('div', { class: 'row', style: 'gap:4px' }, u.platforms.map((p) => pbadge(p, 20))), stChip(u.status)))) : h('div', { class: 'empty' }, 'Onaylı/planlı paylaşım yok.'), { ic: 'calendar', action: h('a', { class: 'small', href: '#/sosyal/takvim' }, 'Tümünü Gör') });

      const ideas = panel('Yapay Zeka İçerik Önerileri', o.ideas.length ? h('div', {}, o.ideas.map((i) => h('div', { class: 'listrow' }, h('span', { class: 'lic', style: '--kc:#8b5cf6' }, icon('spark', 18)), h('div', { class: 'grow' }, h('b', {}, `Blogdan paylaşım: ${i.title}`), h('span', {}, (i.text || '').slice(0, 90))),
        h('button', { class: 'btn sm', onclick: async () => { try { const p = await api.post(`/x/sosyal/blogdan/${i.slug}`); toast('Taslak oluşturuldu', 'ok'); editor(p, reload); } catch (e) { toast(e.message, 'err'); } } }, 'Kullan')))) : h('div', { class: 'muted small', style: 'padding:8px 0' }, 'Yayındaki tüm blog yazıları için sosyal taslak oluşturulmuş (veya blog yazısı yok).'), { ic: 'spark', action: chip(`${o.ideas.length} öneri`, 'info') });

      const special = panel('Özel Günler ve Otomasyon', h('div', {}, h('p', { class: 'small muted', style: 'margin-bottom:8px' }, 'Anahtarı açarsanız gün yaklaşınca (7 gün) otomatik TASLAK açılır. Hiçbir içerik onaysız yayımlanmaz.'),
        o.specialDays.length ? o.specialDays.map((d) => h('div', { class: 'listrow' }, h('div', { class: 'datebox' }, h('b', {}, d.date.slice(8)), h('span', {}, new Date(d.date).toLocaleDateString('tr-TR', { month: 'short' }))), h('div', { class: 'grow' }, h('b', {}, d.name), h('span', {}, `${d.inDays} gün kaldı`)),
          h('label', { class: 'switch' }, h('input', { type: 'checkbox', checked: d.auto, onchange: async (e) => { try { const r = await api.put('/x/sosyal/ozelgun', { date: d.date, enabled: e.target.checked }); toast(e.target.checked ? (r.made ? 'Taslak oluşturuldu' : 'Otomasyon açıldı') : 'Otomasyon kapatıldı', 'ok'); } catch (er) { toast(er.message, 'err'); e.target.checked = !e.target.checked; } } }), h('i')))) : empty('90 gün içinde özel gün yok.')), { ic: 'calendar', action: h('a', { class: 'small', href: '#/sosyal/takvim' }, 'Takvimi Gör') });

      const tile = (c, ic2, t, s, to) => h('a', { class: `qt ${c}`, href: `#${to}` }, icon(ic2, 22), h('div', {}, h('b', {}, t), h('span', {}, s)), icon('chevron', 16));
      const quick = panel('Hızlı İşlemler', h('div', { class: 'qgrid' },
        h('button', { class: 'qt blue', onclick: () => editor(null, reload) }, icon('edit', 22), h('div', {}, h('b', {}, 'Gönderi Oluştur'), h('span', {}, 'Metin, görsel ile yeni içerik')), icon('chevron', 16)),
        tile('purple', 'palette', 'Görsel Üret', 'Marka şablonundan görsel', '/sosyal/marka'), tile('green', 'check', 'İçeriği Onayla', `${k.awaiting} içerik bekliyor`, '/sosyal/onay'), tile('orange', 'calendar', 'Kampanya Planla', 'Takvimde çoklu paylaşım', '/sosyal/takvim')), { ic: 'bolt' });

      root.replaceChildren(pageHead('Social Studio', 'Sosyal medya planlama, yapay zeka içerik önerileri, hesap yönetimi ve onay süreçlerini tek yerden yönetin.', { range: true, onRange: load }), kpis,
        h('div', { class: 'dash-grid' }, h('div', { class: 'span-8' }, accounts), h('div', { class: 'span-4' }, brand),
          h('div', { class: 'span-8' }, perf), h('div', { class: 'span-4' }, up),
          h('div', { class: 'span-4' }, ideas), h('div', { class: 'span-4' }, special), h('div', { class: 'span-4' }, quick)),
        infoBox('Platform hesapları (OAuth) bağlı olmadığı için otomatik yayın kapalıdır; onaylı içeriği platformda kendiniz yayımlayıp "elle yayımlandı" işaretleyebilirsiniz.'));
    } catch (e) { root.replaceChildren(errorBanner(e)); }
  };
  load();
  return root;
};

/* ====================== İÇERİK TAKVİMİ ====================== */
const dayOf = (r) => String(r.scheduled_at ?? r.created_at).slice(0, 10);
const miniList = (rows) => (rows.length ? h('div', {}, rows.map((r) => h('button', { class: 'listrow link', onclick: () => editor(r, reload) }, h('div', { class: 'datebox sm' }, h('b', {}, dayOf(r).slice(8)), h('span', {}, new Date(dayOf(r)).toLocaleDateString('tr-TR', { month: 'short' }))), h('div', { class: 'grow' }, h('b', {}, r.title), h('span', {}, `${String(r.scheduled_at ?? '').slice(11, 16) || '—'} · ${r.category || 'kategorisiz'}`)), h('div', { class: 'row', style: 'gap:4px' }, r.platforms.map((p) => pbadge(p, 20))), stChip(r.status)))) : empty('Kayıt yok.'));

export const renderSocialCalendar = async (ctx) => {
  ctx.setTitle('İçerik Takvimi');
  const root = h('div', {}, spinner());
  try {
    const [rowsAll, ov] = await Promise.all([api.get('/x/sosyal/gonderiler').then((r) => r.rows), api.get('/x/sosyal/ozet?gun=30')]);
    setPlatforms(ov.platforms);
    let tab = 'takvim', cur = new Date(); cur.setDate(1);
    let selected = rowsAll.find((r) => r.scheduled_at && r.status !== 'yayimlandi') ?? rowsAll[0] ?? null;
    const body = h('div');
    const calendar = () => {
      const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const monthRows = rowsAll.filter((r) => dayOf(r).startsWith(iso(cur).slice(0, 7)));
      const cells = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'].map((x) => h('div', { class: 'cal-h' }, x));
      const offset = (cur.getDay() + 6) % 7;
      for (let i = 0; i < offset; i++) cells.push(h('div', { class: 'cal-c off' }));
      const days = new Date(cur.getFullYear(), cur.getMonth() + 1, 0).getDate();
      for (let d = 1; d <= days; d++) {
        const key = `${iso(cur).slice(0, 8)}${String(d).padStart(2, '0')}`;
        const mine = monthRows.filter((r) => dayOf(r) === key);
        cells.push(h('div', { class: `cal-c${key === todayKey() ? ' today' : ''}`, onclick: (e) => { if (e.target === e.currentTarget) editor(null, reload, { scheduled_at: `${key}T10:00` }); } }, h('div', { class: 'cal-d' }, d),
          ...mine.slice(0, 2).map((r) => h('button', { class: 'cal-ev', style: `--pc:${PCOL[r.platforms[0]] ?? '#0b7bd6'}`, onclick: () => { selected = r; draw(); } }, pbadge(r.platforms[0] ?? 'x', 16), h('span', {}, `${String(r.scheduled_at ?? '').slice(11, 16)} ${r.title}`.trim()))),
          mine.length > 2 ? h('div', { class: 'small muted' }, `+${mine.length - 2} daha`) : null));
      }
      const title = cur.toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' });
      const catCount = {};
      for (const r of monthRows) if (r.category) catCount[r.category] = (catCount[r.category] ?? 0) + 1;
      const platCount = ov.platforms.map((p) => ({ ...p, n: monthRows.filter((r) => r.platforms.includes(p.id)).length })).filter((p) => p.n);
      return h('div', { class: 'dash-grid' },
        h('div', { class: 'span-8' }, h('div', { class: 'card card-pad' },
          h('div', { class: 'row', style: 'margin-bottom:12px' }, h('button', { class: 'btn secondary sm flip', onclick: () => { cur.setMonth(cur.getMonth() - 1); draw(); } }, icon('chevron', 14)), h('h2', { class: 'grow', style: 'text-transform:capitalize' }, title), h('button', { class: 'btn secondary sm', onclick: () => { cur = new Date(); cur.setDate(1); draw(); } }, 'Bugün'), h('button', { class: 'btn secondary sm', onclick: () => { cur.setMonth(cur.getMonth() + 1); draw(); } }, icon('chevron', 14), ''), h('button', { class: 'btn', onclick: () => editor(null, reload) }, icon('plus', 16), 'Yeni İçerik')),
          h('div', { class: 'cal' }, cells),
          h('div', { class: 'row wrap', style: 'margin-top:12px;gap:14px' }, ...platCount.map((p) => h('span', { class: 'small row', style: 'gap:6px' }, pbadge(p.id, 14), `${p.label} (${p.n})`)), ...Object.entries(catCount).map(([c, n], i) => h('span', { class: 'small row', style: 'gap:6px' }, h('i', { class: 'dotc', style: `background:${CATC[i % 6]}` }), `${c} (${n})`))))),
        h('div', { class: 'span-4' }, panel('Seçilen İçerik Detayı', selected ? detail(selected) : empty('Takvimde bir içeriğe tıklayın veya yeni içerik oluşturun.'), { ic: 'doc' })));
    };
    const detail = (r) => h('div', { class: 'stack' },
      h('div', { class: 'row', style: 'gap:12px;align-items:flex-start' }, h('div', { class: 'thumb lg' }, r.media ? h('img', { src: r.media, alt: '' }) : icon('image', 28)), h('div', { class: 'grow stack', style: 'gap:6px' }, h('div', { class: 'row' }, ...r.platforms.map((p) => pbadge(p, 24)), stChip(r.status)),
        h('div', { class: 'small' }, `📅 ${fmtLocal(r.scheduled_at)}`), h('div', { class: 'small' }, `👤 Hazırlayan: ${r.created_by ?? '—'}`), h('div', { class: 'small' }, `🗂 Kategori: ${r.category || '—'}`))),
      h('div', {}, h('div', { class: 'lbl' }, 'İçerik Metni'), h('div', { class: 'ai-sum', style: 'white-space:pre-wrap' }, r.body || '—')),
      r.hashtags ? h('div', { class: 'row wrap' }, ...r.hashtags.split(/\s+/).filter(Boolean).map((t) => chip(t, 'info'))) : null,
      r.sealed ? chip('Onaylı sürüm mühürlü', 'ok') : null,
      h('div', { class: 'row wrap' }, h('button', { class: 'btn secondary', onclick: () => editor(r, reload) }, icon('edit', 16), 'Düzenle'),
        ['taslak', 'revizyon'].includes(r.status) ? h('button', { class: 'btn', onclick: async () => { try { await api.put(`/x/sosyal/gonderiler/${r.id}`, { ...r, platforms: r.platforms }); await api.post(`/x/sosyal/gonderiler/${r.id}/gecis`, { to: 'onay_bekliyor' }); toast('Onaya gönderildi', 'ok'); reload(); } catch (e) { toast(e.data?.errors?.join(' · ') || e.message, 'err'); } } }, icon('share', 16), 'Onaya Gönder') : null));
    const lists = {
      liste: () => h('div', { class: 'card card-pad' }, miniList([...rowsAll].sort((a, b) => dayOf(b).localeCompare(dayOf(a))))),
      taslak: () => h('div', { class: 'card card-pad' }, miniList(rowsAll.filter((r) => ['taslak', 'revizyon'].includes(r.status)))),
      onay: () => h('div', { class: 'card card-pad' }, miniList(rowsAll.filter((r) => r.status === 'onay_bekliyor'))),
      yayin: () => h('div', { class: 'card card-pad' }, miniList(rowsAll.filter((r) => r.status === 'yayimlandi'))),
      kategori: () => { const c = {}; for (const r of rowsAll) { const k = r.category || 'Kategorisiz'; c[k] = (c[k] ?? 0) + 1; } return panel('İçerik Kategorileri', hbars(Object.entries(c).map(([label, value]) => ({ label, value })), { color: CATC, empty: 'Henüz içerik yok' }), { ic: 'grid' }); },
    };
    const draw = () => {
      body.replaceChildren(tab === 'takvim' ? calendar() : lists[tab]());
      if (tab === 'takvim') bottom.hidden = false; else bottom.hidden = true;
    };
    const weekEnd = new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10);
    const queue = rowsAll.filter((r) => r.scheduled_at && dayOf(r) >= todayKey() && dayOf(r) <= weekEnd && r.status !== 'yayimlandi').sort((a, b) => String(a.scheduled_at).localeCompare(String(b.scheduled_at)));
    const bottom = h('div', { class: 'dash-grid', style: 'margin-top:16px' },
      h('div', { class: 'span-4' }, panel('Yaklaşan Özel Günler', ov.specialDays.length ? h('div', {}, ov.specialDays.slice(0, 4).map((d) => h('div', { class: 'listrow' }, h('div', { class: 'datebox sm' }, h('b', {}, d.date.slice(8)), h('span', {}, new Date(d.date).toLocaleDateString('tr-TR', { month: 'short' }))), h('div', { class: 'grow' }, h('b', {}, d.name), h('span', {}, `${d.inDays} gün kaldı`))))) : empty('Yakın özel gün yok'), { ic: 'calendar' })),
      h('div', { class: 'span-4' }, panel('Bu Haftanın İçerik Kuyruğu', miniList(queue.slice(0, 4)), { ic: 'doc' })),
      h('div', { class: 'span-4' }, panel('Platformlara Göre İçerik Dağılımı', donut({ items: ov.byPlatform.filter((p) => p.count).map((p) => ({ label: p.label, value: p.count, color: PCOL[p.id] })), sub: 'toplam içerik', empty: 'Henüz içerik yok' }), { ic: 'chart' })));
    root.replaceChildren(pageHead('İçerik Takvimi', 'Tüm sosyal medya içeriklerinizi planlayın, yönetin ve yayınlayın.', { crumbs: 'Social Studio › İçerik Takvimi' }),
      tabs([['takvim', 'Takvim'], ['liste', 'Liste Görünümü'], ['taslak', 'Taslaklar'], ['onay', 'Onay Bekleyenler'], ['yayin', 'Yayınlanmış İçerikler'], ['kategori', 'İçerik Kategorileri']], tab, (k) => { tab = k; draw(); }), body, bottom);
    draw();
  } catch (e) { root.replaceChildren(errorBanner(e)); }
  return root;
};

/* ====================== ONAY MERKEZİ ====================== */
export const renderSocialApproval = async (ctx) => {
  ctx.setTitle('Onay Merkezi');
  const root = h('div', {}, spinner());
  try {
    const [rows, ov] = await Promise.all([api.get('/x/sosyal/gonderiler').then((r) => r.rows), api.get('/x/sosyal/ozet?gun=30')]);
    setPlatforms(ov.platforms);
    const cols = [['taslak', 'Taslak', 'Henüz düzenlenmemiş içerikler', '#a8aaae'], ['revizyon', 'Düzenleniyor', 'Revizyon istenen içerikler', '#ec4899'], ['onay_bekliyor', 'Onay Bekliyor', 'Yönetici onayı bekleyen içerikler', '#f79009'], ['onaylandi', 'Onaylandı', 'Planlanmayı bekleyen', '#0b7bd6'], ['planlandi', 'Planlandı', 'Yayın tarihi belirlenmiş', '#06b6d4'], ['yayimlandi', 'Yayınlandı', 'Yayımlandı olarak işaretlenen', '#12b76a']];
    const strip = h('div', { class: 'kpis', style: 'grid-template-columns:repeat(auto-fit,minmax(280px,1fr))' },
      kpiCard({ ic: 'shield', label: `Onay bekleyen ${ov.kpi.awaiting} içerik`, value: ov.kpi.awaiting, deltaLabel: 'ekibinizin onayını bekliyor', color: '#f79009', to: '/sosyal/onay' }),
      kpiCard({ ic: 'share', label: 'Planlı / onaylı içerik', value: ov.kpi.planned, deltaLabel: 'yayın bekliyor', color: '#0b7bd6', to: '/sosyal/takvim' }),
      kpiCard({ ic: 'check', label: 'Yayımlanan içerik', to: '/sosyal/arsiv', value: ov.kpi.published, deltaLabel: 'elle işaretlenenler dahil', color: '#12b76a' }));
    root.replaceChildren(pageHead('Onay Merkezi', 'İçeriklerinizin onay sürecini yönetin; onaylanan metin+medya+platform+zaman SHA-256 ile mühürlenir.', { crumbs: 'Social Studio › Onay Merkezi', range: false }),
      strip, h('div', { class: 'board' }, cols.map(([key, t, sub, c]) => { const items = rows.filter((r) => r.status === key); return h('div', { class: 'bcol', style: `--bc:${c}` }, h('div', { class: 'bh' }, h('b', {}, t), h('span', {}, String(items.length))), h('div', { class: 'small muted', style: 'margin:-4px 0 4px' }, sub),
        ...items.map((r) => h('button', { class: 'bcard', onclick: () => editor(r, reload) }, r.media ? h('img', { src: r.media, alt: '' }) : null, h('b', {}, r.title), h('span', { class: 'small muted' }, `${fmtLocal(r.scheduled_at)}`), h('div', { class: 'row', style: 'gap:4px;flex-wrap:wrap' }, r.platforms.map((p) => pbadge(p, 18)), r.category ? chip(r.category, 'info') : null, r.sealed ? chip('Mühürlü', 'ok') : null), r.review_note ? h('div', { class: 'rev' }, r.review_note) : null)),
        key === 'taslak' ? h('button', { class: 'btn secondary sm', onclick: () => editor(null, reload) }, icon('plus', 14), 'Taslak İçerik Oluştur') : null); })),
      infoBox('Akış: Taslak → Onay bekliyor → Onaylandı → Planlandı → Yayımlandı. Onay yalnızca yöneticiden gelir; içerik değişirse onay düşer. Otomatik doğrudan yayın kapalıdır.'));
  } catch (e) { root.replaceChildren(errorBanner(e)); }
  return root;
};

/* ====================== İÇERİK ARŞİVİ ====================== */
export const renderSocialArchive = async (ctx) => {
  ctx.setTitle('İçerik Arşivi');
  const root = h('div', {}, spinner());
  try {
    const [rows, ov] = await Promise.all([api.get('/x/sosyal/gonderiler').then((r) => r.rows), api.get('/x/sosyal/ozet?gun=30')]);
    setPlatforms(ov.platforms);
    const search = h('input', { class: 'input', type: 'search', placeholder: 'Başlık veya metinde ara…' });
    const st = h('select', { class: 'select' }, [['', 'Tüm durumlar'], ...Object.entries(ST).map(([k, [l]]) => [k, l])].map(([v, l]) => h('option', { value: v }, l)));
    const tbody = h('tbody');
    const draw = () => {
      const q = search.value.toLocaleLowerCase('tr');
      const f = rows.filter((r) => (!st.value || r.status === st.value) && (!q || `${r.title} ${r.body}`.toLocaleLowerCase('tr').includes(q)));
      tbody.replaceChildren(...(f.length ? f.map((r) => h('tr', { class: 'clickable', onclick: () => editor(r, reload) }, h('td', {}, h('b', {}, r.title), h('div', { class: 'small muted' }, (r.body || '').slice(0, 80))), h('td', {}, h('div', { class: 'row', style: 'gap:4px' }, r.platforms.map((p) => pbadge(p, 20)))), h('td', {}, r.category || '—'), h('td', {}, fmtLocal(r.scheduled_at)), h('td', {}, stChip(r.status)), h('td', {}, r.created_by ?? '—'))) : [h('tr', {}, h('td', { colspan: 6 }, empty('Kayıt yok')))]));
    };
    search.addEventListener('input', debounce(draw, 200)); st.addEventListener('change', draw);
    root.replaceChildren(pageHead('İçerik Arşivi', 'Tüm sosyal medya içeriklerinizin kaydı.', { crumbs: 'Social Studio › İçerik Arşivi' }), h('div', { class: 'card card-pad stack' }, h('div', { class: 'grid cols-2' }, search, st), h('div', { class: 'tbl-wrap' }, h('table', { class: 'tbl' }, h('thead', {}, h('tr', {}, ['İçerik', 'Platform', 'Kategori', 'Zaman', 'Durum', 'Hazırlayan'].map((x) => h('th', {}, x)))), tbody))));
    draw();
  } catch (e) { root.replaceChildren(errorBanner(e)); }
  return root;
};

/* ====================== BRAND KIT ====================== */
export const renderBrandKit = async (ctx) => {
  ctx.setTitle('Brand Kit');
  const root = h('div', {}, spinner());
  try {
    const [b, media] = await Promise.all([api.get('/x/marka'), api.get('/medya?limit=60').catch(() => ({ rows: [] }))]);
    const imgs = (media.rows ?? []).filter((m) => /^image\//.test(m.mime));
    const logos = panel('Logo Varyasyonları', h('div', { class: 'logo-grid' }, b.logos.map((l, i) => h('div', { class: `logo-card${i === 0 ? ' on' : ''}` }, h('div', { class: `logo-view${l.dark ? ' dark' : ''}` }, h('img', { src: l.src, alt: l.name })), h('b', {}, l.name), h('span', { class: 'small muted' }, l.note)))), { ic: 'image', sub: 'Marka logosunun kullanım biçimleri (resmî dosyalar)' });
    const pal = panel('Renk Paleti', h('div', { class: 'sw-grid' }, b.palette.map((c) => h('button', { class: 'sw', title: 'Kopyala', onclick: async () => { await navigator.clipboard.writeText(c.hex); toast(`${c.hex} kopyalandı`, 'ok'); } }, h('i', { style: `background:${c.hex}` }), h('b', {}, c.name), h('span', {}, c.hex.toUpperCase())))), { ic: 'palette', sub: 'Sitenin tasarım token\'larından okunur' });
    const typo = panel('Tipografi Sistemi', h('div', { class: 'row', style: 'gap:18px;align-items:flex-start;flex-wrap:wrap' }, h('div', { class: 'aa' }, h('div', { class: 'aa-big' }, 'Aa'), h('b', {}, b.font.family), chip('Ana Font', 'ok'), h('div', { class: 'small muted' }, b.font.license)),
      h('div', { class: 'grow' }, b.sizes.map((s) => h('div', { class: 'stat-row' }, h('b', { style: 'width:70px' }, s.label), h('span', { class: 'grow muted small' }, s.value))))), { ic: 'edit', sub: 'Site yazı tipi ölçeği' });
    const iconsShown = b.icons.slice(0, 18);
    const icons = panel('İkon Kütüphanesi', h('div', { class: 'ico-grid' }, iconsShown.map((n) => h('div', { class: 'ico', title: n }, h('img', { src: `/api/admin/simge/${n}`, alt: n })))), { ic: 'grid', sub: `${b.icons.length} ikon · marka stiline uygun`, action: h('button', { class: 'btn secondary sm', onclick: () => modal({ title: `İkonlar (${b.icons.length})`, wide: true, body: h('div', { class: 'ico-grid big' }, b.icons.map((n) => h('div', { class: 'ico', title: n }, h('img', { src: `/api/admin/simge/${n}`, alt: n }), h('span', { class: 'small' }, n.split('/').pop())))), actions: [{ label: 'Kapat', class: 'secondary' }] }) }, 'Tümünü Gör') });
    const comps = panel('Marka Bileşenleri', h('div', { class: 'comp-grid' }, h('div', {}, h('button', { class: 'btn' }, 'Birincil Buton'), h('div', { class: 'small muted' }, 'Birincil Buton')), h('div', {}, h('button', { class: 'btn secondary' }, 'İkincil Buton'), h('div', { class: 'small muted' }, 'İkincil Buton')),
      h('div', {}, h('div', { class: 'card card-pad', style: 'padding:10px' }, h('b', {}, 'Başlık'), h('div', { class: 'small muted' }, 'Açıklama metni burada…')), h('div', { class: 'small muted' }, 'Bilgi Kartı')),
      h('div', {}, chip('Yeni', 'info'), h('div', { class: 'small muted' }, 'Rozet')), h('div', {}, h('div', { class: 'tabs2' }, h('button', { 'aria-selected': 'true' }, 'Aktif'), h('button', { 'aria-selected': 'false' }, 'Pasif')), h('div', { class: 'small muted' }, 'Sekme')), h('div', {}, h('div', { class: 'progress-bar' }, h('i', { style: 'width:68%;background:#0b7bd6' })), h('div', { class: 'small muted' }, 'İlerleme Çubuğu'))), { ic: 'grid', sub: 'Panelde ve sitede kullanılan hazır bileşenler' });

    // şablon düzenleyici
    const st = { template: 'proje-tanitim', title: b.templates[0].title, subtitle: b.templates[0].subtitle, theme: b.templates[0].theme, bg: '', logoPos: 'left', align: 'left', format: 'ig-kare' };
    const preview = h('div', { class: 'tpl-prev' }, spinner());
    const titleI = h('input', { class: 'input', value: st.title, maxlength: 90 }); const subI = h('textarea', { class: 'textarea', rows: 3, maxlength: 200 }); subI.value = st.subtitle;
    const fmtSel = h('select', { class: 'select' }, b.formats.map((f) => h('option', { value: f.key }, f.label)));
    let lastB64 = null, lastMime = 'image/png', busy = 0;
    const render = async () => {
      const my = ++busy;
      try {
        const r = await api.post('/x/marka/onizle', { ...st, title: titleI.value, subtitle: subI.value, format: fmtSel.value });
        if (my !== busy) return;
        lastB64 = r.data; lastMime = r.mime;
        preview.replaceChildren(h('img', { src: `data:${r.mime};base64,${r.data}`, alt: 'Şablon önizleme' }), h('div', { class: 'small muted', style: 'text-align:center;margin-top:6px' }, `${r.w} × ${r.h}`));
      } catch (e) { preview.replaceChildren(errorBanner(e)); }
    };
    const rdebounced = debounce(render, 350);
    for (const el of [titleI, subI]) el.addEventListener('input', rdebounced); fmtSel.addEventListener('change', render);
    const radio = (name, opts, key) => h('div', { class: 'row wrap' }, opts.map(([v, l]) => h('label', { class: 'switch' }, h('input', { type: 'radio', name, checked: st[key] === v, onchange: () => { st[key] = v; render(); } }), h('i'), h('span', {}, l))));
    const bgSel = h('select', { class: 'select' }, [h('option', { value: '' }, 'Yok (marka gradyanı)'), ...imgs.map((m) => h('option', { value: m.filename }, m.title || m.filename))]);
    bgSel.addEventListener('change', () => { st.bg = bgSel.value; render(); });
    const download = (ext) => { if (!lastB64) return; api.post('/x/marka/onizle', { ...st, title: titleI.value, subtitle: subI.value, format: fmtSel.value, out: ext }).then((r) => { const a = h('a', { href: `data:${r.mime};base64,${r.data}`, download: `akort-${st.template}.${ext}` }); document.body.append(a); a.click(); a.remove(); }).catch((e) => toast(e.message, 'err')); };
    const tpls = panel('Onaylı Sosyal Medya Şablonları', h('div', { class: 'tpl-grid' }, b.templates.map((t) => { const img = h('div', { class: 'tpl-th' }, spinner('')); api.post('/x/marka/onizle', { template: t.key, title: t.title, subtitle: t.subtitle, theme: t.theme, format: 'ig-kare' }).then((r) => img.replaceChildren(h('img', { src: `data:${r.mime};base64,${r.data}`, alt: t.name }))).catch(() => img.replaceChildren('—'));
      return h('button', { class: `tpl${t.key === st.template ? ' on' : ''}`, dataset: { k: t.key }, onclick: () => { st.template = t.key; st.theme = t.theme; titleI.value = t.title; subI.value = t.subtitle; st.title = t.title; for (const el of root.querySelectorAll('.tpl')) el.classList.toggle('on', el.dataset.k === t.key); render(); } }, img, h('b', {}, t.name), h('span', { class: 'small muted' }, `1080 × 1080 · ${t.note}`)); })), { ic: 'doc', sub: 'Marka standartlarına uygun hazır şablonlar (deterministik oluşturucu)' });
    const editorP = panel('Şablon Düzenleyici', h('div', { class: 'tpl-ed' }, h('div', { class: 'stack' },
      field('Başlık Metni', titleI), field('Alt Başlık', subI), field('Arka Plan Görseli (medya kütüphanesinden)', bgSel, imgs.length ? '' : 'Medya kütüphanesine görsel yükleyin.'), field('Format', fmtSel),
      h('div', {}, h('div', { class: 'lbl' }, 'Renk Teması'), radio('theme', b.themes.map((t) => [t.key, t.label]), 'theme')), h('div', {}, h('div', { class: 'lbl' }, 'Logo Konumu'), radio('lp', [['left', 'Sol'], ['center', 'Orta'], ['right', 'Sağ']], 'logoPos')), h('div', {}, h('div', { class: 'lbl' }, 'Metin Hizalaması'), radio('al', [['left', 'Sol'], ['center', 'Orta'], ['right', 'Sağ']], 'align'))),
      h('div', { class: 'stack' }, preview, h('div', { class: 'lbl' }, 'Dışa Aktar'), h('div', { class: 'row wrap' }, h('button', { class: 'btn secondary', onclick: () => download('png') }, icon('download', 16), 'PNG'), h('button', { class: 'btn secondary', onclick: () => download('jpg') }, icon('download', 16), 'JPG'), h('button', { class: 'btn secondary', onclick: () => download('webp') }, icon('download', 16), 'WebP'), h('button', { class: 'btn secondary', disabled: true, title: 'Vektör/PDF çıktısı henüz yok' }, 'SVG / PDF'),
        h('button', { class: 'btn', onclick: async (e) => { e.target.disabled = true; try { const r = await api.post('/x/marka/kaydet', { ...st, title: titleI.value, subtitle: subI.value, format: fmtSel.value, template: st.template }); toast(`Medya kütüphanesine kaydedildi: ${r.filename}`, 'ok'); } catch (er) { toast(er.message, 'err'); } e.target.disabled = false; } }, icon('upload', 16), 'Medya Kütüphanesine Kaydet')))), { ic: 'edit', sub: 'Logo ve marka metni her zaman şablon katmanı olarak bindirilir; yapay zekâ logo/tipografi üretmez' });

    root.replaceChildren(pageHead('Brand Kit & Tasarım Sistemi', 'Logo, renk, tipografi, ikon stili ve onaylı tasarım şablonlarını yönetin.', { crumbs: 'Social Studio › Brand Kit' }),
      h('div', { class: 'dash-grid' }, h('div', { class: 'span-4' }, logos), h('div', { class: 'span-5' }, pal), h('div', { class: 'span-3' }, typo),
        h('div', { class: 'span-4' }, icons), h('div', { class: 'span-4' }, comps), h('div', { class: 'span-4' }, h('div', { class: 'empty small' }, 'Marka kuralları: logo çevresinde boşluk bırakın, renk paletinin dışına çıkmayın, abartılı sloganlardan kaçının.')),
        h('div', { class: 'span-12' }, tpls), h('div', { class: 'span-12' }, editorP)));
    render();
  } catch (e) { root.replaceChildren(errorBanner(e)); }
  return root;
};
void PALETTE; void session;
