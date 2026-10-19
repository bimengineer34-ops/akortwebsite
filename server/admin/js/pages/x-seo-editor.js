// Canlı SEO Editörü (referans düzeni): temel bilgiler, içerik editörü, SEO skoru + halkalar, Google/mobil önizleme, öneriler, AI öneriler, iç bağlantı, görsel SEO
import { api } from '../api.js';
import { h, icon, chip, debounce, toast, spinner, errorBanner } from '../ui.js';
import { ring, panel } from '../charts.js';
import { pageHead, connectBox, infoBox } from './x-common.js';
import { analyze } from './x-seo.js';
import { openMediaPicker } from './media.js';
import { createRichEditor } from '../richtext.js';

const ctr = (el, max) => { const c = h('span', { class: 'cnt' }); const f = () => { c.textContent = `${el.value.length}/${max}`; c.classList.toggle('over', el.value.length > max); }; el.addEventListener('input', f); f(); return c; };
const fld = (label, control, counter, hint) => h('label', { class: 'field' }, h('div', { class: 'row' }, h('span', { class: 'lbl grow' }, label), counter ?? null), control, hint ? h('span', { class: 'hint' }, hint) : null);
const closeness = (len, lo, hi) => (len === 0 ? 0 : len >= lo && len <= hi ? 100 : len < lo ? Math.round((len / lo) * 100) : Math.max(0, Math.round(100 - ((len - hi) / hi) * 100)));

/** Liste: tüm blog/proje girdileri ve her birinin yerel SEO skoru */
export const renderSeoEditorList = async (ctx) => {
  ctx.setTitle('Canlı SEO Editörü');
  const root = h('div', {}, pageHead('Canlı SEO Editörü', 'Sayfa, blog ve proje içeriklerinizi gerçek zamanlı olarak optimize edin.', { crumbs: 'SEO Intelligence › Canlı SEO Editörü' }), spinner());
  try {
    const list = (await api.get('/x/seo/girdiler')).rows;
    const rows = await Promise.all(list.map(async (r) => {
      try {
        const e = await api.get(`/x/seo/girdi/${r.kind}/${r.slug}`);
        const d = e.data;
        const a = analyze({ title: d.seo?.title || d.title || '', description: d.seo?.description || d.description || d.summary || '', slug: r.slug, focus: e.focus, body: e.body, hasCover: !!d.cover });
        const avg = Math.round((a.scores.seo + a.scores.okunabilirlik + a.scores.teknik + a.scores['görsel']) / 4);
        return { ...r, avg, focus: e.focus };
      } catch { return { ...r, avg: 0, focus: '' }; }
    }));
    root.lastChild.replaceWith(h('div', { class: 'card' }, h('div', { class: 'tbl-wrap' }, h('table', { class: 'tbl' }, h('thead', {}, h('tr', {}, ['İçerik', 'Tür', 'Odak sorgu', 'SEO skoru', 'Durum', ''].map((x) => h('th', {}, x)))),
      h('tbody', {}, rows.map((r) => h('tr', { class: 'clickable', onclick: () => ctx.nav(`/seo/editor/${r.kind}/${r.slug}`) }, h('td', {}, h('b', {}, r.title)), h('td', {}, r.kind === 'blog' ? 'Blog' : 'Proje'), h('td', {}, r.focus || h('span', { class: 'muted' }, 'tanımsız')),
        h('td', {}, chip(String(r.avg), r.avg >= 80 ? 'ok' : r.avg >= 55 ? 'warn' : 'danger')), h('td', {}, r.draft ? chip('Taslak', 'warn') : chip('Yayında', 'ok')), h('td', {}, h('span', { class: 'btn secondary sm' }, 'Düzenle')))))))));
  } catch (e) { root.lastChild.replaceWith(errorBanner(e)); }
  return root;
};

