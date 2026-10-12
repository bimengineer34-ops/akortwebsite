// SEO Intelligence: teknik tarama, canlı SEO editörü (SERP önizleme + açıklanabilir puan), hız raporu
import { api } from '../api.js';
import { h, icon, chip, debounce, toast, spinner, errorBanner, field, fmtDate } from '../ui.js';
import { pageHead, tabs, stat, scoreChip, infoBox, needConn, empty } from './x-common.js';
import { kpiCard, donut, hbars, panel } from '../charts.js';

/* ---------- canlı analiz (yerel, anlık; Google skoru DEĞİL) ---------- */
const fold = (s) => String(s ?? '').toLocaleLowerCase('tr').replace(/[^\p{L}\p{N}\s-]/gu, ' ');
export const analyze = ({ title, description, slug, focus, body, hasCover }) => {
  const checks = [];
  const add = (group, ok, label, tip) => checks.push({ group, ok, label, tip });
  const f = fold(focus).trim();
  const T = fold(title), D = fold(description), B = fold(body);
  const words = B.split(/\s+/).filter(Boolean).length;
  add('seo', title.length >= 30 && title.length <= 60, `Başlık uzunluğu 30–60 (şu an ${title.length})`, 'Çok uzun başlıklar arama sonuçlarında kesilir.');
  add('seo', description.length >= 120 && description.length <= 160, `Açıklama uzunluğu 120–160 (şu an ${description.length})`, 'Açıklama tıklamayı etkiler; eylem çağrısı ekleyin.');
  if (f) {
    add('seo', T.includes(f), 'Odak sorgu başlıkta geçiyor', 'Odak ifadeyi başlığın başına yakın kullanın.');
    add('seo', D.includes(f), 'Odak sorgu açıklamada geçiyor', 'Açıklamada doğal biçimde bir kez geçsin.');
    add('seo', fold(slug).includes(f.replace(/\s+/g, '-')) || f.split(/\s+/).every((w) => fold(slug).includes(w)), 'Odak sorgu adreste (slug) geçiyor', 'Kısa ve anlamlı bir adres kullanın.');
    const first = B.split(/\s+/).slice(0, 120).join(' ');
    add('seo', first.includes(f), 'Odak sorgu ilk paragrafta geçiyor', 'İlk 100 kelimede konuyu belirtin.');
    const n = f ? B.split(f).length - 1 : 0;
    const dens = words ? (n * f.split(/\s+/).length * 100) / words : 0;
    add('seo', dens > 0 && dens <= 3, `Anahtar kelime yoğunluğu %${dens.toFixed(1)} (hedef ≤ %3)`, 'Aşırı tekrar spam sayılabilir.');
  } else add('seo', false, 'Odak sorgu girilmemiş', 'Sayfanın hedeflediği ana aramayı yazın.');
  add('okunabilirlik', words >= 300, `İçerik uzunluğu ${words} kelime (≥ 300 önerilir)`, 'Konuyu yeterince kapsayın; uzatmak için tekrar etmeyin.');
  const sentences = String(body).split(/[.!?]+\s/).filter((s) => s.trim());
  const avg = sentences.length ? words / sentences.length : 0;
  add('okunabilirlik', avg > 0 && avg <= 22, `Ortalama cümle uzunluğu ${avg.toFixed(1)} kelime (≤ 22)`, 'Uzun cümleleri bölün.');
  const heads = (String(body).match(/^#{2,3}\s/gm) ?? []).length;
  add('okunabilirlik', heads >= 2 || words < 300, `Ara başlık sayısı ${heads}`, 'Metni H2/H3 ile bölümlendirin.');
  const links = (String(body).match(/\]\((\/[^)]*)\)/g) ?? []).length;
  add('teknik', links >= 1, `İç bağlantı sayısı ${links}`, 'İlgili hizmet/yazılara bağlantı verin.');
  add('teknik', /^[a-z0-9-]+$/.test(slug) && slug.length <= 70, 'Adres (slug) küçük harf, rakam ve tire içeriyor', 'Türkçe karakter ve boşluk kullanmayın.');
  add('görsel', !!hasCover, 'Kapak görseli seçili', 'Her içerik için bir kapak görseli ve alt metin önerilir.');
  const score = (g) => {
    const c = checks.filter((x) => x.group === g);
    return c.length ? Math.round((c.filter((x) => x.ok).length / c.length) * 100) : 100;
  };
  return { checks, scores: { seo: score('seo'), okunabilirlik: score('okunabilirlik'), teknik: score('teknik'), görsel: score('görsel') } };
};

