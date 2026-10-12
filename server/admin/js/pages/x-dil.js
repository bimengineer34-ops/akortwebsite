// İngilizce Yayın: yayınlanan sayfaların İngilizce sürümü (/en) — mod, ilerleme, sayfa durumu, sözlük, çeviri hafızası
import { api, session } from '../api.js';
import { h, icon, chip, toast, spinner, errorBanner, field, modal, confirmBox, debounce, fmtDate } from '../ui.js';
import { kpiCard, panel, fmtNum } from '../charts.js';
import { pageHead, infoBox, connectBox, empty } from './x-common.js';

const STC = { otomatik: ['Otomatik', 'info'], onayli: ['Onaylı', 'ok'], elle: ['Elle', 'ok'], hata: ['Hata', 'danger'] };
const tagsHint = 'Kaynaktaki <1>, </1>, <2/> gibi etiketler aynen korunmalıdır.';

const editRow = (r, done) => {
  const ta = h('textarea', { class: 'textarea', rows: 6 }); ta.value = r.en;
  modal({ title: 'Çeviriyi düzenle', wide: true, body: h('div', { class: 'stack' }, field('Türkçe kaynak', h('div', { class: 'ai-sum', style: 'white-space:pre-wrap' }, r.src)), field('İngilizce çeviri', ta, tagsHint), r.error ? infoBox(`Son hata: ${r.error}`, 'warn') : null),
    actions: [{ label: 'Vazgeç', class: 'secondary' }, { label: 'Kaydet', onClick: async () => { try { await api.put(`/x/dil/hafiza/${r.hash}`, { en: ta.value }); toast('Kaydedildi (elle)', 'ok'); done(); } catch (e) { toast(e.data?.error ?? e.message, 'err'); return false; } } },
      { label: 'Kaydet ve Onayla', onClick: async () => { try { await api.put(`/x/dil/hafiza/${r.hash}`, { en: ta.value, approve: true }); toast('Onaylandı', 'ok'); done(); } catch (e) { toast(e.data?.error ?? e.message, 'err'); return false; } } }] });
};

