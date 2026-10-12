// Market & Media Intelligence, Rakip İstihbaratı, Backlink Intelligence
import { api, session } from '../api.js';
import { h, icon, chip, toast, spinner, errorBanner, field, modal, confirmBox, fmtDate } from '../ui.js';
import { pageHead, tabs, stat, infoBox, empty } from './x-common.js';
import { kpiCard, donut, hbars, panel } from '../charts.js';

const run = async (btn, fn) => { btn.disabled = true; try { await fn(); } catch (e) { toast(e.message, 'err'); } btn.disabled = false; };
const sel = (opts, value) => h('select', { class: 'select' }, opts.map(([v, l]) => h('option', { value: v, selected: v === value }, l)));

/* ====================== Pazar & Medya ====================== */
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

const marketSources = async () => {
  const d = await api.get('/x/pazar');
  const box = h('div', { class: 'stack' });
  const reload = () => location.reload();
  box.append(
    h('div', { class: 'row wrap' }, h('div', { class: 'grow' }), h('button', { class: 'btn', onclick: () => sourceForm(null, reload) }, icon('plus', 16), 'Kaynak ekle')),
    d.sources.length ? h('div', { class: 'card' }, h('div', { class: 'tbl-wrap' }, h('table', { class: 'tbl' }, h('thead', {}, h('tr', {}, ['Kaynak', 'Kategori', 'Aralık', 'Durum', 'Öğe', ''].map((x) => h('th', {}, x)))),
      h('tbody', {}, d.sources.map((s) => h('tr', {}, h('td', {}, h('b', {}, s.name), h('div', { class: 'small muted' }, s.url), s.license_note ? h('div', { class: 'small' }, `Lisans: ${s.license_note}`) : null),
        h('td', {}, `${s.category} · ${s.country}/${s.lang}`), h('td', {}, `${s.interval_min} dk`),
        h('td', {}, s.last_error ? chip('Hata', 'danger') : s.last_success ? chip('Çalışıyor', 'ok') : chip('Henüz çekilmedi', 'warn'), s.enabled ? null : chip('Pasif'), s.last_error ? h('div', { class: 'small', style: 'color:var(--danger)' }, s.last_error) : null, s.last_success ? h('div', { class: 'small muted' }, `Son başarılı: ${fmtDate(s.last_success)}`) : null),
        h('td', {}, s.items),
        h('td', {}, h('div', { class: 'row' }, h('button', { class: 'btn secondary sm', onclick: (e) => run(e.target, async () => { const r = await api.post(`/x/pazar/kaynaklar/${s.id}/cek`); toast(r.notModified ? 'Değişiklik yok' : `${r.added} yeni, ${r.skipped} yinelenen/atlanan`, 'ok'); reload(); }) }, 'Şimdi çek'), h('button', { class: 'btn ghost sm', onclick: () => sourceForm(s, reload) }, 'Düzenle'),
          session.user.role === 'admin' ? h('button', { class: 'btn ghost sm', 'aria-label': 'Sil', onclick: async () => { if (await confirmBox({ title: 'Kaynak silinsin mi?', message: 'Kaynağa ait toplanan öğeler de silinir.', confirmLabel: 'Sil', danger: true })) { await api.del(`/x/pazar/kaynaklar/${s.id}`); reload(); } } }, icon('trash', 14)) : null)))))))) : empty('Henüz kaynak yok. İzinli bir RSS adresi ekleyin; sahte örnek veri gösterilmez.'),
    d.jobs.length ? h('div', { class: 'card' }, h('div', { class: 'card-head' }, h('h3', {}, 'Zamanlanmış işler (son 30)')), h('table', { class: 'tbl' }, h('tbody', {}, d.jobs.slice(0, 10).map((j) => h('tr', {}, h('td', {}, j.type), h('td', {}, j.state), h('td', {}, `${j.attempts} deneme`), h('td', { class: 'small muted' }, j.last_error ?? '')))))) : null);
  return box;
};

