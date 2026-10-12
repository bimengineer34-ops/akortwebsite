// Pano — referans dashboard tasarımı: kullanıcı tanımlı KPI kartları + gerçek veriden grafikler
import { api, session } from '../api.js';
import { h, icon, chip, fmtDate, modal, toast, spinner, errorBanner } from '../ui.js';
import { kpiCard, areaChart, barChart, donut, hbars, panel, PALETTE, fmtNum } from '../charts.js';

const FORM_ST = { yeni: ['Yeni', '#3b82f6'], islemde: ['İşlemde', '#f59e0b'], yanitlandi: ['Yanıtlandı', '#10b981'], kapali: ['Kapalı', '#64748b'], spam: ['Spam', '#ef4444'] };
const SOC_ST = { taslak: ['Taslak', '#64748b'], onay_bekliyor: ['Onay bekliyor', '#f59e0b'], revizyon: ['Revizyon', '#ec4899'], onaylandi: ['Onaylandı', '#3b82f6'], planlandi: ['Planlandı', '#06b6d4'], yayimlandi: ['Yayımlandı', '#10b981'], hata: ['Hata', '#ef4444'] };
const statusChip = (s) => ({ yeni: chip('Yeni', 'info'), islemde: chip('İşlemde', 'warn'), yanitlandi: chip('Yanıtlandı', 'ok'), kapali: chip('Kapalı'), spam: chip('Spam', 'danger') }[s] ?? chip(s));

/** KPI düzenleyici: hangi kartlar, hangi sırada, hangi hedefle */
const editKpis = (data, onSave) => {
  const sel = new Map(data.prefs.cards.map((c, i) => [c.id, { on: true, target: c.target ?? '', order: i }]));
  const groups = [...new Set(data.catalog.map((c) => c.group))];
  const rows = [];
  const body = h('div', { class: 'stack' },
    h('div', { class: 'banner info' }, icon('eye'), h('div', {}, 'Panonuzda görmek istediğiniz göstergeleri seçin (en çok 12). İsterseniz bir hedef değeri yazın; kart hedefe ilerlemeyi gösterir. Tercihleriniz yalnızca size aittir.')),
    h('div', { class: 'kpi-pick' }, groups.flatMap((g) => [h('div', { class: 'small muted', style: 'margin-top:6px;font-weight:700' }, g), ...data.catalog.filter((c) => c.group === g).map((c) => {
      const st = sel.get(c.id) ?? { on: false, target: '', order: 999 };
      sel.set(c.id, st);
      const cb = h('input', { type: 'checkbox', checked: st.on, onchange: () => { st.on = cb.checked; if (st.on) st.order = Date.now(); } });
      const tg = h('input', { class: 'input', type: 'number', min: 0, placeholder: 'Hedef', value: st.target, title: 'İsteğe bağlı hedef', oninput: () => { st.target = tg.value; } });
      rows.push(c);
      return h('label', {}, cb, h('span', {}, h('b', {}, c.label), c.unit ? ` (${c.unit})` : '', c.hint ? h('div', { class: 'g' }, c.hint) : null), tg);
    })])));
  modal({ title: 'KPI\'larımı düzenle', wide: true, body, actions: [{ label: 'Vazgeç', class: 'secondary' }, { label: 'Kaydet', onClick: async () => {
    const cards = [...sel.entries()].filter(([, v]) => v.on).sort((a, b) => a[1].order - b[1].order).map(([id, v]) => ({ id, target: v.target === '' ? null : Number(v.target) }));
    if (!cards.length) { toast('En az bir KPI seçin', 'err'); return false; }
    try { await api.put('/x/kpi', { range: data.range, cards }); toast('KPI tercihleriniz kaydedildi', 'ok'); onSave(); } catch (e) { toast(e.message, 'err'); return false; }
  } }] });
};