/* ---------- teknik tarama ---------- */
const scanTab = async () => {
  const box = h('div', { class: 'stack' });
  const load = async (force) => {
    box.replaceChildren(spinner('Site taranıyor…'));
    try {
      const d = await api.get(`/x/seo/tarama${force ? '?yenile=1' : ''}`);
      if (!d.siteDir) return box.replaceChildren(infoBox('Henüz derlenmiş site yok. "Yayınla" ile siteyi derleyin.', 'warn'));
      const worst = d.pages.filter((p) => p.issues.length).slice(0, 40);
      box.replaceChildren(
        h('div', { class: 'kpis' }, kpiCard({ ic: 'doc', label: 'Taranan sayfa', value: d.total, color: '#3b82f6' }), kpiCard({ ic: 'search', label: 'Ortalama teknik puan', value: d.avgScore, unit: '/100', color: '#10b981', target: 90 }), kpiCard({ ic: 'alert', label: 'Hata', value: d.errors, color: '#ef4444', goodUp: false }), kpiCard({ ic: 'eye', label: 'Uyarı', value: d.warnings, color: '#f59e0b', goodUp: false })),
        h('div', { class: 'dash-grid' },
          h('div', { class: 'span-4' }, panel('Puan dağılımı', donut({ items: [{ label: 'İyi (≥85)', value: d.pages.filter((p) => p.score >= 85).length, color: '#10b981' }, { label: 'Orta (60–84)', value: d.pages.filter((p) => p.score >= 60 && p.score < 85).length, color: '#f59e0b' }, { label: 'Zayıf (<60)', value: d.pages.filter((p) => p.score < 60).length, color: '#ef4444' }], sub: 'sayfa' }), { ic: 'search' })),
          h('div', { class: 'span-8' }, panel('En sık görülen sorunlar', hbars(Object.entries(d.pages.flatMap((p) => p.issues).reduce((m, [, t]) => { const k = t.replace(/[0-9]+/g, 'N').replace(/https?:\/\/\S+/, 'URL'); m[k] = (m[k] ?? 0) + 1; return m; }, {})).sort((a, b) => b[1] - a[1]).slice(0, 7).map(([label, value]) => ({ label, value })), { color: '#f59e0b', empty: 'Hiç sorun bulunmadı' }), { ic: 'alert' }))),
        infoBox(d.notes.join(' ')),
        h('div', { class: 'grid cols-2' },
          h('div', { class: 'card card-pad stack' }, h('h3', {}, 'Sitemap ve robots'),
            h('div', {}, `Sitemap URL sayısı: `, h('b', {}, d.sitemap.urls)),
            d.sitemap.indexableNotInSitemap.length ? infoBox(`Sitemap'te olmayan indekslenebilir sayfalar: ${d.sitemap.indexableNotInSitemap.join(', ')}`, 'warn') : chip('Tüm indekslenebilir sayfalar sitemap\'te', 'ok'),
            d.sitemap.orphans.length ? infoBox(`Sitemap'te olup sayfası bulunmayan: ${d.sitemap.orphans.join(', ')}`, 'warn') : null,
            h('div', { class: 'row wrap' }, chip(d.robots.present ? 'robots.txt var' : 'robots.txt yok', d.robots.present ? 'ok' : 'danger'), chip(d.robots.hasSitemapLine ? 'Sitemap satırı var' : 'Sitemap satırı yok', d.robots.hasSitemapLine ? 'ok' : 'warn'), chip(d.robots.adminBlocked ? '/yonetim engelli' : '/yonetim engelli değil', d.robots.adminBlocked ? 'ok' : 'warn'))),
          h('div', { class: 'card card-pad stack' }, h('h3', {}, 'Yinelenen başlık / açıklama'),
            d.duplicateTitles.length || d.duplicateDescriptions.length
              ? h('ul', {}, [...d.duplicateTitles.map((x) => h('li', {}, `Başlık: "${x.value}" → ${x.urls.join(', ')}`)), ...d.duplicateDescriptions.map((x) => h('li', {}, `Açıklama (${x.urls.join(', ')})`))])
              : chip('Yinelenen başlık veya açıklama yok', 'ok'))),
        h('div', { class: 'card' },
          h('div', { class: 'card-head' }, h('h3', {}, `Sorunlu sayfalar (${worst.length})`), h('button', { class: 'btn secondary sm', onclick: () => load(true) }, icon('history', 14), 'Yeniden tara')),
          worst.length
            ? h('div', { class: 'tbl-wrap' }, h('table', { class: 'tbl' }, h('thead', {}, h('tr', {}, ['Sayfa', 'Puan', 'Bulgular'].map((x) => h('th', {}, x)))),
              h('tbody', {}, worst.map((p) => h('tr', {}, h('td', {}, h('a', { href: p.url, target: '_blank', rel: 'noopener' }, p.url), p.noindex ? h('div', {}, chip('noindex')) : null), h('td', {}, scoreChip(p.score)), h('td', {}, h('ul', { style: 'margin:0;padding-left:16px' }, p.issues.map(([k, t]) => h('li', {}, chip(k === 'err' ? 'Hata' : 'Uyarı', k === 'err' ? 'danger' : 'warn'), ' ', t)))))))))
            : empty('Hiç sorun bulunmadı.')),
        h('div', { class: 'small muted' }, `Tarama zamanı: ${fmtDate(d.scannedAt)}`));
    } catch (e) { box.replaceChildren(errorBanner(e)); }
  };
  await load(false);
  return box;
};