const marketItems = async () => {
  const d = await api.get('/x/pazar'); // trendler
  const list = h('div', { class: 'stack' });
  const search = h('input', { class: 'input', type: 'search', placeholder: 'Başlık veya özette ara…' });
  const status = sel([['', 'Tüm durumlar'], ['yeni', 'Yeni'], ['ilgili', 'İlgili'], ['fikir', 'Fikir'], ['elendi', 'Elendi']], '');
  const minRel = sel([['0', 'Tüm ilgililik'], ['20', '≥ 20'], ['40', '≥ 40'], ['60', '≥ 60']], '0');
  const load = async () => {
    list.replaceChildren(spinner());
    try {
      const r = await api.get(`/x/pazar/ogeler?durum=${status.value}&min=${minRel.value}&ara=${encodeURIComponent(search.value)}`);
      list.replaceChildren(...(r.rows.length ? r.rows.map((it) => h('div', { class: 'card card-pad stack' },
        h('div', { class: 'row wrap' }, h('a', { href: it.canonical_url, target: '_blank', rel: 'noopener noreferrer', class: 'grow' }, h('b', {}, it.title)), chip(`İlgililik ${it.relevance}`, it.relevance >= 40 ? 'ok' : ''), ...it.tags.split(',').filter(Boolean).map((t) => chip(t, 'info'))),
        it.summary ? h('div', { class: 'small' }, it.summary) : null,
        h('div', { class: 'small muted' }, `Kaynak: ${it.source} · Yayın: ${it.published_at ? fmtDate(it.published_at) : '—'} · Tespit: ${fmtDate(it.fetched_at)} · Yöntem: ${it.method.toUpperCase()}${it.license_note ? ` · Lisans: ${it.license_note}` : ''}`),
        h('div', { class: 'row wrap' }, ...[['ilgili', 'İlgili'], ['fikir', 'İçerik fikri'], ['elendi', 'Ele']].map(([k, l]) => h('button', { class: `btn ${it.status === k ? '' : 'secondary'} sm`, onclick: async () => { await api.patch(`/x/pazar/ogeler/${it.id}`, { status: k }); load(); } }, l)),
          h('button', { class: 'btn secondary sm', onclick: async () => { if (await confirmBox({ title: 'CRM\'e öneri olarak ekle?', message: 'Doğrulanmamış bir fırsat önerisi olarak form talepleri listesine eklenir; iletişime geçmeden önce kaynağı doğrulayın.', confirmLabel: 'Ekle' })) { await api.post(`/x/pazar/ogeler/${it.id}/crm`); toast('CRM listesine öneri eklendi', 'ok'); } } }, 'CRM fırsat önerisi')))) : [empty('Eşleşen öğe yok. Kaynaklar sekmesinden bir RSS ekleyip "Şimdi çek" deyin.')]));
    } catch (e) { list.replaceChildren(errorBanner(e)); }
  };
  for (const el of [status, minRel]) el.addEventListener('change', load);
  let t; search.addEventListener('input', () => { clearTimeout(t); t = setTimeout(load, 300); });
  load();
  return h('div', { class: 'stack' },
    d.trending.length ? h('div', { class: 'card card-pad row wrap' }, h('b', {}, 'Son 30 gün konu dağılımı:'), ...d.trending.map((t2) => chip(`${t2.tag} · ${t2.n}`, 'info'))) : null,
    infoBox('Yönetmelik/mevzuat içeren haberler her zaman kaynak, tarih ve doğrulama durumuyla ele alınmalı; özgün içerik üretirken rakip metinleri kopyalamayın.'),
    h('div', { class: 'grid cols-3' }, search, status, minRel), list);
};

