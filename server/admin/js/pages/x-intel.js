// Pazar ve Medya Takibi, Rakip Analizi, Geri Bağlantı Analizi — referans düzenleri.
// Yalnızca izinli RSS/herkese açık sayfalar; lisanslı SERP/backlink veri sağlayıcısı olmadan ilgili alanlar "Bağlantı gerekli" gösterir.
import { api, session } from '../api.js';
import { h, icon, chip, toast, spinner, errorBanner, field, modal, confirmBox, fmtDate } from '../ui.js';
import { kpiCard, areaChart, donut, hbars, panel, ring, fmtNum, PALETTE } from '../charts.js';
import { pageHead, tabs, infoBox, empty, connectBox, getRange } from './x-common.js';

const run = async (btn, fn) => { btn.disabled = true; try { await fn(); } catch (e) { toast(e.message, 'err'); } btn.disabled = false; };
const sel = (opts, value) => h('select', { class: 'select' }, opts.map(([v, l]) => h('option', { value: v, selected: v === value }, l)));
const hue = (s) => PALETTE[[...String(s)].reduce((a, c) => a + c.charCodeAt(0), 0) % PALETTE.length];
const avatar = (name) => h('span', { class: 'avatar', style: `background:${hue(name)}` }, String(name).trim().slice(0, 1).toUpperCase());
const ago = (iso) => {
  if (!iso) return '—';
  const t = new Date(String(iso).includes('T') ? iso : String(iso).replace(' ', 'T') + 'Z');
  const m = Math.round((Date.now() - t) / 60000);
  return m < 1 ? 'şimdi' : m < 60 ? `${m} dk önce` : m < 1440 ? `${Math.round(m / 60)} sa önce` : `${Math.round(m / 1440)} gün önce`;
};
const deltaPct = (cur, prev) => (prev ? ((cur - prev) / prev) * 100 : cur ? null : 0);

/* ====================== Kaynak formu ====================== */
const sourceForm = (s, done) => {
  const v = s ?? { name: '', url: '', kind: 'rss', country: 'TR', lang: 'tr', category: 'genel', license_note: '', interval_min: 360, enabled: 1 };
  const name = h('input', { class: 'input', value: v.name }); const url = h('input', { class: 'input', value: v.url, placeholder: 'https://…/rss' });
  const cat = sel([['genel', 'Genel'], ['MEP', 'MEP'], ['BIM', 'BIM'], ['HVAC', 'HVAC'], ['elektrik', 'Elektrik'], ['enerji', 'Enerji'], ['GES', 'GES'], ['celik', 'Çelik'], ['mimari', 'Mimari'], ['dernek', 'Dernek/Kurum'], ['resmi', 'Resmî duyuru']], v.category);
  const country = h('input', { class: 'input', value: v.country }); const lang = h('input', { class: 'input', value: v.lang });
  const lic = h('textarea', { class: 'textarea', rows: 2, placeholder: 'Kullanım koşulu / lisans notu (kaynağın sitesinden kontrol edin)' }); lic.value = v.license_note;
  const interval = h('input', { class: 'input', type: 'number', min: 60, value: v.interval_min });
  const ok = h('input', { type: 'checkbox', checked: !!v.enabled });
  modal({ title: s ? 'Kaynağı düzenle' : 'Yeni kaynak', body: h('div', { class: 'stack' },
    infoBox('Yalnızca izinli RSS/Atom beslemeleri ve herkese açık resmî kaynaklar ekleyin. robots.txt\'e uyulur; paywall/oturum gerektiren veya engellenen kaynaklar atlanır. Makale tam metni saklanmaz (başlık, kısa özet ve bağlantı).'),
    field('Ad', name), field('RSS/Atom adresi', url), h('div', { class: 'grid cols-2' }, field('Kategori', cat), field('Kontrol aralığı (dk, en az 60)', interval), field('Ülke', country), field('Dil', lang)), field('Lisans / kullanım notu', lic), h('label', { class: 'switch' }, ok, h('i'), h('span', {}, 'Etkin'))),
  actions: [{ label: 'Vazgeç', class: 'secondary' }, { label: 'Kaydet', onClick: async () => {
    const b = { name: name.value, url: url.value, kind: 'rss', category: cat.value, country: country.value, lang: lang.value, license_note: lic.value, interval_min: Number(interval.value), enabled: ok.checked };
    try { await (s ? api.put(`/x/pazar/kaynaklar/${s.id}`, b) : api.post('/x/pazar/kaynaklar', b)); toast('Kaydedildi', 'ok'); done(); } catch (e) { toast(e.message, 'err'); return false; }
  } }] });
};