/* ---------- canlı editör ---------- */
const serp = (title, description, url) =>
  h('div', { class: 'card card-pad', style: 'max-width:640px' },
    h('div', { class: 'small muted' }, url),
    h('div', { style: 'color:#1a0dab;font-size:19px;line-height:1.3;margin:2px 0' }, (title || 'Başlık yok').slice(0, 62) + (title.length > 62 ? '…' : '')),
    h('div', { style: 'color:#4d5156;font-size:13.5px' }, (description || 'Açıklama yok').slice(0, 162) + (description.length > 162 ? '…' : '')));

const editorTab = async () => {
  const wrap = h('div', { class: 'stack' });
  let list;
  try { list = (await api.get('/x/seo/girdiler')).rows; } catch (e) { return errorBanner(e); }
  if (!list.length) return empty('Düzenlenecek blog yazısı veya proje yok.');
  const sel = h('select', { class: 'select' }, list.map((r) => h('option', { value: `${r.kind}/${r.slug}` }, `${r.kind === 'blog' ? 'Blog' : 'Proje'} · ${r.title}${r.draft ? ' (taslak)' : ''}`)));
  const area = h('div', { class: 'stack' });
  const open = async () => {
    area.replaceChildren(spinner());
    const [kind, slug] = sel.value.split('/');
    try {
      const e = await api.get(`/x/seo/girdi/${kind}/${slug}`);
      const d = e.data;
      const seo = d.seo ?? {};
      const title = h('input', { class: 'input', value: seo.title ?? '', placeholder: d.title, maxlength: 70 });
      const desc = h('textarea', { class: 'textarea', rows: 3, maxlength: 170 }); desc.value = seo.description ?? d.description ?? d.summary ?? '';
      const focus = h('input', { class: 'input', value: e.focus, placeholder: 'ör. hastane BIM koordinasyonu', maxlength: 120 });
      const noindex = h('input', { type: 'checkbox', checked: !!seo.noindex });
      const preview = h('div'); const scores = h('div', { class: 'grid cols-4' }); const list2 = h('div', { class: 'stack' });
      const recalc = () => {
        const effTitle = title.value || d.title || '';
        const a = analyze({ title: effTitle, description: desc.value, slug, focus: focus.value, body: e.body, hasCover: !!d.cover });
        preview.replaceChildren(serp(effTitle, desc.value, `${location.origin.replace(/^https?:\/\//, '')}/${kind === 'blog' ? 'blog' : 'projeler'}/${slug}`));
        scores.replaceChildren(...Object.entries(a.scores).map(([k, v]) => h('div', { class: 'card stat' }, h('b', {}, `${v}`), h('span', {}, { seo: 'SEO', okunabilirlik: 'Okunabilirlik', teknik: 'Teknik', görsel: 'Görsel SEO' }[k]))));
        list2.replaceChildren(h('ul', { style: 'margin:0;padding:0;list-style:none;display:grid;gap:6px' }, a.checks.map((c) => h('li', { class: 'row' }, chip(c.ok ? '✓' : '!', c.ok ? 'ok' : 'warn'), h('span', {}, c.label, c.ok ? null : h('span', { class: 'muted' }, ` — ${c.tip}`))))));
      };
      const live = debounce(recalc, 150);
      for (const el of [title, desc, focus]) el.addEventListener('input', live);
      area.replaceChildren(
        infoBox(`Bu puanlar açıklanabilir yerel kontrollerdir; Google sıralama skoru değildir. Kayıt yapılınca değişiklik taslak olarak içeriğe işlenir, sitede görünmesi için "Yayınla" gerekir.`),
        h('div', { class: 'grid cols-2' },
          h('div', { class: 'stack' },
            field('Odak sorgu', focus, 'Bu sayfanın hedeflediği ana arama ifadesi (yalnızca panelde saklanır).'),
            field('SEO başlığı', title, 'Boşsa sayfa başlığı kullanılır.'),
            field('Meta açıklama', desc),
            h('label', { class: 'switch' }, noindex, h('i'), h('span', {}, 'Arama motorlarından gizle (noindex)')),
            h('button', { class: 'btn', onclick: async (ev) => {
              ev.target.disabled = true;
              try { await api.put(`/x/seo/girdi/${kind}/${slug}`, { title: title.value, description: desc.value, noindex: noindex.checked, focus: focus.value }); toast('SEO bilgileri kaydedildi (yayınlayınca sitede görünür)', 'ok'); } catch (er) { toast(er.message, 'err'); }
              ev.target.disabled = false;
            } }, 'Kaydet')),
          h('div', { class: 'stack' }, h('h3', {}, 'Google arama önizlemesi (tahmini)'), preview, h('div', { class: 'small muted' }, 'Gerçek görünüm Google tarafından belirlenir; görsel gösterimi garanti edilemez.'))),
        scores, list2);
      recalc();
    } catch (er) { area.replaceChildren(errorBanner(er)); }
  };
  sel.addEventListener('change', open);
  wrap.append(field('İçerik seçin', sel), area);
  await open();
  return wrap;
};