export const renderDil = async (ctx) => {
  ctx.setTitle('İngilizce Yayın');
  const root = h('div', {}, spinner());
  let poll = null;
  const stopPoll = () => { clearInterval(poll); poll = null; };
  const load = async () => {
    try {
      const d = await api.get('/x/dil');
      const admin = session.user.role === 'admin';
      const on = d.mode === 'otomatik';
      const last = d.last;
      const published = last?.published ?? 0, total = last?.total ?? 0;
      const kpis = h('div', { class: 'kpis' },
        kpiCard({ ic: 'share', label: 'İngilizce Yayın', scroll: 'İngilizce Yayın Modu', value: on ? 'Açık' : 'Kapalı', deltaLabel: on ? 'yayınlananlar otomatik çevrilir' : 'etkinleştirilmedi', color: on ? '#12b76a' : '#a8aaae' }),
        kpiCard({ ic: 'doc', label: 'İngilizce Sayfa Yayında', scroll: 'Sayfa Durumu', value: published, deltaLabel: total ? `${total} Türkçe sayfadan` : 'henüz üretilmedi', color: '#0b7bd6', target: total || null }),
        kpiCard({ ic: 'archive', label: 'Çeviri Hafızası', scroll: 'Çeviri Hafızası', value: d.tm.toplam, deltaLabel: `${d.tm.otomatik} otomatik · ${d.tm.onayli + d.tm.elle} insan onaylı`, color: '#8b5cf6' }),
        kpiCard({ ic: 'alert', label: 'Bekleyen / Hatalı Metin', scroll: 'Çeviri İşi', value: (last?.missingCount ?? 0), deltaLabel: d.tm.hata ? `${d.tm.hata} metin çevrilemedi` : 'çevrilmeyi bekleyen metin', color: '#f79009', goodUp: false }));

      // mod paneli
      const provSel = h('select', { class: 'select' }, d.connected.length ? d.connected.map((p) => h('option', { value: p.id, selected: p.id === d.provider }, `${p.label} · ${p.model}`)) : [h('option', { value: '' }, 'Bağlı sağlayıcı yok')]);
      const estBox = h('div', { class: 'small muted' }, 'Tahmin hesaplanıyor…');
      api.get('/x/dil/tahmin').then((e) => { estBox.textContent = e.segments ? `Çevrilecek: ${fmtNum(e.segments)} metin parçası (~${fmtNum(e.chars)} karakter, tahmini ${fmtNum(e.tokens)} token). İlk çeviri birkaç dakika sürer; sonraki yayınlarda yalnızca yeni/değişen metinler çevrilir.` : 'Çevrilecek yeni metin yok.'; }).catch(() => { estBox.textContent = ''; });
      const modeP = panel('İngilizce Yayın Modu', h('div', { class: 'stack' },
        h('p', {}, 'Açıkken, Türkçe sitede yayınladığınız her değişikliğin İngilizcesi de ', h('b', {}, '/en'), ' adresinde otomatik yayınlanır. Metinler yapay zekâ ile çevrilir, çeviri hafızasında saklanır; aşağıdan düzeltip onaylayabilirsiniz. Elle düzenlediğiniz çeviriler asla ezilmez.'),
        d.connected.length || d.fake ? null : connectBox('Çeviri için AI sağlayıcısı bağlı değil', 'Entegrasyonlar sayfasından OpenAI, Claude veya Gemini anahtarı ekleyin.'),
        field('Çeviri sağlayıcısı', provSel), estBox,
        h('div', { class: 'row wrap' }, on
          ? h('button', { class: 'btn danger secondary', disabled: !admin, onclick: async () => { if (!(await confirmBox({ title: 'İngilizce yayın kapatılsın mı?', message: '/en sayfaları kaldırılır ve dil anahtarı gizlenir. Çeviri hafızası korunur.', confirmLabel: 'Kapat', danger: true }))) return; await api.put('/x/dil/ayar', { mode: 'kapali' }); toast('İngilizce yayın kapatıldı', 'ok'); load(); } }, 'Kapat')
          : h('button', { class: 'btn', disabled: !admin || (!d.connected.length && !d.fake), onclick: async () => { if (!(await confirmBox({ title: 'İngilizce yayın etkinleştirilsin mi?', message: 'Sitenizdeki tüm metinler seçili AI sağlayıcısına gönderilerek çevrilir (API kullanımı/maliyeti oluşur). Korumalı belge içermeyen herkese açık site metinleri gönderilir.', confirmLabel: 'Etkinleştir ve Çevir' }))) return; try { await api.put('/x/dil/ayar', { mode: 'otomatik', provider: provSel.value }); toast('Etkinleştirildi — çeviri arka planda başladı', 'ok'); load(); } catch (e) { toast(e.message, 'err'); } } }, icon('rocket', 16), 'Etkinleştir ve Çevir'),
          on ? h('button', { class: 'btn secondary', disabled: !admin, onclick: async () => { await api.put('/x/dil/ayar', { provider: provSel.value }); toast('Sağlayıcı kaydedildi', 'ok'); } }, 'Sağlayıcıyı Kaydet') : null,
          admin ? null : h('span', { class: 'small muted' }, 'Ayarı yalnızca yönetici değiştirebilir'))), { ic: 'share' });

      // iş paneli
      const j = d.job;
      const pct = j.total ? Math.round(((j.done + j.failed) / j.total) * 100) : 0;
      const jobP = panel('Çeviri İşi', h('div', { class: 'stack' },
        j.running ? h('div', {}, h('div', { class: 'row' }, h('b', { class: 'grow' }, `Aşama: ${j.phase}`), h('span', { class: 'small muted' }, `${j.done}/${j.total} metin${j.failed ? ` · ${j.failed} hata` : ''}`)), h('div', { class: 'progress-bar' }, h('i', { style: `width:${pct}%;background:#0b7bd6` })))
          : h('div', { class: 'small muted' }, j.finishedAt ? `Son iş: ${fmtDate(j.finishedAt)}${j.error ? ` — ${j.error}` : ' — tamamlandı'}` : 'Çalışan iş yok.'),
        j.error && !j.running ? infoBox(j.error, 'warn') : null,
        h('div', { class: 'row wrap' },
          h('button', { class: 'btn', disabled: !admin || !on || j.running, onclick: async () => { try { const r = await api.post('/x/dil/cevir'); toast(r.started ? 'Çeviri başladı' : `Başlatılamadı: ${r.reason}`, r.started ? 'ok' : 'err'); load(); } catch (e) { toast(e.message, 'err'); } } }, icon('history', 16), 'Eksikleri Şimdi Çevir'),
          h('button', { class: 'btn secondary', disabled: !on, onclick: async (e) => { e.target.disabled = true; try { const r = await api.post('/x/dil/uret'); toast(`${r.published}/${r.total} sayfa İngilizce yayında`, 'ok'); load(); } catch (er) { toast(er.message, 'err'); e.target.disabled = false; } } }, 'EN Sayfaları Yeniden Üret'))), { ic: 'bolt', sub: 'Yayından sonra eksik metinler otomatik çevrilir' });

      // sayfa listesi
      const pages = (last?.pages ?? []).map(([url, tot, miss, st]) => ({ url, tot, miss, st })).sort((a, b) => b.miss - a.miss || a.url.localeCompare(b.url));
      const pagesP = panel('Sayfa Durumu', pages.length ? h('div', { class: 'tbl-wrap', style: 'max-height:380px;overflow:auto' }, h('table', { class: 'tbl' }, h('thead', {}, h('tr', {}, ['Sayfa', 'Metin', 'Eksik', 'Durum'].map((x) => h('th', {}, x)))),
        h('tbody', {}, pages.map((p) => h('tr', {}, h('td', { class: 'mono' }, p.url), h('td', {}, p.tot), h('td', {}, p.miss || '—'), h('td', {}, p.st === 1 ? h('a', { href: p.url === '/' ? '/en' : `/en${p.url}`, target: '_blank', rel: 'noopener' }, chip('Yayında', 'ok')) : p.st === 2 ? chip('Eski sürüm (güncelleniyor)', 'warn') : chip('Çeviri bekliyor', 'warn'))))))) : empty(on ? 'Henüz üretim yapılmadı — "Eksikleri Şimdi Çevir" veya bir yayın yapın.' : 'İngilizce yayın kapalı.'), { ic: 'doc', sub: last?.at ? `Son üretim: ${fmtDate(last.at)}` : '' });

      // sözlük
      const keep = h('textarea', { class: 'textarea', rows: 6 }); keep.value = d.glossary.keep.join('\n');
      const map = h('textarea', { class: 'textarea', rows: 6, placeholder: 'Mühendislik Danışmanlığı = Engineering Consulting' }); map.value = Object.entries(d.glossary.map).map(([k, v]) => `${k} = ${v}`).join('\n');
      const gl = panel('Sözlük', h('div', { class: 'stack' }, field('Çevrilmeyecek terimler (her satıra bir tane)', keep, 'Marka adı, BIM, MEP gibi terimler olduğu gibi kalır.'), field('Sabit çeviriler (TÜRKÇE = İNGİLİZCE)', map, 'Değişiklik yalnızca yeni çevrilecek metinleri etkiler; mevcutları hafızadan düzeltin.'),
        h('button', { class: 'btn secondary', style: 'justify-self:start', disabled: !admin, onclick: async () => { const m = {}; for (const ln of map.value.split('\n')) { const i = ln.indexOf('='); if (i > 0) m[ln.slice(0, i).trim()] = ln.slice(i + 1).trim(); } try { await api.put('/x/dil/ayar', { glossary: { keep: keep.value.split('\n'), map: m } }); toast('Sözlük kaydedildi', 'ok'); } catch (e) { toast(e.message, 'err'); } } }, 'Sözlüğü Kaydet')), { ic: 'edit' });

      // çeviri hafızası
      const tmBody = h('div'); let status = '', search = '', offset = 0;
      const sSel = h('select', { class: 'select' }, [['', 'Tümü'], ['otomatik', 'Otomatik'], ['elle', 'Elle'], ['onayli', 'Onaylı'], ['hata', 'Hatalı']].map(([v, l]) => h('option', { value: v }, l)));
      const sInp = h('input', { class: 'input', type: 'search', placeholder: 'Türkçe veya İngilizce metinde ara…' });
      const drawTm = async () => {
        tmBody.replaceChildren(spinner());
        try {
          const r = await api.get(`/x/dil/hafiza?durum=${status}&ara=${encodeURIComponent(search)}&limit=25&offset=${offset}`);
          tmBody.replaceChildren(r.rows.length ? h('div', {}, h('div', { class: 'tbl-wrap' }, h('table', { class: 'tbl' }, h('thead', {}, h('tr', {}, ['Türkçe', 'İngilizce', 'Durum', ''].map((x) => h('th', {}, x)))),
            h('tbody', {}, r.rows.map((x) => h('tr', {}, h('td', { style: 'max-width:300px' }, x.src.length > 160 ? `${x.src.slice(0, 160)}…` : x.src), h('td', { style: 'max-width:300px' }, x.en ? (x.en.length > 160 ? `${x.en.slice(0, 160)}…` : x.en) : h('span', { class: 'muted' }, x.error ?? '—')), h('td', {}, chip(STC[x.status]?.[0] ?? x.status, STC[x.status]?.[1] ?? '')),
              h('td', {}, h('div', { class: 'row' }, h('button', { class: 'btn secondary sm', onclick: () => editRow(x, drawTm) }, 'Düzenle'), admin ? h('button', { class: 'btn ghost sm', 'aria-label': 'Sil (yeniden çevrilir)', title: 'Sil — bir sonraki çeviride yeniden çevrilir', onclick: async () => { await api.del(`/x/dil/hafiza/${x.hash}`); drawTm(); } }, icon('trash', 14)) : null))))))),
            h('div', { class: 'row', style: 'margin-top:10px' }, h('span', { class: 'small muted grow' }, `${offset + 1}–${Math.min(offset + 25, r.total)} / ${r.total}`), h('button', { class: 'btn secondary sm', disabled: offset === 0, onclick: () => { offset = Math.max(0, offset - 25); drawTm(); } }, 'Önceki'), h('button', { class: 'btn secondary sm', disabled: offset + 25 >= r.total, onclick: () => { offset += 25; drawTm(); } }, 'Sonraki'))) : empty('Kayıt yok.'));
        } catch (e) { tmBody.replaceChildren(errorBanner(e)); }
      };
      sSel.addEventListener('change', () => { status = sSel.value; offset = 0; drawTm(); });
      sInp.addEventListener('input', debounce(() => { search = sInp.value; offset = 0; drawTm(); }, 300));
      const tm = panel('Çeviri Hafızası', h('div', { class: 'stack' }, h('div', { class: 'grid cols-2' }, sInp, sSel), tmBody), { ic: 'archive', sub: 'Her Türkçe metnin İngilizcesi burada saklanır; düzenlenen/onaylanan çeviriler korunur' });

      root.replaceChildren(pageHead('İngilizce Yayın (EN)', 'Yayınladığınız sayfaların İngilizce sürümü otomatik oluşturulur ve /en altında yayınlanır.', { crumbs: 'Settings › İngilizce Yayın' }), kpis,
        h('div', { class: 'dash-grid' }, h('div', { class: 'span-6' }, modeP), h('div', { class: 'span-6' }, jobP), h('div', { class: 'span-7' }, pagesP), h('div', { class: 'span-5' }, gl), h('div', { class: 'span-12' }, tm)),
        infoBox('Çeviriler yapay zekâ ile üretilir; teknik/mevzuat içeren metinleri yayımlamadan önce gözden geçirip onaylamanız önerilir. Tüm metni çevrilmemiş bir sayfa İngilizce olarak yayınlanmaz (karışık dilli sayfa oluşmaz). Sayfa adresleri (slug) Türkçe kalır: /en/hizmetler/bim.'));
      drawTm();
      stopPoll();
      if (j.running) poll = setInterval(() => { if (!document.body.contains(root)) return stopPoll(); load(); }, 3000);
    } catch (e) { root.replaceChildren(errorBanner(e)); }
  };
  load();
  return root;
};