export const renderMarket = async (ctx) => {
  ctx.setTitle('Market & Media Intelligence');
  const body = h('div');
  const show = async (k) => { body.replaceChildren(spinner()); try { body.replaceChildren(await (k === 'oge' ? marketItems : marketSources)()); } catch (e) { body.replaceChildren(errorBanner(e)); } };
  const el = h('div', {}, pageHead('Market & Media Intelligence', 'İzinli RSS/resmî kaynaklardan sektör haberleri; yinelenenler birleştirilir, kaynak bağlantısı korunur.'), tabs([['oge', 'Haber ve fırsatlar'], ['kaynak', 'Kaynak defteri']], 'oge', show), body);
  show('oge');
  return el;
};

/* ====================== Rakip İstihbaratı ====================== */
const competitorForm = (c, done) => {
  const v = c ?? { name: '', url: '', sector: '', note: '' };
  const name = h('input', { class: 'input', value: v.name }); const url = h('input', { class: 'input', value: v.url, placeholder: 'https://rakip.com' });
  const sector = h('input', { class: 'input', value: v.sector }); const note = h('textarea', { class: 'textarea', rows: 2 }); note.value = v.note;
  modal({ title: c ? 'Rakibi düzenle' : 'Rakip ekle', body: h('div', { class: 'stack' }, field('Firma adı', name), field('İzlenecek sayfa (ana sayfa veya hizmet sayfası)', url), field('Sektör', sector), field('Not', note)),
    actions: [{ label: 'Vazgeç', class: 'secondary' }, { label: 'Kaydet', onClick: async () => { try { const b = { name: name.value, url: url.value, sector: sector.value, note: note.value }; await (c ? api.put(`/x/rakipler/${c.id}`, b) : api.post('/x/rakipler', b)); done(); } catch (e) { toast(e.message, 'err'); return false; } } }] });
};
export const renderCompetitors = async (ctx) => {
  ctx.setTitle('Competitor Intelligence');
  let d;
  try { d = await api.get('/x/rakipler'); } catch (e) { return errorBanner(e); }
  const reload = () => location.reload();
  return h('div', { class: 'stack' }, pageHead('Competitor Intelligence', 'Herkese açık rakip sayfalarının değişim takibi (robots.txt\'e uyulur).', h('button', { class: 'btn', onclick: () => competitorForm(null, reload) }, icon('plus', 16), 'Rakip ekle')),
    infoBox('Yalnızca herkese açık sayfalar izlenir. Rakibin özel analitiği, trafik rakamları veya sıralamaları bu modülde gösterilmez; lisanslı SERP/backlink veri sağlayıcısı bağlanmadıkça bu metrikler "veri yok" kalır, tahmin uydurulmaz.'),
    d.rows.length ? h('div', { class: 'card' }, h('div', { class: 'tbl-wrap' }, h('table', { class: 'tbl' }, h('thead', {}, h('tr', {}, ['Rakip', 'Son kontrol', 'Durum', 'Son değişiklik', ''].map((x) => h('th', {}, x)))),
      h('tbody', {}, d.rows.map((c) => h('tr', {}, h('td', {}, h('b', {}, c.name), h('div', { class: 'small muted' }, c.url), c.sector ? chip(c.sector) : null), h('td', {}, c.last_check ? fmtDate(c.last_check) : 'Henüz kontrol edilmedi'),
        h('td', {}, c.last_error ? chip('Hata', 'danger') : c.last_status ? chip(`HTTP ${c.last_status}`, 'ok') : chip('—'), c.last_error ? h('div', { class: 'small', style: 'color:var(--danger)' }, c.last_error) : null, c.last_title ? h('div', { class: 'small muted' }, c.last_title) : null),
        h('td', {}, c.last_change ? chip(fmtDate(c.last_change), 'warn') : '—'),
        h('td', {}, h('div', { class: 'row' }, h('button', { class: 'btn secondary sm', onclick: (e) => run(e.target, async () => { const r = await api.post(`/x/rakipler/${c.id}/kontrol`); toast(r.first ? 'İlk ölçüm alındı' : r.changed ? 'Sayfada DEĞİŞİKLİK tespit edildi' : 'Değişiklik yok', r.changed ? 'err' : 'ok'); reload(); }) }, 'Şimdi kontrol et'), h('button', { class: 'btn ghost sm', onclick: () => competitorForm(c, reload) }, 'Düzenle'),
          session.user.role === 'admin' ? h('button', { class: 'btn ghost sm', 'aria-label': 'Sil', onclick: async () => { if (await confirmBox({ title: 'Rakip silinsin mi?', message: 'Geçmiş kontroller de silinir.', confirmLabel: 'Sil', danger: true })) { await api.del(`/x/rakipler/${c.id}`); reload(); } } }, icon('trash', 14)) : null)))))))) : empty('Henüz rakip eklenmedi.'));
};