/* ====================== MARKET & MEDIA ====================== */
const sourcesTab = async (reload) => {
  const d = await api.get('/x/pazar');
  return h('div', { class: 'stack' },
    h('div', { class: 'row wrap' }, h('div', { class: 'grow' }), h('button', { class: 'btn', onclick: () => sourceForm(null, reload) }, icon('plus', 16), 'Kaynak ekle')),
    d.sources.length ? h('div', { class: 'card' }, h('div', { class: 'tbl-wrap' }, h('table', { class: 'tbl' }, h('thead', {}, h('tr', {}, ['Kaynak', 'Kategori', 'Aralık', 'Durum', 'Öğe', ''].map((x) => h('th', {}, x)))),
      h('tbody', {}, d.sources.map((s) => h('tr', {}, h('td', {}, h('div', { class: 'row' }, avatar(s.name), h('div', {}, h('b', {}, s.name), h('div', { class: 'small muted' }, s.url), s.license_note ? h('div', { class: 'small' }, `Lisans: ${s.license_note}`) : null))),
        h('td', {}, `${s.category} · ${s.country}/${s.lang}`), h('td', {}, `${s.interval_min} dk`),
        h('td', {}, s.last_error ? chip('Hata', 'danger') : s.last_success ? chip('Çalışıyor', 'ok') : chip('Henüz çekilmedi', 'warn'), s.enabled ? null : chip('Pasif'), s.last_error ? h('div', { class: 'small', style: 'color:var(--danger)' }, s.last_error) : null, s.last_success ? h('div', { class: 'small muted' }, `Son başarılı: ${fmtDate(s.last_success)}`) : null),
        h('td', {}, s.items),
        h('td', {}, h('div', { class: 'row' }, h('button', { class: 'btn secondary sm', onclick: (e) => run(e.target, async () => { const r = await api.post(`/x/pazar/kaynaklar/${s.id}/cek`); toast(r.notModified ? 'Değişiklik yok' : `${r.added} yeni, ${r.skipped} yinelenen/atlanan`, 'ok'); reload(); }) }, 'Şimdi çek'), h('button', { class: 'btn ghost sm', onclick: () => sourceForm(s, reload) }, 'Düzenle'),
          session.user.role === 'admin' ? h('button', { class: 'btn ghost sm', 'aria-label': 'Sil', onclick: async () => { if (await confirmBox({ title: 'Kaynak silinsin mi?', message: 'Kaynağa ait toplanan öğeler de silinir.', confirmLabel: 'Sil', danger: true })) { await api.del(`/x/pazar/kaynaklar/${s.id}`); reload(); } } }, icon('trash', 14)) : null)))))))) : empty('Henüz kaynak yok. İzinli bir RSS adresi ekleyin; sahte örnek veri gösterilmez.'),
    d.jobs.length ? panel('Zamanlanmış işler (son 30)', h('table', { class: 'tbl' }, h('tbody', {}, d.jobs.slice(0, 10).map((j) => h('tr', {}, h('td', {}, j.type), h('td', {}, j.state), h('td', {}, `${j.attempts} deneme`), h('td', { class: 'small muted' }, j.last_error ?? ''))))), { ic: 'history' }) : null);
};

