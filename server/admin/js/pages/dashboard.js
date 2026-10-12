// Pano — referans dashboard tasarımı: kullanıcı tanımlı KPI kartları + gerçek veriden grafikler
import { api, session } from '../api.js';
import { h, icon, chip, fmtDate, modal, toast, spinner, errorBanner } from '../ui.js';
import { kpiCard, areaChart, barChart, donut, hbars, panel, PALETTE, fmtNum } from '../charts.js';

const FORM_ST = { yeni: ['Yeni', '#0b7bd6'], islemde: ['İşlemde', '#ff9f43'], yanitlandi: ['Yanıtlandı', '#28c76f'], kapali: ['Kapalı', '#a8aaae'], spam: ['Spam', '#ea5455'] };
const SOC_ST = { taslak: ['Taslak', '#a8aaae'], onay_bekliyor: ['Onay bekliyor', '#ff9f43'], revizyon: ['Revizyon', '#ff6bb5'], onaylandi: ['Onaylandı', '#0b7bd6'], planlandi: ['Planlandı', '#00cfe8'], yayimlandi: ['Yayımlandı', '#28c76f'], hata: ['Hata', '#ea5455'] };
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
      const hour = new Date().getHours();
      const greet = hour < 6 ? 'İyi geceler' : hour < 12 ? 'Günaydın' : hour < 18 ? 'İyi günler' : 'İyi akşamlar';
      const first = session.user.name.split(' ')[0];
      const open = d.forms.fresh;
      const head = h('div', { class: 'hero' },
        h('div', { class: 'hero-top' },
          h('div', { class: 'grow' }, h('h1', {}, `${greet}, ${first}! 👋`),
            h('p', {}, open ? `Yanıt bekleyen ${open} talebiniz var.` : 'Bekleyen talebiniz yok, harika gidiyorsunuz.'), h('p', {}, pending ? `${pending} değişiklik yayına hazır.` : 'Tüm içerikler yayında.')),
          h('div', { class: 'row wrap' }, rangeSel, h('button', { class: 'btn secondary', onclick: () => editKpis(k, load) }, icon('gear', 16), 'KPI\'larımı düzenle'), h('a', { class: 'btn', href: '/', target: '_blank', rel: 'noopener' }, icon('external', 16), 'Siteyi aç'))),
        h('div', { class: 'hero-stats' },
          h('div', { class: 'hero-stat' }, h('b', {}, String(open)), h('span', {}, 'Yeni talep')),
          h('div', { class: 'hero-stat' }, h('b', {}, String(pending)), h('span', {}, 'Yayın bekleyen')),
          h('div', { class: 'hero-stat' }, h('b', {}, String(g.awaitingApproval)), h('span', {}, 'Onay bekleyen içerik')),
          h('div', { class: 'hero-stat' }, h('b', {}, fmtNum(d.views7)), h('span', {}, 'Son 7 gün ziyaret'))));

      // Kişiye özel yapılacaklar: gerçek duruma göre üretilir
      const todos = [];
      if (open) todos.push(['#ff9f43', 'mail', `${open} yeni form talebini yanıtlayın`, 'Müşteriler yanıt bekliyor', '/formlar', 'Aç']);
      if (pending) todos.push(['#0b7bd6', 'rocket', `${pending} değişikliği yayınlayın`, 'Kaydedilen içerikler siteye henüz yansımadı', '/yayin', 'Yayına git']);
      if (g.awaitingApproval && session.user.role === 'admin') todos.push(['#ff6bb5', 'share', `${g.awaitingApproval} sosyal içerik onayınızı bekliyor`, 'Onaylanmadan hiçbir içerik yayımlanmaz', '/sosyal', 'İncele']);
      if (d.unverifiedCount) todos.push(['#00cfe8', 'shield', `${d.unverifiedCount} alanı doğrulayın`, 'Doğrulanmamış bilgiler canlı sitede gizli', '/dogrulama', 'Listele']);
      if (!g.aiConnected && session.user.role === 'admin') todos.push(['#8b5cf6', 'spark', 'Bir yapay zekâ sağlayıcısı bağlayın', 'AI İçerik Stüdyosu için API anahtarı gerekli', '/entegrasyonlar', 'Bağla']);
      if (session.user.role === 'admin' && !d.myTwoFactor) todos.push(['#ea5455', 'shield', '2 adımlı doğrulamayı açın', 'Yönetici hesabınızı koruyun', '/hesabim', 'Aç']);
      const todo = panel('Yapılacaklarım', todos.length
        ? h('ul', { class: 'todo' }, todos.map(([c, ic, t, s, to, label]) => h('li', { style: `--kc:${c}` }, h('span', { class: 'tic' }, icon(ic, 18)), h('div', { class: 'grow' }, h('b', {}, t), h('span', {}, s)), h('a', { class: 'btn secondary sm', href: `#${to}` }, label))))
        : h('div', { class: 'empty' }, '🎉 Yapılacak bir şey kalmadı.'), { ic: 'check', sub: `${first} için kişiselleştirildi` });
      const mine = panel('Son işlemlerim', g.mine.length ? h('ul', { class: 'hbars' }, g.mine.map((a) => h('li', {}, h('div', { class: 'hb-top' }, h('span', { class: 'hb-l' }, a.action), h('span', { class: 'small muted' }, fmtDate(a.ts))), a.target ? h('div', { class: 'small muted' }, a.target) : null))) : h('div', { class: 'muted small', style: 'padding:8px 0' }, 'Henüz işleminiz yok.'), { ic: 'history' });

      const banners = [];
      banners.push(pending
        ? h('div', { class: 'banner warn' }, icon('alert'), h('div', { class: 'grow' }, h('b', {}, `${pending} değişiklik yayın bekliyor.`), h('div', { class: 'small' }, 'Kaydedilen taslaklar siteye "Yayınla" ile yansır.')), h('a', { class: 'btn sm', href: '#/yayin' }, 'Yayına git'))
        : h('div', { class: 'banner ok' }, icon('check'), h('div', {}, h('b', {}, 'Her şey yayında.'), ` Son yayın: ${fmtDate(d.lastPublish)}`)));
      if (d.unverifiedCount) banners.push(h('div', { class: 'banner info' }, icon('shield'), h('div', { class: 'grow' }, h('b', {}, `${d.unverifiedCount} alan doğrulanmayı bekliyor.`), h('div', { class: 'small' }, 'Doğrulanmamış rakam ve iddialar canlı sitede gösterilmez.')), h('a', { class: 'btn secondary sm', href: '#/dogrulama' }, 'Listeyi gör')));
      if (session.user.role === 'admin' && !d.myTwoFactor) banners.push(h('div', { class: 'banner warn' }, icon('shield'), h('div', {}, h('b', {}, '2 adımlı doğrulama kapalı.'), ' Yönetici hesabınızı korumak için ', h('a', { href: '#/hesabim' }, 'Hesabım'), ' sayfasından açın.')));

      const dest = { visits: '/istatistik', forms: '/formlar', forms_open: '/formlar', conversion: '/formlar', subscribers: '/aboneler', subscribers_total: '/aboneler', blog: '/blog', projects: '/projeler', drafts: '/blog', media: '/medya', seo_score: '/seo', seo_errors: '/seo', social_total: '/sosyal', social_awaiting: '/sosyal', social_planned: '/sosyal', social_published: '/sosyal', ai_tokens: '/ai', ai_calls: '/ai', news: '/pazar', competitor_changes: '/rakipler', backlinks_won: '/backlink', pending: '/yayin' };
      const kpis = h('div', { class: 'kpis' }, k.cards.map((c) => kpiCard({ ic: c.icon, label: c.label, value: c.value, unit: c.unit, delta: c.flow || c.prev !== null ? c.delta : null, deltaLabel: c.flow ? `önceki ${range} gün` : '', series: c.series, color: c.color, to: dest[c.id], hint: c.hint, target: c.target, goodUp: c.goodUp })));

      const trend = panel('Ziyaret ve talep trendi', areaChart({ labels: g.labels, series: [{ name: 'Ziyaret', color: '#0b7bd6', values: g.visits }, { name: 'Form talebi (×10)', color: '#28c76f', values: g.forms.map((v) => v * 10) }], height: 250 }), { ic: 'eye', sub: `Son ${range} gün · form talebi okunabilirlik için ×10 ölçeklidir` });
      const formDonut = panel('Form durumları', donut({ items: g.formStatus.map((s) => ({ label: FORM_ST[s.status]?.[0] ?? s.status, value: s.n, color: FORM_ST[s.status]?.[1] })), sub: 'talep', empty: 'Henüz form talebi yok' }), { ic: 'mail', action: h('a', { class: 'small', href: '#/formlar' }, 'Tümü') });
      const topPages = panel('En çok görüntülenen sayfalar', hbars(g.topPages.map((p) => ({ label: p.path, value: p.views })), { color: '#0b7bd6', empty: 'Henüz ziyaret verisi yok (çerezsiz sayaç siteyi gezdikçe dolar)' }), { ic: 'doc', action: h('a', { class: 'small', href: '#/istatistik' }, 'Ayrıntı') });
      const socDonut = panel('Sosyal içerik hattı', donut({ items: Object.keys(SOC_ST).map((k2) => ({ label: SOC_ST[k2][0], value: g.socialStatus.find((s) => s.status === k2)?.n ?? 0, color: SOC_ST[k2][1] })).filter((x) => x.value), sub: 'içerik', empty: 'Henüz sosyal içerik yok' }), { ic: 'share', action: h('a', { class: 'small', href: '#/sosyal' }, 'Social Studio') });
      const content = panel('Haber ve AI kullanımı', barChart({ labels: g.labels, series: [{ name: 'Yeni sektör haberi', color: '#00cfe8', values: g.news }], height: 170 }), { ic: 'radar', sub: 'Haber akışı (günlük)' });
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

      void banners;
      root.replaceChildren(head, kpis,
        h('div', { class: 'dash-grid' },
          h('div', { class: 'span-8' }, trend), h('div', { class: 'span-4' }, todo),
          h('div', { class: 'span-4' }, formDonut), h('div', { class: 'span-4' }, topPages), h('div', { class: 'span-4' }, socDonut),
          h('div', { class: 'span-6' }, recent), h('div', { class: 'span-6' }, content),
          h('div', { class: 'span-4' }, upcoming), h('div', { class: 'span-4' }, mine), h('div', { class: 'span-4' }, h('div', { class: 'stack' }, quick, sys)),
          h('div', { class: 'span-12' }, audit)));
    } catch (e) { root.replaceChildren(errorBanner(e)); }
  };
  load();
  return root;
};
void PALETTE; void fmtNum;
