// AI Content Studio — referans düzeni: sağlayıcı kartları, konu/prompt, editör, SEO + marka sesi skoru, öneriler, hashtag, görsel önizleme, prompt iyileştirme.
// Üretilen metin düz metin olarak gösterilir; siz kabul edene kadar hiçbir içeriğe kaydedilmez. Skorlar kural tabanlıdır (Google/marka onayı değildir).
import { api } from '../api.js';
import { h, icon, chip, toast, spinner, errorBanner, debounce } from '../ui.js';
import { ring, panel } from '../charts.js';
import { pageHead, infoBox, connectBox } from './x-common.js';
import { analyze } from './x-seo.js';
import { openMediaPicker } from './media.js';
import { createRichEditor } from '../richtext.js';

const TYPES = [['blog', 'Blog Yazısı', 'Başlık + giriş + ara başlıklı bölümler içeren Markdown blog yazısı yaz.'], ['sosyal', 'Sosyal Medya Gönderisi', 'Platforma uygun kısa, etkileyici bir sosyal medya gönderisi yaz; sonda 3-5 hashtag öner.'], ['hizmet', 'Hizmet Sayfası Metni', 'Hizmet sayfası için kapsam, fayda ve süreç anlatan bölümler yaz.'], ['proje', 'Proje Anlatımı (örnek senaryo)', 'Gerçek müşteri, rakam, konum veya tarih UYDURMADAN genel bir örnek senaryo anlat.'], ['meta', 'Meta Açıklama ve Başlık', 'Verilen konu için SEO başlığı (≤60) ve meta açıklaması (120-160) öner.']];
const TONES = [['Profesyonel ve bilgilendirici', 'Profesyonel & Bilgilendirici'], ['Samimi ve yakın ama kurumsal', 'Samimi & Yakın'], ['Teknik ve ayrıntılı', 'Teknik & Detaylı'], ['İlham verici ve vizyoner', 'İlham Verici']];
const PLATS = [['LinkedIn', 3000], ['Instagram', 2200], ['Facebook', 63206], ['X', 280], ['Threads', 500]];

/* kural tabanlı marka sesi kontrolü */
const SUPER = /\b(en iyi|tek|garanti(li)?|kesinlikle|%\s?100|mükemmel|rakipsiz|şaşırtıcı|inanılmaz)\b/gi;
const TECH = ['bim', 'mep', 'hvac', 'ifc', 'enerji', 'verimlilik', 'koordinasyon', 'tasarım', 'proje', 'mühendis', 'yapı', 'analiz', 'standart', 'iso', 'maliyet', 'metraj', 'sürdürülebil', 'sistem'];
const brandVoice = (t) => {
  const text = t.toLocaleLowerCase('tr');
  const words = text.split(/\s+/).filter(Boolean).length;
  const exclam = (t.match(/!/g) ?? []).length;
  const supers = (t.match(SUPER) ?? []).length;
  const tech = TECH.filter((w) => text.includes(w)).length;
  const hasBrand = /akort|biz\b|ekibimiz|danışmanlık/i.test(t);
  const unv = (t.match(/\[KAYNAK GEREKLİ\]/g) ?? []).length;
  const c = [
    ['Profesyonel ton', words ? Math.max(0, 100 - exclam * 18) : 0],
    ['Güvenli dil (abartı yok)', words ? Math.max(0, 100 - supers * 30) : 0],
    ['Teknik denge', Math.min(100, tech * 22)],
    ['Kurumsal değerler (AKORT / biz dili)', hasBrand ? 100 : words ? 35 : 0],
    ['Doğrulanmamış iddia yok', words ? (unv ? Math.max(0, 100 - unv * 40) : 100) : 0],
  ];
  return { items: c, score: words ? Math.round(c.reduce((a, [, v]) => a + v, 0) / c.length) : 0, unv, supers };
};