export const renderMarket = async (ctx) => {
  ctx.setTitle('Pazar ve Medya Takibi');
  const root = h('div');
  let tab = 'haber', filt = { country: '', kind: '', cat: '' };
  const load = async () => {
    root.replaceChildren(spinner());
    try {
      const o = await api.get(`/x/pazar/ozet?gun=${getRange()}`);
      const kpis = h('div', { class: 'kpis' },
        kpiCard({ ic: 'radar', label: 'Takip Edilen Kaynaklar', onClick: () => { tab = 'kaynak'; show(); }, value: o.sources.active, deltaLabel: o.sources.failing ? `${o.sources.failing} kaynakta hata` : `${o.sources.total} kayıtlı`, color: '#8b5cf6', to: '/pazar' }),
        kpiCard({ ic: 'blog', label: 'Yeni Sektör Güncellemeleri', onClick: () => { tab = 'haber'; show(); }, value: o.news.cur, delta: deltaPct(o.news.cur, o.news.prev), series: o.news.series, color: '#0b7bd6' }),
        kpiCard({ ic: 'spark', label: 'Yüksek Değerli İçerik Fikirleri', scroll: 'İçerik Fikirleri & Fırsatlar', value: o.ideas, deltaLabel: 'ilgililik ≥ 60 veya fikir', color: '#f79009' }),
        kpiCard({ ic: 'link', label: 'Tespit Edilen Fırsatlar (CRM önerisi)', value: o.leads, color: '#12b76a', to: '/formlar' }));

      const bar = h('div', { class: 'pill-row' },
        ...[['country', 'Kaynak Konumu', [['', 'Tümü'], ...o.countries.map((c) => [c, c])]], ['kind', 'Kaynak Türü', [['', 'Tümü'], ['rss', 'RSS'], ['manuel', 'Elle']]], ['cat', 'Sektör Kategorisi', [['', 'Tümü'], ...o.categories.map((c) => [c, c])]]]
          .map(([k, label, opts]) => { const s = h('select', {}, opts.map(([v, l]) => h('option', { value: v, selected: filt[k] === v }, l))); s.addEventListener('change', () => { filt[k] = s.value; show(); }); return h('div', { class: 'pillsel' }, label, s); }),
        h('button', { class: 'btn secondary', onclick: () => { filt = { country: '', kind: '', cat: '' }; load(); } }, icon('undo', 16), 'Filtreleri Temizle'),
        h('button', { class: 'btn', style: 'margin-left:auto', onclick: () => sourceForm(null, load) }, icon('plus', 16), 'Kaynak ekle'));

      const left = h('div'); const tabsEl = h('div');
      const items = await api.get('/x/pazar/ogeler?limit=200');
      const official = (it) => ['dernek', 'resmi'].includes(it.category);
      const card = (it) => h('div', { class: 'news' },
        h('div', { class: 'grow' },
          h('div', { class: 'row', style: 'gap:8px;margin-bottom:6px' }, avatar(it.source), h('b', { class: 'small' }, it.source), h('span', { class: 'small muted' }, `· ${ago(it.published_at ?? it.fetched_at)}`), chip(`${it.country}/${it.lang}`)),
          h('a', { href: it.canonical_url, target: '_blank', rel: 'noopener noreferrer', class: 'news-title' }, it.title),
          h('div', { class: 'row wrap', style: 'margin-top:8px' }, it.category && it.category !== 'genel' ? chip(it.category, 'ok') : null, ...it.tags.split(',').filter(Boolean).map((t) => chip(t, 'info')), it.status !== 'yeni' ? chip(it.status, '') : null)),
        it.summary ? h('div', { class: 'ai-sum' }, h('div', { class: 'ai-h' }, icon('doc', 14), 'Kaynak özeti'), h('div', {}, it.summary), h('div', { class: 'small muted', style: 'margin-top:6px' }, `Yöntem: ${it.method.toUpperCase()} · Tespit: ${fmtDate(it.fetched_at)}${it.license_note ? ` · Lisans: ${it.license_note}` : ''}`)) : null,
        h('div', { class: 'news-act' }, ...[['ilgili', 'İlgili'], ['fikir', 'Fikir'], ['elendi', 'Ele']].map(([k, l]) => h('button', { class: `btn ${it.status === k ? '' : 'secondary'} sm`, onclick: async () => { await api.patch(`/x/pazar/ogeler/${it.id}`, { status: k }); show(true); } }, l)),
          h('button', { class: 'btn secondary sm', title: 'CRM fırsat önerisi', onclick: async () => { if (await confirmBox({ title: 'CRM\'e öneri olarak ekle?', message: 'Doğrulanmamış bir fırsat önerisi olarak form talepleri listesine eklenir; iletişime geçmeden önce kaynağı doğrulayın.', confirmLabel: 'Ekle' })) { await api.post(`/x/pazar/ogeler/${it.id}/crm`); toast('CRM listesine öneri eklendi', 'ok'); } } }, 'CRM')));
      let cache = items.rows;
      const show = async (refetch) => {
        if (refetch) cache = (await api.get('/x/pazar/ogeler?limit=200')).rows;
        const f = cache.filter((it) => (!filt.country || it.country === filt.country) && (!filt.kind || it.source_kind === filt.kind) && (!filt.cat || it.category === filt.cat));
        const news = f.filter((it) => !official(it)), off = f.filter(official);
        tabsEl.replaceChildren(tabs([['haber', `Sektör Haberleri (${news.length})`], ['resmi', `Kuruluş Duyuruları (${off.length})`], ['rakip', `Rakip Değişiklikleri (${o.changeEvents.length})`], ['trend', `Trendler (${o.trends.length})`], ['kaynak', 'Kaynak Defteri']], tab, (k) => { tab = k; show(); }));
        if (tab === 'kaynak') { left.replaceChildren(spinner()); left.replaceChildren(await sourcesTab(load)); return; }
        if (tab === 'rakip') return left.replaceChildren(o.changeEvents.length ? h('div', {}, o.changeEvents.map((e) => h('div', { class: 'listrow' }, avatar(e.name), h('div', { class: 'grow' }, h('b', {}, `${e.name} sayfasında değişiklik`), h('span', {}, `${e.url} · ${ago(e.ts)}`)), h('a', { class: 'btn secondary sm', href: '#/rakipler' }, 'İncele')))) : empty('Henüz rakip sayfa değişikliği tespit edilmedi. Rakip Analizi sayfasından rakip ekleyin.'));
        if (tab === 'trend') return left.replaceChildren(o.trends.length ? hbars(o.trends.map((t) => ({ label: t.tag, value: t.total })), { color: PALETTE }) : empty('Trend için veri yok; kaynaklardan haber toplandıkça dolar.'));
        const list = tab === 'resmi' ? off : news;
        left.replaceChildren(...(list.length ? list.map(card) : [h('div', { class: 'empty' }, o.sources.total ? 'Bu filtrelerle eşleşen öğe yok.' : 'Henüz kaynak yok — "Kaynak ekle" ile izinli bir RSS adresi ekleyin; örnek veri gösterilmez.')]));
      };
      await show();

      const ideas = panel('İçerik Fikirleri & Fırsatlar', o.ranking.length ? h('div', {}, o.ranking.map((r) => h('div', { class: 'listrow' }, h('div', { class: 'grow' }, h('a', { href: r.canonical_url, target: '_blank', rel: 'noopener noreferrer' }, h('b', {}, r.title)), h('div', { class: 'row wrap', style: 'margin-top:4px' }, ...r.tags.split(',').filter(Boolean).map((t) => chip(t, 'info')), h('span', { class: 'small muted' }, r.source))),
        h('div', { style: 'text-align:center' }, ring(r.relevance, { size: 54, stroke: 6 }), h('div', { class: 'small muted' }, 'Fırsat skoru'))))) : h('div', { class: 'muted small', style: 'padding:8px 0' }, 'İlgili haber geldikçe burada puanlanır (konu anahtar kelime eşleşmesine göre; Google skoru değildir).'), { ic: 'spark' });
      const trendP = panel('Konu Trendleri Zaman İçinde', o.trends.length && o.trends.some((t) => t.total) ? areaChart({ labels: o.labels, series: o.trends.map((t, i) => ({ name: t.tag, color: PALETTE[i], values: t.values })), height: 200, fill: false }) : h('div', { class: 'muted small', style: 'padding:8px 0' }, 'Haber toplandıkça konu etiketlerinin günlük dağılımı burada görünür.'), { ic: 'chart2' });

      root.replaceChildren(pageHead('Pazar ve Medya Takibi', 'Yerli ve global rakipleri, sektör dergilerini, kuruluş duyurularını ve içerik fırsatlarını tek yerden takip edin.', { range: true, onRange: load }), kpis, bar,
        h('div', { class: 'dash-grid' }, h('div', { class: 'span-8' }, h('div', { class: 'card card-pad' }, tabsEl, left)), h('div', { class: 'span-4' }, h('div', { class: 'stack' }, ideas, trendP))),
        infoBox('Yönetmelik/mevzuat haberleri her zaman kaynak, tarih ve doğrulama durumuyla ele alınmalı; özgün içerik üretirken rakip metinleri kopyalamayın. Yalnızca izinli RSS ve herkese açık kaynaklar kullanılır.'));
    } catch (e) { root.replaceChildren(errorBanner(e)); }
  };
  load();
  return root;
};