export const renderDashboard = async (ctx) => {
  ctx.setTitle('Pano');
  const root = h('div', { class: 'stack' });
  let range = Number(sessionStorage.getItem('akort-kpi-range')) || 0;

  const load = async () => {
    root.replaceChildren(spinner());
    try {
      const [d, k, g] = await Promise.all([api.get('/pano'), api.get(`/x/kpi${range ? `?gun=${range}` : ''}`), api.get(`/x/grafik?gun=${range || 30}`)]);
      range = k.range;
      const pending = d.drafts.length + (d.entriesDirty ? 1 : 0);

      const rangeSel = h('div', { class: 'range', role: 'group', 'aria-label': 'Zaman aralığı' }, [7, 30, 90].map((n) => h('button', { 'aria-pressed': String(n === range), onclick: () => { range = n; sessionStorage.setItem('akort-kpi-range', String(n)); load(); } }, `Son ${n} gün`)));
      const head = h('div', { class: 'hello' },
        h('div', { class: 'grow' }, h('h1', {}, `Merhaba, ${session.user.name.split(' ')[0]}`), h('p', { class: 'muted' }, 'Sitenizin performansı, talepleriniz ve yayın akışınız tek bakışta.')),
        rangeSel,
        h('button', { class: 'btn secondary', onclick: () => editKpis(k, load) }, icon('gear', 16), 'KPI\'larımı düzenle'),
        h('a', { class: 'btn secondary', href: '/', target: '_blank', rel: 'noopener' }, icon('external', 16), 'Siteyi aç'));

      const banners = [];
      banners.push(pending
        ? h('div', { class: 'banner warn' }, icon('alert'), h('div', { class: 'grow' }, h('b', {}, `${pending} değişiklik yayın bekliyor.`), h('div', { class: 'small' }, 'Kaydedilen taslaklar siteye "Yayınla" ile yansır.')), h('a', { class: 'btn sm', href: '#/yayin' }, 'Yayına git'))
        : h('div', { class: 'banner ok' }, icon('check'), h('div', {}, h('b', {}, 'Her şey yayında.'), ` Son yayın: ${fmtDate(d.lastPublish)}`)));
      if (d.unverifiedCount) banners.push(h('div', { class: 'banner info' }, icon('shield'), h('div', { class: 'grow' }, h('b', {}, `${d.unverifiedCount} alan doğrulanmayı bekliyor.`), h('div', { class: 'small' }, 'Doğrulanmamış rakam ve iddialar canlı sitede gösterilmez.')), h('a', { class: 'btn secondary sm', href: '#/dogrulama' }, 'Listeyi gör')));
      if (session.user.role === 'admin' && !d.myTwoFactor) banners.push(h('div', { class: 'banner warn' }, icon('shield'), h('div', {}, h('b', {}, '2 adımlı doğrulama kapalı.'), ' Yönetici hesabınızı korumak için ', h('a', { href: '#/hesabim' }, 'Hesabım'), ' sayfasından açın.')));

      const dest = { visits: '/istatistik', forms: '/formlar', forms_open: '/formlar', conversion: '/formlar', subscribers: '/aboneler', subscribers_total: '/aboneler', blog: '/blog', projects: '/projeler', drafts: '/blog', media: '/medya', seo_score: '/seo', seo_errors: '/seo', social_total: '/sosyal', social_awaiting: '/sosyal', social_planned: '/sosyal', social_published: '/sosyal', ai_tokens: '/ai', ai_calls: '/ai', news: '/pazar', competitor_changes: '/rakipler', backlinks_won: '/backlink', pending: '/yayin' };
      const kpis = h('div', { class: 'kpis' }, k.cards.map((c) => kpiCard({ ic: c.icon, label: c.label, value: c.value, unit: c.unit, delta: c.flow || c.prev !== null ? c.delta : null, deltaLabel: c.flow ? `önceki ${range} güne göre` : '', series: c.series, color: c.color, to: dest[c.id], hint: c.hint, target: c.target, goodUp: c.goodUp })));

      const trend = panel('Ziyaret ve talep trendi', areaChart({ labels: g.labels, series: [{ name: 'Ziyaret', color: '#3b82f6', values: g.visits }, { name: 'Form talebi (×10)', color: '#10b981', values: g.forms.map((v) => v * 10) }], height: 250 }), { ic: 'eye', sub: `Son ${range} gün · form talebi okunabilirlik için ×10 ölçeklidir` });
      const formDonut = panel('Form durumları', donut({ items: g.formStatus.map((s) => ({ label: FORM_ST[s.status]?.[0] ?? s.status, value: s.n, color: FORM_ST[s.status]?.[1] })), sub: 'talep', empty: 'Henüz form talebi yok' }), { ic: 'mail', action: h('a', { class: 'small', href: '#/formlar' }, 'Tümü') });
      const topPages = panel('En çok görüntülenen sayfalar', hbars(g.topPages.map((p) => ({ label: p.path, value: p.views })), { color: '#3b82f6', empty: 'Henüz ziyaret verisi yok (çerezsiz sayaç siteyi gezdikçe dolar)' }), { ic: 'doc', action: h('a', { class: 'small', href: '#/istatistik' }, 'Ayrıntı') });
      const socDonut = panel('Sosyal içerik hattı', donut({ items: Object.keys(SOC_ST).map((k2) => ({ label: SOC_ST[k2][0], value: g.socialStatus.find((s) => s.status === k2)?.n ?? 0, color: SOC_ST[k2][1] })).filter((x) => x.value), sub: 'içerik', empty: 'Henüz sosyal içerik yok' }), { ic: 'share', action: h('a', { class: 'small', href: '#/sosyal' }, 'Social Studio') });
      const content = panel('Haber ve AI kullanımı', barChart({ labels: g.labels, series: [{ name: 'Yeni sektör haberi', color: '#06b6d4', values: g.news }], height: 170 }), { ic: 'radar', sub: 'Haber akışı (günlük)' });
      const recent = panel('Son form talepleri', d.recentForms.length ? h('div', { class: 'tbl-wrap' }, h('table', { class: 'tbl' }, h('tbody', {}, d.recentForms.map((f) => h('tr', { class: `clickable${f.status === 'yeni' ? ' fresh' : ''}`, onclick: () => ctx.nav(`/formlar/${f.id}`) }, h('td', {}, h('b', {}, f.name), h('div', { class: 'muted small' }, f.subject || f.email)), h('td', {}, statusChip(f.status)), h('td', { class: 'muted small' }, fmtDate(f.created_at))))))) : h('div', { class: 'empty' }, 'Henüz form talebi yok.'), { ic: 'mail' });
      const upcoming = panel('Yaklaşan paylaşımlar', g.upcoming.length ? h('ul', { class: 'hbars' }, g.upcoming.map((u) => h('li', {}, h('div', { class: 'hb-top' }, h('span', { class: 'hb-l' }, u.title), chip(u.status === 'planlandi' ? 'Planlandı' : 'Onaylandı', 'ok')), h('div', { class: 'small muted' }, `${String(u.scheduled_at).replace('T', ' ').slice(0, 16)} · ${u.platforms.join(', ')}`)))) : h('div', { class: 'muted small', style: 'padding:8px 0' }, 'Onaylı/planlı paylaşım yok.'), { ic: 'share' });
      const audit = panel('Son etkinlik', h('div', { class: 'tbl-wrap' }, h('table', { class: 'tbl' }, h('tbody', {}, d.recentAudit.map((a) => h('tr', {}, h('td', {}, h('b', {}, a.action), h('div', { class: 'muted small' }, `${a.user_email}${a.target ? ' · ' + a.target : ''}`)), h('td', { class: 'muted small' }, fmtDate(a.ts))))))), { ic: 'log', action: session.user.role === 'admin' ? h('a', { class: 'small', href: '#/gunluk' }, 'Tümü') : null });
      const quick = panel('Hızlı işlemler', h('div', { class: 'row wrap' },
        h('a', { class: 'btn secondary', href: '#/blog/yeni' }, icon('plus', 16), 'Yeni blog yazısı'), h('a', { class: 'btn secondary', href: '#/projeler/yeni' }, icon('plus', 16), 'Yeni proje'),
        h('a', { class: 'btn secondary', href: '#/ai' }, icon('spark', 16), 'AI ile yaz'), h('a', { class: 'btn secondary', href: '#/sosyal' }, icon('share', 16), 'Sosyal içerik planla'),
        h('a', { class: 'btn secondary', href: '#/medya' }, icon('upload', 16), 'Görsel yükle'), h('a', { class: 'btn secondary', href: '#/seo' }, icon('search', 16), 'SEO taraması')), { ic: 'rocket' });
      const lb = d.lastBuild;
      const sys = panel('Sistem durumu', h('div', { class: 'small stack' },
        h('div', {}, 'Son yayın: ', lb ? h('span', {}, chip(lb.status === 'basarili' ? 'Başarılı' : lb.status === 'running' ? 'Sürüyor' : 'Başarısız', lb.status === 'basarili' ? 'ok' : lb.status === 'running' ? 'info' : 'danger'), ' ', fmtDate(lb.finished_at ?? lb.started_at)) : 'henüz yok'),
        h('div', {}, `İçerik belgesi: ${d.docs} · Medya: ${d.media} dosya · Blog: ${d.blog.total} · Proje: ${d.projects.total}`),
        h('div', { class: 'muted' }, `Node ${d.node} · çalışma süresi ${Math.floor(d.uptime / 3600)} sa ${Math.floor((d.uptime % 3600) / 60)} dk`)), { ic: 'gear' });

      root.replaceChildren(head, ...banners, kpis,
        h('div', { class: 'dash-grid' },
          h('div', { class: 'span-8' }, trend), h('div', { class: 'span-4' }, formDonut),
          h('div', { class: 'span-4' }, topPages), h('div', { class: 'span-4' }, socDonut), h('div', { class: 'span-4' }, upcoming),
          h('div', { class: 'span-6' }, recent), h('div', { class: 'span-6' }, content),
          h('div', { class: 'span-6' }, audit), h('div', { class: 'span-6' }, h('div', { class: 'stack' }, quick, sys))));
    } catch (e) { root.replaceChildren(errorBanner(e)); }
  };
  load();
  return root;
};
void PALETTE; void fmtNum;