export const renderAiStudio = async (ctx) => {
  ctx.setTitle('AI Content Studio');
  const root = h('div', {}, spinner());
  try {
    const d = await api.get('/x/ai');
    const connected = d.providers.filter((p) => p.connected);
    let chosen = connected[0]?.id ?? d.providers[0].id;
    let compare = false;

    const provRow = h('div', { class: 'prov-row' });
    const drawProv = () => provRow.replaceChildren(...d.providers.map((p) => h('button', { class: `prov${p.id === chosen ? ' on' : ''}${p.connected ? '' : ' off'}`, onclick: () => { if (!p.connected) return ctx.nav('/entegrasyonlar'); chosen = p.id; drawProv(); } },
      h('span', { class: 'prov-ic' }, icon('spark', 20)), h('div', {}, h('b', {}, p.label), h('span', {}, p.connected ? p.cfg.model : 'Bağlantı gerekli — anahtar ekleyin')))));
    drawProv();

    const typeSel = h('select', { class: 'select' }, TYPES.map(([v, l]) => h('option', { value: v }, l)));
    const toneSel = h('select', { class: 'select' }, TONES.map(([v, l]) => h('option', { value: v }, l)));
    const platSel = h('select', { class: 'select' }, PLATS.map(([v]) => h('option', { value: v }, v)));
    const prompt = h('textarea', { class: 'textarea', rows: 3, placeholder: 'ör. Endüstriyel tesislerde enerji verimliliği çözümlerini ve AKORT\'un yaklaşımını anlatan SEO uyumlu bir blog yazısı hazırla.', maxlength: 1500 });
    const text = createRichEditor({ value: '', minHeight: 360, pickMedia: () => openMediaPicker({ type: 'image' }) }); // zengin metin; Markdown olarak okunur/yazılır
    try { text.value = localStorage.getItem('akort-ai-draft') ?? ''; } catch { /* özel pencere */ }
    const saved = h('span', { class: 'small muted' }, '');
    const stats = h('span', { class: 'small muted' });
    const consent = h('input', { type: 'checkbox' });

    const seoBox = h('div'), voiceBox = h('div'), tipBox = h('div'), tagBox = h('div'), imgBox = h('div', { class: 'ai-img' });
    const recalc = () => {
      const t = text.value;
      const words = t.trim().split(/\s+/).filter(Boolean).length;
      stats.textContent = `Kelime: ${words}   |   Okuma süresi: ${Math.max(1, Math.round(words / 200))} dk   |   ${t.length} karakter`;
      const a = analyze({ title: (t.split('\n')[0] || '').replace(/^#+\s*/, ''), description: '', slug: 'x', focus: '', body: t, hasCover: true });
      const okays = a.checks.filter((c) => ['okunabilirlik', 'teknik'].includes(c.group));
      const sc = Math.round((a.scores.okunabilirlik + a.scores.teknik) / 2);
      seoBox.replaceChildren(h('div', { class: 'row', style: 'gap:14px;align-items:center' }, ring(words ? sc : 0, { size: 96, stroke: 10, sub: '/100' }), h('div', { class: 'grow' }, okays.map((c) => h('div', { class: 'rec' }, h('span', { class: `recic ${c.ok ? 'ok' : 'mid'}` }, icon(c.ok ? 'check' : 'alert', 12)), h('span', { class: 'small' }, c.label))))));
      const v = brandVoice(t);
      voiceBox.replaceChildren(...[h('div', { class: 'row', style: 'gap:14px;align-items:center' }, ring(v.score, { size: 96, stroke: 10, sub: '/100', color: v.score >= 80 ? '#0b7bd6' : undefined }), h('div', { class: 'grow' }, v.items.map(([l, s]) => h('div', { style: 'margin-bottom:6px' }, h('div', { class: 'small row' }, h('span', { class: 'grow' }, l), h('b', {}, s)), h('div', { class: 'progress-bar' }, h('i', { style: `width:${s}%;background:#0b7bd6` })))))),
        v.unv ? h('div', { class: 'banner warn', style: 'margin-top:8px' }, icon('alert'), h('div', {}, `${v.unv} [KAYNAK GEREKLİ] işareti var: bu iddialar doğrulanmadan yayımlanmamalı.`)) : null].filter(Boolean));
      const tips = [];
      if (words && words < 150) tips.push(['Metni biraz daha ayrıntılandırın (≥ 150 kelime).', 'doc']);
      if (!/\]\(\//.test(t) && words > 80) tips.push(['İlgili hizmet/blog sayfalarına iç bağlantı ekleyin.', 'link']);
      if (v.supers) tips.push([`${v.supers} abartılı ifade var ("en iyi", "garantili" vb.) — kaldırın.`, 'alert']);
      if (words > 80 && !/\?/.test(t)) tips.push(['Etkileşim için bir soru cümlesi ekleyin.', 'spark']);
      if (words > 80 && !/#/.test(t) && typeSel.value === 'sosyal') tips.push(['Sektörle ilgili 3-5 hashtag ekleyin.', 'share']);
      if (words > 200 && !/^#{2,3}\s/m.test(t)) tips.push(['Ara başlıklarla metni bölümlendirin.', 'edit']);
      tipBox.replaceChildren(tips.length ? h('div', {}, tips.map(([x, ic2]) => h('div', { class: 'listrow' }, h('span', { class: 'lic', style: '--kc:#0b7bd6' }, icon(ic2, 16)), h('div', { class: 'grow' }, h('b', { style: 'font-weight:600' }, x))))) : h('div', { class: 'muted small', style: 'padding:6px 0' }, words ? 'Şu an öneri yok — iyi görünüyor.' : 'Metin yazıldıkça kural tabanlı öneriler burada çıkar.'));
      saved.textContent = 'Taslak yerel olarak saklandı';
      try { localStorage.setItem('akort-ai-draft', t); } catch { /* */ }
    };
    const live = debounce(recalc, 250);
    text.addEventListener('input', live);

    const loadTags = async () => { try { const r = await api.post('/x/sosyal/hashtag', { text: `${prompt.value}\n${text.value}` }); tagBox.replaceChildren(h('div', { class: 'row wrap' }, r.tags.map((t) => chip(t, 'info'))), h('button', { class: 'btn secondary sm', style: 'margin-top:8px', onclick: async () => { await navigator.clipboard.writeText(r.tags.join(' ')); toast('Hashtag\'ler kopyalandı', 'ok'); } }, icon('copy', 14), 'Tümünü Kopyala')); } catch { /* */ } };

    const headline = () => (text.value.split('\n').find((l) => l.trim()) ?? prompt.value ?? 'AKORT Mühendislik').replace(/^#+\s*/, '').slice(0, 80) || 'AKORT Mühendislik';
    const makeImage = async () => {
      imgBox.replaceChildren(spinner('Görsel oluşturuluyor…'));
      try {
        const body = { template: 'blog-paylasimi', title: headline(), subtitle: prompt.value.slice(0, 120), theme: 'marka', format: 'ig-kare' };
        const r = await api.post('/x/marka/onizle', body);
        imgBox.replaceChildren(h('img', { src: `data:${r.mime};base64,${r.data}`, alt: 'Marka şablonu önizleme' }), h('div', { class: 'row wrap', style: 'margin-top:8px' },
          h('button', { class: 'btn secondary sm', onclick: () => { const a = h('a', { href: `data:${r.mime};base64,${r.data}`, download: 'akort-gorsel.png' }); document.body.append(a); a.click(); a.remove(); } }, icon('download', 14), 'İndir'),
          h('button', { class: 'btn secondary sm', onclick: async (e) => { e.target.disabled = true; try { const m = await api.post('/x/marka/kaydet', body); toast(`Medya kütüphanesine kaydedildi: ${m.filename}`, 'ok'); } catch (er) { toast(er.message, 'err'); } e.target.disabled = false; } }, icon('upload', 14), 'Medyaya Kaydet')));
      } catch (e) { imgBox.replaceChildren(errorBanner(e)); }
    };

    const ask = async (task, input, extra = {}) => {
      if (!connected.length) { toast('Önce bir AI sağlayıcısı bağlayın (Entegrasyonlar)', 'err'); return null; }
      if (!consent.checked) { toast('Metnin harici bir AI sağlayıcısına gönderileceğini onaylayın (korumalı proje belgesi göndermeyin)', 'err'); return null; }
      const ids = compare ? connected.map((p) => p.id) : [chosen];
      const note = `${TYPES.find((t) => t[0] === typeSel.value)[2]}${typeSel.value === 'sosyal' ? ` Platform: ${platSel.value} (karakter sınırı ${PLATS.find((p) => p[0] === platSel.value)[1]}).` : ''}`;
      const res = await Promise.allSettled(ids.map((id) => api.post('/x/ai/uret', { provider: id, task, text: input, tone: toneSel.value, note, ...extra })));
      return res.map((r, i) => (r.status === 'fulfilled' ? r.value : { error: r.reason.message, provider: ids[i] }));
    };
    const compareModal = (outs) => {
      const ov = h('div', { class: 'overlay' }, h('div', { class: 'modal wide' }, h('div', { class: 'modal-head' }, h('h3', {}, 'Model Karşılaştırma'), h('button', { class: 'btn ghost sm icon', onclick: () => ov.remove() }, icon('x'))),
        h('div', { class: 'modal-body stack' }, h('div', { class: 'banner info' }, icon('eye'), h('div', {}, 'Birden fazla model yanıtı. Birini seçin; seçtiğiniz metin editöre aktarılır.')),
          h('div', { class: 'grid cols-2' }, outs.map((o) => h('div', { class: 'card card-pad stack' }, h('b', {}, `${o.provider} · ${o.model}`), h('div', { class: 'ai-sum', style: 'white-space:pre-wrap;max-height:260px;overflow:auto' }, o.output), h('button', { class: 'btn', onclick: () => { text.value = o.output; recalc(); loadTags(); ov.remove(); } }, 'Bunu kullan')))))));
      document.body.append(ov);
    };
    const write = async (btn, task, input) => {
      btn.disabled = true;
      const old = btn.textContent; btn.textContent = 'Üretiliyor…';
      try {
        const out = await ask(task, input);
        if (!out) return;
        const ok = out.filter((o) => !o.error);
        out.filter((o) => o.error).forEach((o) => toast(`${o.provider}: ${o.error}`, 'err'));
        if (ok.length === 1) { text.value = ok[0].output; recalc(); loadTags(); toast('Metin hazır — gözden geçirin; insan denetimi olmadan yayımlamayın', 'ok'); } else if (ok.length > 1) compareModal(ok);
      } catch (e) { toast(e.message, 'err'); } finally { btn.disabled = false; btn.textContent = old; }
    };

    const toolbar = h('div', { class: 'row' }, h('span', { class: 'grow' }), saved);

    const improve = async (btn) => {
      btn.disabled = true;
      try { const out = await ask('prompt-iyilestir', prompt.value); if (out?.[0]?.output) { prompt.value = out[0].output.trim(); toast('Prompt iyileştirildi', 'ok'); } else if (out?.[0]?.error) toast(out[0].error, 'err'); } catch (e) { toast(e.message, 'err'); } finally { btn.disabled = false; }
    };
    const chipAdd = (label, add) => h('button', { class: 'btn secondary sm', onclick: () => { prompt.value = `${prompt.value.trim()} ${add}`.trim(); } }, label);

    root.replaceChildren(
      pageHead('AI Content Studio', 'GPT, Claude ve Gemini ile blog, hizmet ve sosyal medya içeriklerinizi profesyonelce yazın.'),
      connected.length ? null : h('div', { style: 'margin-bottom:14px' }, connectBox('Yapay zekâ sağlayıcısı bağlı değil', 'Metin üretimi için Entegrasyonlar sayfasından en az bir API anahtarı ekleyin. Şablon, görsel, hashtag ve skor araçları anahtarsız çalışır.')),
      h('div', { class: 'ai-top' }, provRow, h('div', { class: 'pillsel col' }, h('span', {}, 'İçerik Türü'), typeSel), h('div', { class: 'pillsel col' }, h('span', {}, 'Marka Tonu'), toneSel), h('div', { class: 'pillsel col' }, h('span', {}, 'Platform'), platSel)),
      h('div', { class: 'ai-cols' },
        h('div', { class: 'stack' },
          panel('Konu / Prompt', h('div', { class: 'stack' }, h('div', { class: 'row', style: 'gap:10px;align-items:stretch' }, prompt, h('button', { class: 'btn', style: 'min-width:110px', onclick: (e) => write(e.currentTarget, 'taslak', prompt.value) }, icon('spark', 16), 'AI ile Yaz')),
            h('label', { class: 'switch' }, consent, h('i'), h('span', {}, 'Metni harici AI sağlayıcısına göndermeyi onaylıyorum (korumalı proje belgesi içermiyor)'))), { ic: 'edit' }),
          panel('İçerik Editörü', h('div', { class: 'stack' }, toolbar, text.el, h('div', { class: 'row wrap' }, stats), h('div', { class: 'row wrap' },
            h('button', { class: 'btn secondary', onclick: (e) => write(e.currentTarget, 'taslak', prompt.value || text.value) }, icon('history', 16), 'Alternatif Üret'),
            h('button', { class: 'btn secondary', onclick: (e) => { const sel = text.selectedText() || text.value; write(e.currentTarget, 'yeniden-yaz', sel); } }, icon('edit', 16), 'Metni Geliştir'),
            h('button', { class: 'btn', onclick: makeImage }, icon('image', 16), 'Görsel Oluştur'),
            h('button', { class: 'btn secondary', onclick: async () => { try { await api.post('/x/sosyal/gonderiler', { title: headline(), body: text.value, platforms: [], category: 'AI Taslak' }); toast('Sosyal taslağa aktarıldı (Onay Merkezi)', 'ok'); } catch (e) { toast(e.message, 'err'); } } }, icon('share', 16), 'Sosyal Taslağa Aktar'),
            h('button', { class: 'btn ghost', onclick: async () => { await navigator.clipboard.writeText(text.value); toast('Metin kopyalandı', 'ok'); } }, icon('copy', 16), 'Kopyala'))), { ic: 'doc', action: h('label', { class: 'switch' }, h('input', { type: 'checkbox', onchange: (e) => { compare = e.target.checked; } }), h('i'), h('span', { class: 'small' }, 'Modelleri Karşılaştır')) }),
          panel('Prompt\'u İyileştir', h('div', { class: 'stack' }, h('div', { class: 'row wrap' }, chipAdd('Daha profesyonel', 'Daha profesyonel bir dille.'), chipAdd('Daha kısa', 'Daha kısa ve öz.'), chipAdd('Daha ilham verici', 'Daha ilham verici bir tonla.'), chipAdd('Soru ekle', 'Sonda bir soru sor.'), chipAdd('Hashtag öner', 'Sonda hashtag öner.'), h('span', { class: 'grow' }), h('button', { class: 'btn', onclick: (e) => improve(e.currentTarget) }, icon('spark', 16), 'Prompt\'u İyileştir'))), { ic: 'spark' })),
        h('div', { class: 'stack' },
          panel('SEO Skoru', seoBox, { ic: 'search', sub: 'okunabilirlik + teknik (yerel)' }), panel('Marka Sesi Skoru', voiceBox, { ic: 'shield', sub: 'kural tabanlı' }),
          panel('AI Önerileri', tipBox, { ic: 'spark' }), panel('Hashtag Önerileri', tagBox, { ic: 'share', action: h('button', { class: 'btn secondary sm', onclick: loadTags }, 'Yenile') }), panel('Görsel Önizleme', imgBox, { ic: 'image', sub: 'Marka şablonu (logo/tipografi sabit)' }))),
      infoBox('Üretilen metin yalnızca düz metin olarak gösterilir (HTML çalıştırılmaz). Teknik/mevzuat iddiaları kaynak gerektirir; yayımlamadan önce insan incelemesi zorunludur. Skorlar kural tabanlıdır, Google veya marka onayı değildir.'));
    imgBox.replaceChildren(h('div', { class: 'muted small', style: 'padding:6px 0' }, 'Metin yazın ve "Görsel Oluştur"a basın — başlıktan marka şablonlu görsel üretilir.'));
    tagBox.replaceChildren(h('div', { class: 'muted small' }, 'Yükleniyor…')); loadTags();
    recalc();
  } catch (e) { root.replaceChildren(errorBanner(e)); }
  return root;
};