/* ====================== COMPETITOR ====================== */
const competitorForm = (c, done) => {
  const v = c ?? { name: '', url: '', sector: '', note: '', region: 'TR' };
  const name = h('input', { class: 'input', value: v.name }); const url = h('input', { class: 'input', value: v.url, placeholder: 'https://rakip.com' });
  const sector = h('input', { class: 'input', value: v.sector }); const note = h('textarea', { class: 'textarea', rows: 2 }); note.value = v.note;
  const region = sel([['TR', 'Yerli (Türkiye)'], ['GLOBAL', 'Uluslararası']], v.region ?? 'TR');
  modal({ title: c ? 'Rakibi düzenle' : 'Rakip ekle', body: h('div', { class: 'stack' }, field('Firma adı', name), field('İzlenecek sayfa (ana sayfa veya hizmet sayfası)', url), h('div', { class: 'grid cols-2' }, field('Sektör', sector), field('Bölge', region)), field('Not', note)),
    actions: [{ label: 'Vazgeç', class: 'secondary' }, { label: 'Kaydet', onClick: async () => { try { const b = { name: name.value, url: url.value, sector: sector.value, note: note.value, region: region.value }; await (c ? api.put(`/x/rakipler/${c.id}`, b) : api.post('/x/rakipler', b)); done(); } catch (e) { toast(e.message, 'err'); return false; } } }] });
};