export const renderSeoEditor = async (ctx, kind, slug) => {
  ctx.setTitle('Canlı SEO Editörü');
  const root = h('div', {}, spinner());
  try {
    const [e, links, ai] = await Promise.all([api.get(`/x/seo/girdi/${kind}/${slug}`), api.get(`/x/seo/ic-baglanti/${kind}/${slug}`).catch(() => ({ rows: [] })), api.get('/x/ai').catch(() => ({ providers: [] }))]);
    const d = e.data, seo = d.seo ?? {};
    const siteHost = (e.siteUrl || location.origin).replace(/^https?:\/\//, '');
    const base = kind === 'blog' ? 'blog' : 'projeler';
    const h1 = h('input', { class: 'input', value: d.title ?? '', maxlength: 120 });
    const seoTitle = h('input', { class: 'input', value: seo.title ?? '', placeholder: d.title ?? '', maxlength: 70 });
    const desc = h('textarea', { class: 'textarea', rows: 3, maxlength: 170 }); desc.value = seo.description ?? d.description ?? d.summary ?? '';
    const focus = h('input', { class: 'input', value: e.focus, maxlength: 100, placeholder: 'ör. endüstriyel sürdürülebilirlik' });
    const noindex = h('input', { type: 'checkbox', checked: !!seo.noindex });
    const body = createRichEditor({ value: e.body ?? '', minHeight: 380, pickMedia: () => openMediaPicker({ type: 'image' }) }); // textarea benzeri yüzey: value / input olayı
    const dirtyDot = h('span', { class: 'dotc', style: 'background:#12b76a' });
    const savedTxt = h('span', {}, 'Kayıtlı');
    let dirty = false;

    const wc = h('span', {});

    const scoreBox = h('div'), serpBox = h('div'), mobBox = h('div'), recBox = h('div');
    const recalc = () => {
      const T = seoTitle.value || h1.value;
      const a = analyze({ title: T, description: desc.value, slug, focus: focus.value, body: body.value, hasCover: !!d.cover });
      const words = body.value.trim().split(/\s+/).filter(Boolean).length;
      wc.textContent = `Kelime sayısı: ${words}   |   Okuma süresi: ${Math.max(1, Math.round(words / 200))} dk`;
      const kw = a.checks.filter((c) => c.group === 'seo' && /Odak|anahtar|yoğunluk/i.test(c.label));
      const kwScore = kw.length ? Math.round((kw.filter((c) => c.ok).length / kw.length) * 100) : 0;
      const sub = { 'Okunabilirlik': a.scores.okunabilirlik, 'Teknik SEO': a.scores.teknik, 'Anahtar Kelime': kwScore, 'Başlık Uzunluğu': closeness(T.length, 40, 60), 'Meta Açıklama': closeness(desc.value.length, 120, 160) };
      const overall = Math.round(Object.values(sub).reduce((x, y) => x + y, 0) / 5);
      const lvl = overall >= 80 ? ['İyi Seviye', 'Küçük iyileştirmelerle mükemmel seviyeye ulaşabilirsiniz.'] : overall >= 55 ? ['Orta Seviye', 'Aşağıdaki önerileri uygulayarak skoru yükseltin.'] : ['Zayıf', 'Temel SEO alanları eksik; önerileri uygulayın.'];
      scoreBox.replaceChildren(h('div', { class: 'row', style: 'gap:18px;align-items:center;flex-wrap:wrap' }, ring(overall, { size: 130, sub: '/100', label: 'SEO skoru' }), h('div', { style: 'min-width:150px;flex:1' }, h('h3', { style: `color:${overall >= 80 ? '#12b76a' : overall >= 55 ? '#f79009' : '#f04438'}` }, lvl[0]), h('p', { class: 'muted small' }, lvl[1]))),
        h('div', { class: 'scoreRings', style: 'margin-top:12px' }, Object.entries(sub).map(([k, v]) => h('div', { class: 'mini-ring' }, h('div', {}, k), ring(v, { size: 62, stroke: 7 }), h('div', { style: `color:${v >= 80 ? '#12b76a' : v >= 55 ? '#f79009' : '#f04438'};font-weight:700;margin-top:2px` }, v >= 80 ? 'İyi' : v >= 55 ? 'Orta' : 'Zayıf')))));
      const url = `${siteHost} › ${base} › ${slug}`;
      serpBox.replaceChildren(h('div', { class: 'serp' }, h('div', { class: 'serp-url' }, h('span', { class: 'serp-fav' }, 'A'), h('div', {}, h('b', {}, siteHost), h('div', {}, url))), h('div', { class: 'serp-title' }, T.slice(0, 62) + (T.length > 62 ? '…' : '')), h('div', { class: 'serp-desc' }, desc.value.slice(0, 162) + (desc.value.length > 162 ? '…' : ''))));
      mobBox.replaceChildren(h('div', { class: 'phone' }, h('div', { class: 'phone-bar' }, siteHost), h('div', { class: 'serp-title', style: 'font-size:16px' }, T.slice(0, 60)), h('div', { class: 'serp-desc', style: 'font-size:12.5px' }, desc.value.slice(0, 120) + (desc.value.length > 120 ? '…' : ''))));
      const fix = { 'Odak': () => focus.focus(), 'açıklama': () => desc.focus(), 'Başlık': () => seoTitle.focus(), 'İç bağlantı': () => { body.focus(); } };
      const act = (c) => Object.entries(fix).find(([k]) => c.label.includes(k));
      recBox.replaceChildren(...a.checks.map((c) => h('div', { class: 'rec' }, h('span', { class: `recic ${c.ok ? 'ok' : c.group === 'seo' ? 'bad' : 'mid'}` }, icon(c.ok ? 'check' : 'alert', 14)), h('div', { class: 'grow' }, c.label, c.ok ? null : h('div', { class: 'small muted' }, c.tip)),
        !c.ok && act(c) ? h('button', { class: 'btn secondary sm', onclick: act(c)[1] }, 'Düzelt') : null)));
      dirty = true; dirtyDot.style.background = '#f79009'; savedTxt.textContent = 'Kaydedilmemiş değişiklik';
    };
    const live = debounce(recalc, 150);
    for (const el of [h1, seoTitle, desc, focus, body]) el.addEventListener('input', live);

    const doSave = async (goPublish) => {
      try {
        await api.put(`/x/seo/girdi/${kind}/${slug}`, { h1: h1.value, seoTitle: seoTitle.value, description: desc.value, noindex: noindex.checked, focus: focus.value, body: body.value });
        dirty = false; dirtyDot.style.background = '#12b76a'; savedTxt.textContent = `Taslak kaydedildi ${new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}`;
        toast('Kaydedildi — sitede görünmesi için "Yayınla" gerekir', 'ok');
        if (goPublish) ctx.nav('/yayin');
      } catch (er) { toast(er.data?.errors?.join(' · ') || er.message, 'err'); }
    };
    ctx.setLeaveGuard(() => !dirty || confirm('Kaydedilmemiş değişiklikler var. Sayfadan ayrılmak istiyor musunuz?'));

    // AI SEO önerileri (yalnızca bağlı sağlayıcı varsa)
    const connected = (ai.providers ?? []).filter((p) => p.connected);
    const aiBox = h('div');
    const parseAi = (txt, kindKey) => [...txt.matchAll(new RegExp(`${kindKey}\\s*\\d*\\s*:\\s*(.+)`, 'gi'))].map((m2) => m2[1].trim());
    let aiTab = 'BAŞLIK';
    const drawAi = (items) => {
      aiBox.replaceChildren(h('div', { class: 'tabs2' }, ['BAŞLIK', 'AÇIKLAMA'].map((k) => h('button', { 'aria-selected': String(k === aiTab), onclick: () => { aiTab = k; drawAi(items); } }, k === 'BAŞLIK' ? 'Alternatif Başlıklar' : 'Alternatif Meta Açıklamalar'))),
        items ? h('div', {}, parseAi(items, aiTab).map((t) => h('label', { class: 'rec', style: 'cursor:pointer' }, h('input', { type: 'radio', name: 'aisel', onchange: () => { if (aiTab === 'BAŞLIK') seoTitle.value = t; else desc.value = t; seoTitle.dispatchEvent(new Event('input')); } }), h('div', { class: 'grow' }, t), chip(String(t.length))))) : h('p', { class: 'muted small' }, 'Üretmek için "Yenile"ye basın (seçili sağlayıcıya metnin başı gönderilir).'));
    };
    const aiPanel = connected.length
      ? panel('AI SEO Önerileri', aiBox, { ic: 'spark', action: h('button', { class: 'btn secondary sm', onclick: async (ev) => { ev.target.disabled = true; try { const r = await api.post('/x/ai/uret', { provider: connected[0].id, task: 'meta-oneri', text: `Başlık: ${h1.value}\n\n${body.value.slice(0, 2500)}`, focus: focus.value }); drawAi(r.output); } catch (er) { toast(er.message, 'err'); } ev.target.disabled = false; } }, 'Yenile') })
      : panel('AI SEO Önerileri', connectBox('Yapay zekâ bağlı değil', 'Alternatif başlık ve meta açıklama önerileri için bir AI sağlayıcısı bağlayın.'), { ic: 'spark' });
    if (connected.length) drawAi(null);

    const linkPanel = panel('İç Bağlantı Önerileri', links.rows.length ? h('div', {}, links.rows.map((l) => h('div', { class: 'listrow' }, h('span', { class: 'lic' }, icon('doc', 16)), h('div', { class: 'grow' }, h('b', {}, l.title), h('span', { class: 'mono' }, l.url)),
      h('button', { class: 'btn secondary sm', onclick: () => { body.insertMarkdown(`[${l.title}](${l.url})`); toast('Bağlantı imlecin olduğu yere eklendi', 'ok'); } }, 'Ekle')))) : h('div', { class: 'muted small', style: 'padding:6px 0' }, 'Şu an önerilecek ilgili sayfa bulunamadı.'), { ic: 'link' });
    const cover = d.cover ? String(d.cover).split('/').pop() : '';
    const imgPanel = panel('Görsel SEO (Öne Çıkan Görsel)', h('div', {},
      h('div', { class: 'stat-row' }, h('span', { class: 'grow' }, 'Dosya adı'), cover ? h('span', { class: 'mono' }, cover) : chip('Kapak yok', 'warn')),
      h('div', { class: 'stat-row' }, h('span', { class: 'grow' }, 'Alt metin'), d.coverAlt ? h('span', { class: 'small' }, d.coverAlt) : chip(d.cover ? 'Eksik' : '—', d.cover ? 'danger' : '')),
      h('div', { class: 'row wrap', style: 'margin-top:8px' }, chip('Schema Uyumlu', d.cover ? 'ok' : ''), chip('Open Graph uyumlu', d.cover ? 'ok' : ''), chip('Kapak için Blog düzenleyicisini kullanın'))), { ic: 'image' });

    root.replaceChildren(
      pageHead('Canlı SEO Editörü', 'Sayfa, blog ve hizmet içeriklerinizi gerçek zamanlı olarak optimize edin.', { crumbs: 'SEO Intelligence › Canlı SEO Editörü' }),
      h('div', { class: 'card ebar' }, h('a', { class: 'btn secondary sm', href: '#/seo/editor' }, icon('chevron', 14), 'İçerik Listesine Dön'), h('span', { class: 'muted' }, `${kind === 'blog' ? 'Blog' : 'Proje'} › ${d.title}`),
        h('div', { class: 'grow' }), dirtyDot, savedTxt,
        h('a', { class: 'btn secondary', href: `/${base}/${slug}`, target: '_blank', rel: 'noopener' }, icon('eye', 16), 'Önizle'), h('button', { class: 'btn secondary', onclick: () => doSave(false) }, icon('doc', 16), 'Taslak Kaydet'), h('button', { class: 'btn', onclick: () => doSave(true) }, icon('rocket', 16), 'Kaydet ve Yayına Git')),
      h('div', { class: 'editor-cols' },
        h('div', { class: 'stack' },
          panel('Temel Bilgiler', h('div', { class: 'stack' }, fld('Başlık (H1) *', h1, ctr(h1, 70)), fld('Meta Başlık (Title)', seoTitle, ctr(seoTitle, 60), 'Boşsa H1 kullanılır.'), fld('Meta Açıklama (Description)', desc, ctr(desc, 160)),
            h('div', { class: 'grid cols-2' }, fld('URL Slug (değiştirilemez)', h('input', { class: 'input', value: `/${base}/${slug}`, readOnly: true })), fld('Odak Anahtar Kelime *', focus, ctr(focus, 100))),
            h('label', { class: 'switch' }, noindex, h('i'), h('span', {}, 'Arama motorlarından gizle (noindex)'))), { ic: 'doc' }),
          panel('İçerik Editörü', h('div', { class: 'stack' }, body.el, h('div', { class: 'small muted' }, wc)), { ic: 'edit' })),
        h('div', { class: 'stack' },
          panel('SEO Analiz Skoru', scoreBox, { ic: 'shield' }),
          h('div', { class: 'grid cols-2' }, panel('Google Önizleme', serpBox, { ic: 'search' }), panel('Mobil Önizleme', mobBox, { ic: 'eye' })),
          panel('SEO Önerileri', recBox, { ic: 'check' }), aiPanel, linkPanel, imgPanel)),
      infoBox('Skorlar açıklanabilir yerel kontrollerdir; Google sıralama skoru değildir. Kayıt taslak olarak işlenir, sitede görünmesi için "Yayınla" gerekir.'));
    recalc();
    dirty = false; dirtyDot.style.background = '#12b76a'; savedTxt.textContent = 'Kayıtlı';
  } catch (er) { root.replaceChildren(errorBanner(er)); }
  return root;
};