/* ---------- hız ---------- */
const speedTab = async () => {
  const d = await api.get('/x/seo/hiz');
  if (!d.available) return infoBox('Derlenmiş site bulunamadı.', 'warn');
  const kb = (n) => (n > 1024 ? `${(n / 1024).toFixed(1)} MB` : `${n} KB`);
  return h('div', { class: 'stack' },
    infoBox('Bu sayfa derlenmiş site dosyalarının GERÇEK ağırlığını ölçer. Core Web Vitals (alan verisi) için Search Console/PageSpeed bağlantısı gerekir; sentetik ve alan verisi ayrı tutulur.'),
    h('div', { class: 'grid cols-4' }, stat(d.html.count, `HTML sayfa · ort. ${d.html.avgKb} KB`), stat(kb(d.js.totalKb), `JavaScript (${d.js.count} dosya)`), stat(kb(d.css.totalKb), `CSS (${d.css.count} dosya)`), stat(kb(d.images.totalKb), `Görsel (${d.images.count} dosya, ${d.images.modern} modern biçim)`)),
    h('div', { class: 'card' }, h('div', { class: 'card-head' }, h('h3', {}, 'En ağır dosyalar')),
      h('table', { class: 'tbl' }, h('tbody', {}, d.heavyAssets.map((f) => h('tr', {}, h('td', { class: 'mono' }, f.file), h('td', {}, kb(f.kb))))))),
    h('div', { class: 'card card-pad stack' }, h('h3', {}, 'Önbellek stratejisi'), h('p', {}, d.caching.static), h('p', {}, d.caching.adminNoStore)),
    needConn(`CDN: ${d.cdn.reason}`), needConn(`Alan verisi (CrUX/RUM): ${d.cwv.reason}`));
};

export const renderSeo = async (ctx) => {
  ctx.setTitle('SEO Intelligence');
  const body = h('div');
  const show = async (k) => {
    body.replaceChildren(spinner());
    try { body.replaceChildren(k === 'tarama' ? await scanTab() : k === 'editor' ? await editorTab() : await speedTab()); } catch (e) { body.replaceChildren(errorBanner(e)); }
  };
  const el = h('div', {}, pageHead('SEO Intelligence ve Hız', 'Derlenmiş siteyi gerçek verilerle tarar; canlı SEO editörü ve hız ölçümü içerir.'), tabs([['tarama', 'Teknik tarama'], ['editor', 'Canlı SEO editörü'], ['hiz', 'Hız motoru']], 'tarama', show), body);
  show('tarama');
  return el;
};