/* ====================== Backlink ====================== */
const BL = { aday: ['Aday', ''], taslak: ['Taslak', ''], onay_bekliyor: ['Onay bekliyor', 'warn'], gonderildi: ['Gönderildi', 'info'], kazanildi: ['Kazanıldı (doğrulandı)', 'ok'], reddedildi: ['Reddedildi', 'danger'], kayip: ['Kayıp', 'danger'] };
const blForm = (o, done) => {
  const v = o ?? { name: '', url: '', kind: 'dizin', relevance: 3, risk: 'dusuk', reason: '', status: 'aday', outreach_draft: '', link_url: '' };
  const name = h('input', { class: 'input', value: v.name }); const url = h('input', { class: 'input', value: v.url, placeholder: 'https://…' });
  const kind = sel([['dizin', 'Sektör dizini'], ['yayin', 'Yayın/dergi'], ['dernek', 'Dernek/kurum'], ['referans', 'Referans/kaynakça'], ['diger', 'Diğer']], v.kind);
  const rel = h('input', { class: 'input', type: 'number', min: 1, max: 5, value: v.relevance }); const risk = sel([['dusuk', 'Düşük'], ['orta', 'Orta'], ['yuksek', 'Yüksek']], v.risk);
  const reason = h('textarea', { class: 'textarea', rows: 2 }); reason.value = v.reason;
  const status = sel(Object.entries(BL).filter(([k]) => k !== 'kazanildi' && k !== 'kayip').map(([k, [l]]) => [k, l]), v.status);
  const draft = h('textarea', { class: 'textarea', rows: 6, placeholder: 'Editöre/site sahibine kısa, kişiselleştirilmiş ve dürüst bir not. Toplu/otomatik gönderim yapılmaz; mesajı kendiniz iletirsiniz.' }); draft.value = v.outreach_draft;
  const link = h('input', { class: 'input', value: v.link_url, placeholder: 'AKORT\'a bağlantı veren sayfa (kazanıldıysa)' });
  modal({ title: o ? 'Fırsatı düzenle' : 'Backlink fırsatı', wide: true, body: h('div', { class: 'stack' }, h('div', { class: 'grid cols-2' }, field('Ad', name), field('Sayfa adresi', url), field('Tür', kind), field('Durum', status), field('İlgililik (1–5)', rel), field('Risk', risk)), field('Neden ilgili?', reason), field('İletişim taslağı', draft), field('Bağlantı veren sayfa', link, '"Kazanıldı" durumu yalnızca "Doğrula" ile, sayfada AKORT\'a gerçek bir bağlantı bulunursa verilir.')),
    actions: [{ label: 'Vazgeç', class: 'secondary' }, { label: 'Kaydet', onClick: async () => { try { const b = { name: name.value, url: url.value, kind: kind.value, relevance: Number(rel.value), risk: risk.value, reason: reason.value, status: status.value, outreach_draft: draft.value, link_url: link.value }; if (o && (o.status === 'kazanildi' || o.status === 'kayip')) b.status = o.status === 'kazanildi' ? 'gonderildi' : 'kayip'; await (o ? api.put(`/x/backlink/${o.id}`, b) : api.post('/x/backlink', b)); done(); } catch (e) { toast(e.message, 'err'); return false; } } }] });
};
export const renderBacklinks = async (ctx) => {
  ctx.setTitle('Backlink Intelligence');
  let d;
  try { d = await api.get('/x/backlink'); } catch (e) { return errorBanner(e); }
  const reload = () => location.reload();
  const won = d.rows.filter((r) => r.status === 'kazanildi').length;
  return h('div', { class: 'stack' }, pageHead('Backlink Intelligence', 'İzinli, ilgili ve doğal bağlantı fırsatları; kalite kontrolü ve elle onaylı iletişim.', h('button', { class: 'btn', onclick: () => blForm(null, reload) }, icon('plus', 16), 'Fırsat ekle')),
    infoBox('Satın alma, link çiftliği, otomatik spam veya manipülatif kampanya yok. Harici editör karar vermeden "kazanıldı" denmez; bağlantı gerçekten bulunursa doğrulama ile işaretlenir. Lisanslı backlink veri servisi bağlı değil: kendi sitenize gelen bağlantılar otomatik keşfedilmez.'),
    h('div', { class: 'kpis' }, kpiCard({ ic: 'link', label: 'Toplam fırsat', value: d.rows.length, color: '#3b82f6' }), kpiCard({ ic: 'check', label: 'Doğrulanmış bağlantı', value: won, color: '#10b981' }), kpiCard({ ic: 'shield', label: 'Onay bekliyor', value: d.rows.filter((r) => r.status === 'onay_bekliyor').length, color: '#f59e0b', goodUp: false }), kpiCard({ ic: 'alert', label: 'Kayıp bağlantı', value: d.rows.filter((r) => r.status === 'kayip').length, color: '#ef4444', goodUp: false })),
    d.rows.length ? panel('Durum dağılımı', donut({ items: Object.entries(BL).map(([k, [l]], i) => ({ label: l, value: d.rows.filter((r) => r.status === k).length, color: ['#64748b', '#8b5cf6', '#f59e0b', '#3b82f6', '#10b981', '#ef4444', '#ec4899'][i] })).filter((x) => x.value), sub: 'fırsat' }), { ic: 'link' }) : null,
    d.rows.length ? h('div', { class: 'card' }, h('div', { class: 'tbl-wrap' }, h('table', { class: 'tbl' }, h('thead', {}, h('tr', {}, ['Fırsat', 'Tür', 'İlgililik / risk', 'Durum', ''].map((x) => h('th', {}, x)))),
      h('tbody', {}, d.rows.map((o) => h('tr', {}, h('td', {}, h('b', {}, o.name), h('div', { class: 'small' }, h('a', { href: o.url, target: '_blank', rel: 'noopener noreferrer' }, o.url)), o.reason ? h('div', { class: 'small muted' }, o.reason) : null), h('td', {}, o.kind), h('td', {}, `${o.relevance}/5 · ${o.risk}`),
        h('td', {}, chip(BL[o.status]?.[0] ?? o.status, BL[o.status]?.[1] ?? ''), o.verified_at ? h('div', { class: 'small muted' }, `Doğrulama: ${fmtDate(o.verified_at)}`) : null),
        h('td', {}, h('div', { class: 'row' }, h('button', { class: 'btn secondary sm', onclick: (e) => run(e.target, async () => { const r = await api.post(`/x/backlink/${o.id}/dogrula`); toast(r.found ? 'Bağlantı bulundu — kazanıldı' : 'Sayfada AKORT bağlantısı bulunamadı', r.found ? 'ok' : 'err'); reload(); }) }, 'Doğrula'), h('button', { class: 'btn ghost sm', onclick: () => blForm(o, reload) }, 'Düzenle'),
          session.user.role === 'admin' ? h('button', { class: 'btn ghost sm', 'aria-label': 'Sil', onclick: async () => { if (await confirmBox({ title: 'Fırsat silinsin mi?', message: 'Kayıt silinir.', confirmLabel: 'Sil', danger: true })) { await api.del(`/x/backlink/${o.id}`); reload(); } } }, icon('trash', 14)) : null)))))))) : empty('Henüz fırsat eklenmedi.'));
};