export const renderCompetitors = async (ctx) => {
  ctx.setTitle('Rakip Analizi');
  const root = h('div');
  let sector = '';
  const load = async () => {
    root.replaceChildren(spinner());
    try {
      const o = await api.get(`/x/rakip-ozet?gun=${getRange()}`);
      const changed = o.rows.filter((r) => r.changes > 0).length;
      const kpis = h('div', { class: 'kpis' },
        kpiCard({ ic: 'users', label: 'Takip Edilen Rakipler', scroll: 'Rakip Karşılaştırması', value: o.rows.length, deltaLabel: `${o.rows.filter((r) => r.region !== 'GLOBAL').length} yerli · ${o.rows.filter((r) => r.region === 'GLOBAL').length} uluslararası`, color: '#0b7bd6' }),
        kpiCard({ ic: 'eye', label: 'Sayfa Değişikliği (dönem)', scroll: 'Stratejik Rakip Uyarıları', value: o.changeSeries.reduce((a, b) => a + b, 0), deltaLabel: `${changed} rakipte`, series: o.changeSeries, color: '#f04438', goodUp: false }),
        kpiCard({ ic: 'chart', label: 'Anahtar Kelime Çakışması', to: '/entegrasyonlar', connect: true, color: '#8b5cf6' }),
        kpiCard({ ic: 'doc', label: 'Sıralama Kazanç / Kayıp', to: '/entegrasyonlar', connect: true, color: '#12b76a' }));

      const rowsF = o.rows.filter((r) => !sector || r.sector === sector);
      const secSel = h('div', { class: 'pillsel' }, 'Sektör', h('select', {}, [['', 'Tümü'], ...o.sectors.map((s) => [s, s])].map(([v, l]) => h('option', { value: v, selected: v === sector }, l))));
      secSel.querySelector('select').addEventListener('change', (e) => { sector = e.target.value; load(); });
      const tableOf = (rows, cols) => rows.length ? h('div', { class: 'tbl-wrap' }, h('table', { class: 'tbl' }, h('thead', {}, h('tr', {}, cols.map(([l]) => h('th', {}, l)))), h('tbody', {}, rows.map((r, i) => h('tr', {}, cols.map(([, fn]) => h('td', {}, fn(r, i)))))))) : empty('Rakip eklenmedi.');
      const actions = (c) => h('div', { class: 'row' }, h('button', { class: 'btn secondary sm', onclick: (e) => run(e.target, async () => { const r = await api.post(`/x/rakipler/${c.id}/kontrol`); toast(r.first ? 'İlk ölçüm alındı' : r.changed ? 'Sayfada DEĞİŞİKLİK tespit edildi' : 'Değişiklik yok', r.changed ? 'err' : 'ok'); load(); }) }, 'Kontrol'), h('button', { class: 'btn ghost sm', onclick: () => competitorForm(c, load) }, 'Düzenle'),
        session.user.role === 'admin' ? h('button', { class: 'btn ghost sm', 'aria-label': 'Sil', onclick: async () => { if (await confirmBox({ title: 'Rakip silinsin mi?', message: 'Geçmiş kontroller de silinir.', confirmLabel: 'Sil', danger: true })) { await api.del(`/x/rakipler/${c.id}`); load(); } } }, icon('trash', 14)) : null);
      const cols = [['#', (r, i) => i + 1], ['Rakip', (r) => h('div', { class: 'row' }, avatar(r.name), h('b', {}, r.name))], ['Alan Adı', (r) => h('span', { class: 'mono muted' }, r.url.replace(/^https?:\/\//, ''))], ['Domain Gücü', () => h('span', { class: 'muted', title: 'Lisanslı veri sağlayıcısı gerekir' }, '—')],
        ['Sayfa başlığı', (r) => r.last_title || h('span', { class: 'muted' }, 'henüz ölçülmedi')], ['İçerik hacmi', (r) => (r.words ? `${fmtNum(r.words)} kelime` : '—')], ['Değişim (dönem)', (r) => (r.changes ? chip(`${r.changes} değişiklik`, 'warn') : r.last_check ? chip('Değişmedi', 'ok') : '—')], ['Son kontrol', (r) => (r.last_error ? chip('Hata', 'danger') : r.last_check ? ago(r.last_check) : 'yok')], ['', actions]];
      const compare = panel('Rakip Karşılaştırması', tableOf(rowsF, cols), { ic: 'users', action: h('div', { class: 'row' }, secSel, h('button', { class: 'btn', onclick: () => competitorForm(null, load) }, icon('plus', 16), 'Rakip ekle')) });

      const alerts = [];
      for (const e of o.events) alerts.push(e.changed ? { ic: 'eye', c: '#f79009', t: `${e.name} sayfasında değişiklik tespit edildi`, s: ago(e.ts), to: '/rakipler' } : { ic: 'alert', c: '#f04438', t: `${e.name} izlenemedi`, s: `${e.error} · ${ago(e.ts)}`, to: '/rakipler' });
      for (const r of o.rows.filter((x) => !x.last_check)) alerts.push({ ic: 'search', c: '#0b7bd6', t: `${r.name} henüz ölçülmedi`, s: '"Kontrol" ile ilk ölçümü alın', to: '/rakipler' });
      const alertP = panel('Stratejik Rakip Uyarıları', alerts.length ? h('div', {}, alerts.slice(0, 7).map((a) => h('a', { class: 'listrow', href: `#${a.to}`, style: `--kc:${a.c}` }, h('span', { class: 'lic' }, icon(a.ic, 18)), h('div', { class: 'grow' }, h('b', {}, a.t), h('span', {}, a.s)), icon('chevron', 16)))) : h('div', { class: 'empty' }, 'Uyarı yok.'), { ic: 'spark', action: chip(`${alerts.length} kayıt`, 'info') });

      const gap = panel('İçerik Hacmi Karşılaştırması', o.rows.some((r) => r.words) ? hbars(o.rows.filter((r) => r.words).sort((a, b) => b.words - a.words).map((r) => ({ label: r.name, value: r.words, sub: r.url.replace(/^https?:\/\//, '') })), { color: PALETTE, fmt: (v) => `${fmtNum(v)} kelime` }) : h('div', { class: 'muted small', style: 'padding:8px 0' }, 'Rakip sayfaları kontrol edildikçe içerik hacimleri burada karşılaştırılır.'), { ic: 'doc' });
      const serp = panel('Arama Sonucu Sıralama Takibi', connectBox('Sıralama verisi için lisanslı sağlayıcı gerekli', 'Arama sonucu sıralaması resmi/lisanslı bir veri servisi gerektirir. Bağlanmadıkça sıralama tahmini uydurulmaz.'), { ic: 'chart2' });
      const region = (rg, title, ic2) => panel(title, tableOf(o.rows.filter((r) => (rg === 'TR' ? r.region !== 'GLOBAL' : r.region === 'GLOBAL')), [['#', (r, i) => i + 1], ['Rakip', (r) => h('div', { class: 'row' }, avatar(r.name), r.name)], ['Alan Adı', (r) => h('span', { class: 'mono muted' }, r.url.replace(/^https?:\/\//, ''))], ['Son durum', (r) => (r.last_status ? chip(`HTTP ${r.last_status}`, 'ok') : '—')]]), { ic: ic2 });
      const mostC = panel('En Çok Rekabet Edilen Sayfalar', connectBox('Anahtar kelime verisi gerekli', 'Rakiplerle çakışan sayfalar sıralama/anahtar kelime sağlayıcısı bağlandığında hesaplanır.'), { ic: 'doc' });

      root.replaceChildren(pageHead('Rakip Analizi', 'Yerli ve uluslararası rakiplerinizi analiz edin, stratejik fırsatları keşfedin.', { range: true, onRange: load }), kpis,
        h('div', { class: 'dash-grid' }, h('div', { class: 'span-8' }, compare), h('div', { class: 'span-4' }, alertP),
          h('div', { class: 'span-8' }, serp), h('div', { class: 'span-4' }, gap),
          h('div', { class: 'span-4' }, region('TR', 'Yerli Rakipler', 'users')), h('div', { class: 'span-4' }, region('GLOBAL', 'Uluslararası Rakipler', 'radar')), h('div', { class: 'span-4' }, mostC)),
        infoBox('Yalnızca herkese açık sayfalar izlenir (robots.txt\'e uyulur). Rakibin özel analitiği, trafik rakamları veya sıralamaları gösterilmez; lisanslı veri sağlayıcısı bağlanmadıkça bu metrikler "veri yok" kalır, tahmin uydurulmaz.'));
    } catch (e) { root.replaceChildren(errorBanner(e)); }
  };
  load();
  return root;
};

/* ====================== BACKLINK ====================== */
const BL = { aday: ['Aday', ''], taslak: ['Taslak', ''], onay_bekliyor: ['Onay bekliyor', 'warn'], gonderildi: ['Gönderildi', 'info'], yanitlandi: ['Yanıtlandı', 'info'], kazanildi: ['Kazanıldı (doğrulandı)', 'ok'], reddedildi: ['Reddedildi', 'danger'], kayip: ['Kayıp', 'danger'] };
const blForm = (o, done) => {
  const v = o ?? { name: '', url: '', kind: 'dizin', relevance: 3, risk: 'dusuk', reason: '', status: 'aday', outreach_draft: '', link_url: '' };
  const name = h('input', { class: 'input', value: v.name }); const url = h('input', { class: 'input', value: v.url, placeholder: 'https://…' });
  const kind = sel([['dizin', 'Sektör dizini'], ['yayin', 'Yayın/dergi'], ['dernek', 'Dernek/kurum'], ['referans', 'Referans/kaynakça'], ['diger', 'Diğer']], v.kind);
  const rel = h('input', { class: 'input', type: 'number', min: 1, max: 5, value: v.relevance }); const risk = sel([['dusuk', 'Düşük'], ['orta', 'Orta'], ['yuksek', 'Yüksek']], v.risk);
  const reason = h('textarea', { class: 'textarea', rows: 2 }); reason.value = v.reason;
  const status = sel(Object.entries(BL).filter(([k]) => k !== 'kazanildi' && k !== 'kayip').map(([k, [l]]) => [k, l]), v.status);
  const draft = h('textarea', { class: 'textarea', rows: 6, placeholder: 'Editöre/site sahibine kısa, kişiselleştirilmiş ve dürüst bir not. Toplu/otomatik gönderim yapılmaz; mesajı kendiniz iletirsiniz.' }); draft.value = v.outreach_draft;
  const link = h('input', { class: 'input', value: v.link_url, placeholder: 'AKORT\'a bağlantı veren sayfa (kazanıldıysa)' });
  modal({ title: o ? 'Fırsatı düzenle' : 'Geri Bağlantı fırsatı', wide: true, body: h('div', { class: 'stack' }, h('div', { class: 'grid cols-2' }, field('Ad', name), field('Sayfa adresi', url), field('Tür', kind), field('Durum', status), field('İlgililik (1–5)', rel), field('Risk', risk)), field('Neden ilgili?', reason), field('İletişim taslağı', draft), field('Bağlantı veren sayfa', link, '"Kazanıldı" durumu yalnızca "Doğrula" ile, sayfada AKORT\'a gerçek bir bağlantı bulunursa verilir.')),
    actions: [{ label: 'Vazgeç', class: 'secondary' }, { label: 'Kaydet', onClick: async () => { try { const b = { name: name.value, url: url.value, kind: kind.value, relevance: Number(rel.value), risk: risk.value, reason: reason.value, status: status.value, outreach_draft: draft.value, link_url: link.value }; if (o && (o.status === 'kazanildi' || o.status === 'kayip')) b.status = o.status === 'kazanildi' ? 'gonderildi' : 'kayip'; await (o ? api.put(`/x/backlink/${o.id}`, b) : api.post('/x/backlink', b)); done(); } catch (e) { toast(e.message, 'err'); return false; } } }] });
};

export const renderBacklinks = async (ctx) => {
  ctx.setTitle('Geri Bağlantı Analizi');
  const root = h('div');
  const load = async () => {
    root.replaceChildren(spinner());
    try {
      const d = await api.get('/x/backlink');
      const rows = d.rows, n = getRange();
      const cutoff = Date.now() - n * 86_400_000;
      const within = (s) => s && new Date(String(s).includes('T') ? s : String(s).replace(' ', 'T') + 'Z').getTime() >= cutoff;
      const won = rows.filter((r) => r.status === 'kazanildi');
      const wonNew = won.filter((r) => within(r.verified_at)).length;
      const lost = rows.filter((r) => r.status === 'kayip').length;
      const outreach = rows.filter((r) => ['onay_bekliyor', 'gonderildi', 'yanitlandi'].includes(r.status)).length;
      const kpis = h('div', { class: 'kpis' },
        kpiCard({ ic: 'link', label: 'Toplam Geri Bağlantı Fırsatı', scroll: 'Tüm Fırsatlar', value: rows.length, deltaLabel: `${rows.filter((r) => within(r.created_at)).length} yeni (dönem)`, color: '#0b7bd6' }),
        kpiCard({ ic: 'plus', label: 'Doğrulanmış Geri Bağlantı', scroll: 'Doğrulanmış Yönlendiren Siteler', value: won.length, deltaLabel: `${wonNew} bu dönemde doğrulandı`, color: '#12b76a' }),
        kpiCard({ ic: 'trash', label: 'Kaybedilen Geri Bağlantı', scroll: 'Geri Bağlantı Uyarıları', value: lost, color: '#f04438', goodUp: false }),
        kpiCard({ ic: 'share', label: 'Aktif Erişim', scroll: 'Erişim Hattı', value: outreach, deltaLabel: 'onay/gönderim/yanıt aşamasında', color: '#8b5cf6' }));

      const q3 = { yuksek: rows.filter((r) => r.relevance >= 4 && r.risk !== 'yuksek').length, orta: rows.filter((r) => r.relevance === 3 && r.risk !== 'yuksek').length, dusuk: rows.filter((r) => r.relevance <= 2 && r.risk !== 'yuksek').length, riskli: rows.filter((r) => r.risk === 'yuksek').length };
      const quality = panel('Geri Bağlantı Kalite Dağılımı', donut({ items: [{ label: 'Yüksek Kalite', value: q3.yuksek, color: '#12b76a' }, { label: 'Orta Kalite', value: q3.orta, color: '#f79009' }, { label: 'Düşük Kalite', value: q3.dusuk, color: '#0b7bd6' }, { label: 'Riskli / Spam', value: q3.riskli, color: '#f04438' }], sub: 'fırsat', empty: 'Fırsat eklendikçe dağılım görünür' }), { ic: 'chart' });

      const months = Array.from({ length: 6 }, (_, i) => { const dt = new Date(); dt.setDate(1); dt.setMonth(dt.getMonth() - (5 - i)); return dt.toISOString().slice(0, 7); });
      const cum = (key, pred) => months.map((m) => rows.filter((r) => pred(r) && r[key] && String(r[key]).slice(0, 7) <= m).length);
      const growth = panel('Geri Bağlantı Büyüme Grafiği', areaChart({ labels: months.map((m) => `${m.slice(5)}/${m.slice(2, 4)}`), series: [{ name: 'Toplam fırsat', color: '#8b5cf6', values: cum('created_at', () => true) }, { name: 'Doğrulanmış bağlantı', color: '#0b7bd6', values: cum('verified_at', (r) => r.status === 'kazanildi') }], height: 220 }), { ic: 'chart2', action: chip('Son 6 ay') });

      const al = [];
      for (const r of rows.filter((x) => x.status === 'kayip')) al.push({ ic: 'alert', c: '#f04438', t: `${r.name}: bağlantı kayboldu`, s: r.verified_at ? ago(r.verified_at) : '' });
      for (const r of rows.filter((x) => x.risk === 'yuksek' && x.status !== 'reddedildi')) al.push({ ic: 'shield', c: '#f79009', t: `${r.name}: yüksek risk işaretli`, s: 'Değerlendirin veya reddedin' });
      for (const r of rows.filter((x) => x.status === 'onay_bekliyor')) al.push({ ic: 'mail', c: '#0b7bd6', t: `${r.name}: iletişim onayı bekliyor`, s: 'Taslağı gözden geçirin' });
      for (const r of won.filter((x) => within(x.verified_at))) al.push({ ic: 'check', c: '#12b76a', t: `${r.name}: bağlantı doğrulandı`, s: ago(r.verified_at) });
      const alerts = panel('Geri Bağlantı Uyarıları', al.length ? h('div', {}, al.slice(0, 6).map((a) => h('div', { class: 'listrow', style: `--kc:${a.c}` }, h('span', { class: 'lic' }, icon(a.ic, 18)), h('div', { class: 'grow' }, h('b', {}, a.t), h('span', {}, a.s))))) : h('div', { class: 'empty' }, 'Uyarı yok.'), { ic: 'bell', action: chip(String(al.length), 'info') });

      const strong = panel('Doğrulanmış Yönlendiren Siteler', won.length ? h('div', { class: 'tbl-wrap' }, h('table', { class: 'tbl' }, h('thead', {}, h('tr', {}, ['#', 'Alan adı', 'Tür', 'İlgililik', 'Bağlantı veren sayfa', 'Doğrulama'].map((x) => h('th', {}, x)))),
        h('tbody', {}, won.slice(0, 8).map((r, i) => h('tr', {}, h('td', {}, i + 1), h('td', {}, h('div', { class: 'row' }, avatar(r.name), h('a', { href: r.url, target: '_blank', rel: 'noopener noreferrer' }, new URL(r.url).hostname))), h('td', {}, r.kind), h('td', {}, `${r.relevance}/5`), h('td', { class: 'mono small' }, r.link_url || r.url), h('td', {}, chip(ago(r.verified_at), 'ok'))))))) : h('div', { class: 'muted small', style: 'padding:8px 0' }, 'Henüz doğrulanmış bağlantı yok. Aşağıdaki fırsatlarda "Doğrula" ile bağlantının gerçekten var olduğunu kontrol edin.'), { ic: 'chart', action: h('span', { class: 'small muted' }, 'AKORT\'a gerçek bağlantı bulunan siteler') });

      const risk = panel('Risk Seviyesi Dağılımı', h('div', { class: 'row', style: 'gap:18px;align-items:center' }, h('div', {}, h('div', { style: 'font-size:34px;font-weight:750;color:#f04438' }, q3.riskli), h('div', { class: 'muted small' }, 'Yüksek riskli fırsat'), h('div', { class: 'small muted' }, rows.length ? `Toplamın %${Math.round((q3.riskli / rows.length) * 100)}'i` : '')),
        h('div', { class: 'grow' }, hbars([{ label: 'Yüksek risk', value: rows.filter((r) => r.risk === 'yuksek').length, color: '#f04438' }, { label: 'Orta risk', value: rows.filter((r) => r.risk === 'orta').length, color: '#f79009' }, { label: 'Düşük risk', value: rows.filter((r) => r.risk === 'dusuk').length, color: '#12b76a' }]))), { ic: 'shield' });
      const gap = panel('Bağlantı Boşluğu Fırsatları', connectBox('Rakip geri bağlantı verisi gerekli', 'Rakiplerin bağlantı aldığı siteler lisanslı bir geri bağlantı veri sağlayıcısı gerektirir. Fırsatları elle ekleyebilirsiniz.'), { ic: 'radar' });

      const cols = [['Fırsat', ['aday', 'taslak']], ['İletişim', ['onay_bekliyor', 'gonderildi']], ['Yanıtlandı', ['yanitlandi']], ['Kazanıldı', ['kazanildi']]];
      const pipe = panel('Erişim Hattı', h('div', { class: 'kanban' }, cols.map(([t, sts], i) => { const list = rows.filter((r) => sts.includes(r.status)); return h('div', { class: 'kcol', style: `--kc:${['#0b7bd6', '#8b5cf6', '#f79009', '#12b76a'][i]}` }, h('div', { class: 'kh' }, `+ ${t}`, h('span', {}, String(list.length))),
        ...list.slice(0, 6).map((r) => h('button', { class: 'kitem', onclick: () => blForm(r, load) }, avatar(r.name), h('div', { class: 'grow' }, h('b', {}, r.name), h('span', {}, `${r.relevance}/5 · ${BL[r.status][0]}`)))), list.length ? null : h('div', { class: 'small muted', style: 'padding:6px' }, '—')); })), { ic: 'share', action: h('button', { class: 'btn', onclick: () => blForm(null, load) }, icon('plus', 16), 'Fırsat ekle') });

      const all = panel('Tüm Fırsatlar', rows.length ? h('div', { class: 'tbl-wrap' }, h('table', { class: 'tbl' }, h('thead', {}, h('tr', {}, ['Fırsat', 'Tür', 'İlgililik / risk', 'Durum', ''].map((x) => h('th', {}, x)))),
        h('tbody', {}, rows.map((o) => h('tr', {}, h('td', {}, h('b', {}, o.name), h('div', { class: 'small' }, h('a', { href: o.url, target: '_blank', rel: 'noopener noreferrer' }, o.url)), o.reason ? h('div', { class: 'small muted' }, o.reason) : null), h('td', {}, o.kind), h('td', {}, `${o.relevance}/5 · ${o.risk}`),
          h('td', {}, chip(BL[o.status]?.[0] ?? o.status, BL[o.status]?.[1] ?? ''), o.verified_at ? h('div', { class: 'small muted' }, `Doğrulama: ${fmtDate(o.verified_at)}`) : null),
          h('td', {}, h('div', { class: 'row' }, h('button', { class: 'btn secondary sm', onclick: (e) => run(e.target, async () => { const r = await api.post(`/x/backlink/${o.id}/dogrula`); toast(r.found ? 'Bağlantı bulundu — kazanıldı' : 'Sayfada AKORT bağlantısı bulunamadı', r.found ? 'ok' : 'err'); load(); }) }, 'Doğrula'), h('button', { class: 'btn ghost sm', onclick: () => blForm(o, load) }, 'Düzenle'),
            session.user.role === 'admin' ? h('button', { class: 'btn ghost sm', 'aria-label': 'Sil', onclick: async () => { if (await confirmBox({ title: 'Fırsat silinsin mi?', message: 'Kayıt silinir.', confirmLabel: 'Sil', danger: true })) { await api.del(`/x/backlink/${o.id}`); load(); } } }, icon('trash', 14)) : null))))))) : empty('Henüz fırsat eklenmedi.'), { ic: 'link' });

      root.replaceChildren(pageHead('Geri Bağlantı Analizi', 'Geri Bağlantı keşfi, kalite kontrolü, iletişim (tanıtım yazışması) ve sürekli takip ile otoritenizi güçlendirin.', { range: true, onRange: load }), kpis,
        h('div', { class: 'dash-grid' }, h('div', { class: 'span-4' }, quality), h('div', { class: 'span-5' }, growth), h('div', { class: 'span-3' }, alerts),
          h('div', { class: 'span-8' }, strong), h('div', { class: 'span-4' }, h('div', { class: 'stack' }, risk, gap)),
          h('div', { class: 'span-12' }, pipe), h('div', { class: 'span-12' }, all)),
        infoBox('Satın alma, link çiftliği, otomatik spam veya manipülatif kampanya yok. Harici editör karar vermeden "kazanıldı" denmez; bağlantı gerçekten bulunursa doğrulama ile işaretlenir.'));
    } catch (e) { root.replaceChildren(errorBanner(e)); }
  };
  load();
  return root;
};
