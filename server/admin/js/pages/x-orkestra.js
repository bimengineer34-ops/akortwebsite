// AKORT Yapay Zekâ Orkestrası — 8 sayfa: Pano, Komut Merkezi, Ajanlar, İş Akışı Oluşturucu, Görev İzleme, Onay Merkezi, Model ve API, Kayıtlar & Analitik.
// Tüm veriler /x/orkestra/* uçlarından gelir (sahte veri yok). Metinler DOM'a metin düğümü olarak eklenir (XSS güvenli).
import { api, session } from '../api.js';
import { h, icon, chip, toast, spinner, errorBanner, field, modal, confirmBox, levelTr, eventTr } from '../ui.js';
import { kpiCard, areaChart, hbars, panel } from '../charts.js';
import { pageHead, infoBox, empty, fmtLocal, needConn } from './x-common.js';

const isAdmin = () => session.user.role === 'admin';
const fmtN = (n) => (n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(1)}K` : String(n ?? 0));
const usd = (n) => (n == null ? '—' : `$${Number(n).toFixed(n < 0.1 ? 4 : 2)}`);
const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`);

const ST = {
  paused: ['Duraklatıldı', 'warn'], queued: ['Sırada', ''], running: ['Çalışıyor', 'info'], awaiting_approval: ['Onay bekliyor', 'warn'], succeeded: ['Tamamlandı', 'ok'],
  failed: ['Başarısız', 'danger'], cancelled: ['İptal', ''], pending: ['Bekliyor', ''], skipped: ['Atlandı', ''],
};
const stChip = (s) => chip(ST[s]?.[0] ?? s, ST[s]?.[1] ?? '');
const KIND = { agent: 'Ajan', approval: 'İnsan onayı', action: 'Eylem' };

let agentCache = null;
const loadAgents = async (force = false) => { if (!agentCache || force) agentCache = await api.get('/x/orkestra/ajanlar'); return agentCache; };
const agentName = (key) => agentCache?.agents.find((a) => a.key === key)?.name ?? (key.startsWith('action.') ? agentCache?.actions.find((a) => a.key === key)?.label ?? key : key);

/** Yenilemede kaydırma konumunu ve açık <details> bölümlerini korur; odaktaki alana yazılıyorsa yenilemeyi atlar */
const busy = () => { const a = document.activeElement; return !!a && ['INPUT', 'TEXTAREA', 'SELECT'].includes(a.tagName) && !!a.closest('main, .view'); };
const keepState = async (root, fn) => {
  const y = window.scrollY;
  const open = [...root.querySelectorAll('details')].map((d) => d.open);
  await fn();
  root.querySelectorAll('details').forEach((d, i) => { if (open[i] !== undefined) d.open = open[i]; });
  window.scrollTo(0, y);
};
/** Sayfa bağlıyken belirli aralıkla yeniler; sayfa değişince durur */
const live = (root, fn, ms = 4000) => {
  const id = setInterval(() => { if (!root.isConnected) return clearInterval(id); if (busy()) return; keepState(root, fn); }, ms);
};
const wrap = (title, lead, build, opts = {}) => async (ctx) => {
  ctx.setTitle(title);
  const root = h('div', { class: 'stack' });
  const load = async (silent = false) => {
    if (!silent) root.replaceChildren(spinner());
    try { root.replaceChildren(...[].concat(await build(load, root))); } catch (e) { root.replaceChildren(errorBanner(e)); }
  };
  load();
  if (opts.refresh) live(root, () => load(true), opts.refresh);
  return h('div', {}, pageHead(title, lead, { crumbs: 'Yapay Zekâ Orkestrası' }), subnav(), root);
};

const SUBNAV = [['/orkestra', 'Pano'], ['/orkestra/komut', 'Komut Merkezi'], ['/orkestra/ajanlar', 'Ajanlar'], ['/orkestra/akislar', 'İş Akışı Oluşturucu'], ['/orkestra/izleme', 'Görev İzleme'], ['/orkestra/onay', 'Onay Merkezi'], ['/orkestra/model', 'Model ve API'], ['/orkestra/kayit', 'Kayıtlar & Analitik']];
const subnav = () => {
  const cur = location.hash.replace(/^#/, '').split('?')[0];
  return h('nav', { class: 'orch-tabs', 'aria-label': 'Yapay Zekâ Orkestrası bölümleri' }, SUBNAV.map(([to, label]) => h('a', { href: `#${to}`, 'aria-current': (to === '/orkestra' ? cur === to : cur === to || cur.startsWith(`${to}/`)) ? 'page' : null }, label)));
};

/* ------------------------------ DAG çizimi ------------------------------ */
const SVGNS = 'http://www.w3.org/2000/svg';
const sv = (tag, attrs = {}, ...kids) => { const e = document.createElementNS(SVGNS, tag); for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v); kids.forEach((c) => e.append(c instanceof Node ? c : document.createTextNode(String(c)))); return e; };
export const dag = (steps, status = {}) => {
  const depth = new Map();
  const by = new Map(steps.map((s) => [s.ref, s]));
  const d = (r, seen = new Set()) => { if (depth.has(r)) return depth.get(r); if (seen.has(r)) return 0; seen.add(r); const v = Math.max(-1, ...(by.get(r)?.depends_on ?? []).filter((x) => by.has(x)).map((x) => d(x, seen))) + 1; depth.set(r, v); return v; };
  steps.forEach((s) => d(s.ref));
  const cols = [];
  steps.forEach((s) => { const c = depth.get(s.ref); (cols[c] ??= []).push(s); });
  const W = 172, H = 46, GX = 54, GY = 16;
  const pos = new Map();
  cols.forEach((col, ci) => col.forEach((s, ri) => pos.set(s.ref, { x: ci * (W + GX) + 8, y: ri * (H + GY) + 8 })));
  const width = cols.length * (W + GX) - GX + 16, height = Math.max(...cols.map((c) => c.length)) * (H + GY) - GY + 16;
  const svg = sv('svg', { class: 'dag', viewBox: `0 0 ${width} ${height}`, width, height, role: 'img', 'aria-label': 'İş akışı grafiği' });
  for (const s of steps) for (const dep of s.depends_on ?? []) {
    const a = pos.get(dep), b = pos.get(s.ref);
    if (!a || !b) continue;
    const x1 = a.x + W, y1 = a.y + H / 2, x2 = b.x, y2 = b.y + H / 2, mx = (x1 + x2) / 2;
    svg.append(sv('path', { d: `M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`, class: 'dag-edge' }));
  }
  for (const s of steps) {
    const p = pos.get(s.ref);
    const st = status[s.ref] ?? 'idle';
    const label = s.title.length > 24 ? `${s.title.slice(0, 23)}…` : s.title;
    const sub = s.kind === 'agent' ? agentName(s.agent) : KIND[s.kind];
    svg.append(sv('g', { class: `dn st-${st} k-${s.kind}`, transform: `translate(${p.x},${p.y})` },
      sv('title', {}, `${s.title} — ${sub}${status[s.ref] ? ` (${ST[st]?.[0] ?? st})` : ''}`),
      sv('rect', { width: W, height: H, rx: 9 }),
      sv('text', { x: 10, y: 19, class: 'dn-t' }, label),
      sv('text', { x: 10, y: 35, class: 'dn-s' }, sub.length > 28 ? `${sub.slice(0, 27)}…` : sub)));
  }
  return h('div', { class: 'dag-wrap' }, svg);
};

/* ------------------------------ çıktı gösterimi ------------------------------ */
const kv = (k, v) => h('div', { class: 'ov-row' }, h('span', {}, k), h('div', {}, v));
const list = (items, fn) => (items?.length ? h('ul', { class: 'ov-list' }, items.map((x) => h('li', {}, fn ? fn(x) : String(x)))) : h('span', { class: 'muted small' }, '—'));
const link = (u, t) => h('a', { href: u, target: '_blank', rel: 'noopener noreferrer' }, t || u);
export const outputView = (agent, out) => {
  if (!out) return h('span', { class: 'muted small' }, 'Çıktı yok');
  const body = (txt) => h('pre', { class: 'ov-pre' }, txt);
  if (agent === 'research') return h('div', { class: 'ov' }, kv('Özet', out.brief), kv('Açı', out.angle || '—'),
    kv('Ana noktalar', list(out.key_points, (k) => h('span', {}, `${k.point} `, k.confidence === 'kaynakli' ? chip('kaynaklı', 'ok') : chip('genel bilgi', 'warn'), ' ', ...(k.source_urls ?? []).map((u) => [link(u, '↗'), ' '])))),
    kv('Taslak yapısı', list(out.outline)), kv('Boşluklar', list(out.gaps)), kv('Kaynaklar', list(out.sources, (s) => link(s.url, s.title || s.url))),
    out.meta ? h('div', { class: 'small muted' }, `${out.meta.sourceCount} kaynak kullanıldı · ${out.meta.blockedSources} şüpheli kaynak dışlandı · ${out.meta.strippedCitations} doğrulanamayan atıf temizlendi`) : null);
  if (agent === 'content') return h('div', { class: 'ov' }, kv('Başlık', out.title), kv('Arama açıklaması', out.description), kv('Kategori', out.category), kv('Etiketler', (out.tags ?? []).join(', ') || '—'),
    out.risk_flags?.length ? kv('Otomatik risk', list(out.risk_flags)) : null, kv('Kaynak isteyen iddialar', list(out.claims_needing_source)), body(out.body));
  if (out.priorities) return h('div', { class: 'ov' }, kv('Özet', out.summary), kv('Tarama', `${out.scan?.pages ?? '—'} sayfa · ${out.scan?.errors ?? 0} kritik · ${out.scan?.warnings ?? 0} önemli · ${out.scan?.infos ?? 0} iyileştirme · ortalama skor ${out.scan?.avgScore ?? '—'}`),
    kv('Öncelikler', list(out.priorities, (p) => h('span', {}, chip(p.impact, p.impact === 'yuksek' ? 'danger' : p.impact === 'orta' ? 'warn' : ''), ' ', link(p.page, p.page), ` — ${p.issue} → `, h('b', {}, p.fix)))), kv('Hızlı kazanımlar', list(out.quick_wins)),
    kv('İç bağlantı fırsatları', list(out.internal_link_opportunities, (l) => h('span', {}, `${l.from} → `, link(l.to, l.to), ` (“${l.anchor}”)`))), h('div', { class: 'small muted' }, 'Bu analiz yalnızca öneridir; hiçbir sayfa değiştirilmedi.'));
  if (agent === 'seo') return h('div', { class: 'ov' }, kv('SEO başlığı', out.title), kv('Arama açıklaması', out.description), kv('Adres', `/blog/${out.slug}`), kv('Skor', chip(`${out.score ?? '—'}`, out.score >= 85 ? 'ok' : out.score >= 60 ? 'warn' : 'danger')),
    kv('İç bağlantılar', list(out.internal_links, (l) => h('span', {}, link(l.url, l.anchor), ` → ${l.url}`))), kv('Kontroller', list(out.checks, (c) => h('span', {}, chip(c.ok ? 'OK' : 'Eksik', c.ok ? 'ok' : 'warn'), ' ', c.note ?? c.id))));
  if (agent === 'qa') return h('div', { class: 'ov' }, kv('Sonuç', chip(out.passed ? 'Geçti' : 'Kritik bulgu var', out.passed ? 'ok' : 'danger')), kv('Özet', out.summary),
    kv('Bulgular', list(out.issues, (i) => h('span', {}, chip(i.severity, i.severity === 'kritik' ? 'danger' : i.severity === 'uyari' ? 'warn' : ''), ` ${i.text}`))));
  if (agent === 'sales' || out.draft_reply) return h('div', { class: 'ov' }, kv('Özet', out.summary), kv('Hizmet alanı', out.category), kv('Aciliyet', chip(out.urgency, out.urgency === 'yuksek' ? 'danger' : out.urgency === 'orta' ? 'warn' : '')), kv('Eksik bilgiler', list(out.missing_info)), kv('Önerilen adımlar', list(out.next_steps)),
    out.risk_flags?.length ? kv('Uyarılar', list(out.risk_flags, (x) => h('span', { class: 'ov-warn' }, x))) : null, kv('Yanıt TASLAĞI (gönderilmedi)', body(out.draft_reply)), h('div', { class: 'small muted' }, 'Kişisel veriler (ad, e-posta, telefon, kurum adı) modele gönderilmedi; yanıtı göndermeden önce siz gözden geçirin.'));
  if (agent === 'crm' || (out.stage && out.priority && out.title)) return h('div', { class: 'ov' }, kv('Fırsat başlığı', out.title), kv('Öncelik', chip(out.priority, out.priority === 'yuksek' ? 'danger' : out.priority === 'orta' ? 'warn' : '')), kv('Not', out.note), kv('Etiketler', (out.tags ?? []).join(', ') || '—'), kv('Kaynak talep', out.form_id ? `#${out.form_id}` : '—'));
  if (agent === 'design' || (out.template && out.theme && out.format)) return h('div', { class: 'ov' }, kv('Şablon', out.template), kv('Biçim', out.format), kv('Tema', out.theme), kv('Başlık', out.title), kv('Alt başlık', out.subtitle || '—'), kv('Alt metin', out.alt), out.risk_flags?.length ? kv('Uyarılar', list(out.risk_flags)) : null);
  if (out.media && out.filename) return h('div', { class: 'ov' }, kv('Üretilen görsel', h('div', {}, h('img', { class: 'ov-img', src: out.media, alt: out.alt ?? '' }), h('div', { class: 'small muted' }, `${out.width}×${out.height} · medya kitaplığına kaydedildi, yayınlanmadı`))));
  if (out.opportunityId) return h('div', { class: 'ov' }, kv('CRM fırsat kaydı', h('a', { href: out.href }, `Fırsat #${out.opportunityId} → Form talepleri`)), h('div', { class: 'small muted' }, 'E-posta veya teklif gönderilmedi; yanıt taslağı kayıt notunda duruyor.'));
  if (agent === 'social' || Array.isArray(out.posts)) return h('div', { class: 'ov' }, ...(out.posts ?? []).map((p) => kv(p.platform === 'x' ? 'X' : 'LinkedIn', h('div', {}, body(p.text), h('div', { class: 'small muted' }, (p.hashtags ?? []).join(' '))))));
  if (out.title && out.qa_passed !== undefined) return h('div', { class: 'ov' }, kv('Taslak', out.title), kv('QA', out.qa_passed === null ? '—' : chip(out.qa_passed ? 'Geçti' : `${out.qa_blocking} kritik bulgu`, out.qa_passed ? 'ok' : 'danger')), kv('SEO skoru', out.seo_score ?? '—'), kv('Sözcük', out.words ?? '—'));
  if (out.slug && out.draft) return h('div', { class: 'ov' }, kv('Oluşturulan taslak', h('a', { href: out.href }, `${out.title ?? out.slug} → blog editörü`)), h('div', { class: 'small muted' }, 'Taslak yayınlanmadı; blog editöründe inceleyip kendiniz yayınlayın.'));
  if (out.postIds) return h('div', { class: 'ov' }, kv('Sosyal Medya Stüdyosu taslakları', h('a', { href: out.href }, `${out.postIds.length} gönderi taslağı → İçerik Arşivi`)));
  return body(JSON.stringify(out, null, 2));
};

/* ------------------------------ 1) Pano ------------------------------ */
export const renderOrkestraDashboard = wrap('Yapay Zekâ Orkestrası', 'Çok ajanlı yapay zekâ yönetimi: komut verin, ajanların çalışmasını izleyin, çıktıları onaylayın.', async () => {
  const [ov, runs, ap] = await Promise.all([api.get('/x/orkestra/ozet'), api.get('/x/orkestra/calistirmalar?limit=8'), api.get('/x/orkestra/onaylar'), loadAgents()]);
  const c = ov.counts;
  const days = [...Array(14)].map((_, i) => new Date(Date.now() - (13 - i) * 86_400_000).toLocaleDateString('sv-SE'));
  const series = days.map((d) => ov.byDay.find((x) => x.day === d)?.runs ?? 0);
  return [
    ov.ready ? null : needConn('Ajanların çalışması için bir yapay zekâ sağlayıcısı (OpenAI, Anthropic veya Gemini) bağlanmalı. Anahtar yalnızca sunucuda şifreli saklanır.'),
    h('div', { class: 'kpis' },
      kpiCard({ ic: 'bolt', label: 'Çalışan / Sırada', value: c.running + c.queued, to: '/orkestra/izleme', color: '#0b7bd6', deltaLabel: `${c.total} toplam çalıştırma` }),
      kpiCard({ ic: 'shield', label: 'Onay Bekleyen', value: ov.pending, to: '/orkestra/onay', color: '#ff9f43', deltaLabel: ov.pending ? 'İnsan onayı gerekli' : 'Bekleyen yok' }),
      kpiCard({ ic: 'alert', label: 'Başarısız', value: c.failed, to: '/orkestra/izleme', color: '#ea5455', goodUp: false }),
      kpiCard({ ic: 'chart', label: 'Bu Ay Belirteç', value: fmtN(ov.month.i + ov.month.o), to: '/orkestra/kayit', color: '#8b5cf6', deltaLabel: ov.month.cost ? `≈ ${usd(ov.month.cost)}` : 'maliyet: fiyat tanımsız olabilir' })),
    h('div', { class: 'dash-grid' },
      h('div', { class: 'span-7' }, panel('Çalıştırmalar (son 14 gün)', areaChart({ labels: days.map((d) => d.slice(5)), series: [{ name: 'Çalıştırma', color: '#0b7bd6', values: series }], height: 200 }), { ic: 'chart' })),
      h('div', { class: 'span-5' }, panel('Ajan Başına Belirteç', hbars(ov.byAgent.filter((a) => a.tokens).map((a) => ({ label: agentName(a.agent), value: a.tokens })), { empty: 'Henüz belirteç kullanılmadı' }), { ic: 'spark' })),
      h('div', { class: 'span-7' }, panel('Son Çalıştırmalar', runs.runs.length ? h('div', {}, runs.runs.map((r) => h('a', { class: 'listrow link', href: `#/orkestra/izleme/${r.id}` }, h('div', { class: 'grow' }, h('b', {}, r.title), h('span', {}, `${fmtLocal(r.created_at)} · ${r.done_count}/${r.task_count} adım · ${r.created_by ?? ''}`)), stChip(r.status)))) : empty('Henüz çalıştırma yok. Komut Merkezi\'nden başlayın.'),
        { ic: 'rocket', action: h('a', { class: 'btn sm', href: '#/orkestra/komut' }, 'Yeni komut') })),
      h('div', { class: 'span-5' }, panel('Onay Bekleyenler', ap.approvals.length ? h('div', {}, ap.approvals.slice(0, 5).map((a) => h('a', { class: 'listrow link', href: '#/orkestra/onay' }, h('div', { class: 'grow' }, h('b', {}, a.title), h('span', {}, a.run_title)), chip('Onay', 'warn')))) : empty('Bekleyen onay yok.'), { ic: 'shield' })),
      h('div', { class: 'span-12' }, panel('Ajanlar', h('div', { class: 'agent-pills' }, agentCache.agents.map((a) => h('a', { class: `apill ${a.executable && a.enabled ? 'on' : ''}`, href: '#/orkestra/ajanlar', title: a.executable ? a.role : a.notConnectedReason }, a.name, a.executable ? (a.enabled ? '' : ' · kapalı') : ' · bağlı değil'))), { ic: 'users' }))),
  ];
}, { refresh: 6000 });

/* ------------------------------ 2) Komut Merkezi ------------------------------ */
const EXAMPLES = [
  'Bu hafta AKORT için BIM koordinasyonu konusunda iki blog yazısı hazırla. Rakip içerikleri araştır. SEO analizini yap. LinkedIn gönderilerini oluştur ve onayıma sun.',
  'MEP sistemlerinde entegre tasarım konusunda bir blog yazısı hazırla; araştırma, SEO ve kalite kontrolünden sonra onayıma sun.',
  'Son 30 günün site ziyaret sayaçlarını yorumla ve içerik önerileri çıkar.',
];
export const renderCommandCenter = async (ctx) => {
  ctx.setTitle('Komut Merkezi');
  const root = h('div', { class: 'stack' });
  const cmd = h('textarea', { class: 'textarea', rows: 4, maxlength: 2000, placeholder: 'Örn: Bu hafta BIM koordinasyonu konusunda iki blog yazısı hazırla, rakip içerikleri araştır, SEO analizini yap, LinkedIn gönderisi oluştur ve onayıma sun.' });
  const planBox = h('div', { class: 'stack' });
  let idemKey = uuid();
  const runPlan = async (plan) => {
    const title = h('input', { class: 'input', value: cmd.value.slice(0, 80) });
    planBox.replaceChildren(panel('Ana koordinatör planı', h('div', { class: 'stack' },
      h('p', {}, plan.summary),
      plan.notes?.length ? infoBox(plan.notes.join(' · '), 'warn') : null,
      plan.unsupported?.length ? infoBox(`Bu sürümde desteklenmeyen istekler (plana alınmadı): ${plan.unsupported.join('; ')}`, 'warn') : null,
      dag(plan.steps),
      h('div', { class: 'tbl-wrap' }, h('table', { class: 'tbl' }, h('thead', {}, h('tr', {}, ['Adım', 'Tür', 'Ajan / eylem', 'Bağımlılık'].map((x) => h('th', {}, x)))),
        h('tbody', {}, plan.steps.map((s) => h('tr', {}, h('td', {}, s.title), h('td', {}, KIND[s.kind]), h('td', {}, s.kind === 'approval' ? '—' : agentName(s.agent)), h('td', { class: 'mono small' }, (s.depends_on ?? []).join(', ') || '—')))))),
      field('Çalıştırma adı', title),
      h('div', { class: 'small muted' }, `Plan üretimi: ${plan.usage.inTok}+${plan.usage.outTok} belirteç (${plan.usage.model}). Dış sistemi değiştiren her adımdan önce insan onayı vardır; blog ve sosyal çıktılar yalnızca TASLAK olarak açılır.`),
      h('div', { class: 'row wrap' },
        h('button', { class: 'btn', onclick: async (e) => { e.currentTarget.disabled = true; try { const r = await api.post('/x/orkestra/calistir', { title: title.value, command: cmd.value, steps: plan.steps, idempotencyKey: idemKey }); toast(r.duplicate ? 'Bu plan zaten çalıştırılmış' : 'Çalıştırma başlatıldı', 'ok'); location.hash = `#/orkestra/izleme/${r.id}`; } catch (er) { toast(er.data?.errors?.join(' · ') || er.message, 'err'); e.currentTarget.disabled = false; } } }, icon('rocket', 16), 'Planı onayla ve çalıştır'),
        h('button', { class: 'btn secondary', onclick: () => planBox.replaceChildren() }, 'Vazgeç'))), { ic: 'spark' }));
  };
  const planBtn = h('button', { class: 'btn', onclick: async (e) => {
    if (cmd.value.trim().length < 8) return toast('Komut çok kısa', 'err');
    e.currentTarget.disabled = true; planBox.replaceChildren(spinner('Ana koordinatör planlıyor…'));
    try { idemKey = uuid(); await loadAgents(); await runPlan(await api.post('/x/orkestra/plan', { command: cmd.value })); } catch (er) { planBox.replaceChildren(errorBanner(er)); }
    e.target.disabled = false;
  } }, icon('spark', 16), 'Ana ajan ile planla');
  // hızlı başlat: yerleşik blog taslağı iş akışı
  const topic = h('input', { class: 'input', placeholder: 'Örn: BIM koordinasyonu' }), focus = h('input', { class: 'input', placeholder: 'Odak ifade (isteğe bağlı)' });
  const quick = panel('Hızlı başlat: Blog taslağı iş akışı', h('div', { class: 'stack' }, h('p', { class: 'small muted' }, 'Research → Content → SEO → QA → İnsan onayı → Blog taslağı. Yazı yayınlanmaz; onayınızdan sonra blog editöründe TASLAK olarak açılır.'),
    h('div', { class: 'grid cols-2' }, field('Konu', topic), field('Odak ifade', focus)),
    h('button', { class: 'btn', style: 'justify-self:start', onclick: async (e) => {
      if (topic.value.trim().length < 3) return toast('Konu yazın', 'err');
      e.currentTarget.disabled = true;
      try { const wfs = (await api.get('/x/orkestra/akislar')).workflows; const w = wfs.find((x) => x.builtin); const r = await api.post('/x/orkestra/calistir', { workflowId: w.id, title: `Blog: ${topic.value.trim()}`, params: { topic: topic.value.trim(), focus: focus.value.trim() }, idempotencyKey: uuid() }); toast('Çalıştırma başlatıldı', 'ok'); location.hash = `#/orkestra/izleme/${r.id}`; } catch (er) { toast(er.data?.errors?.join(' · ') || er.message, 'err'); e.currentTarget.disabled = false; }
    } }, icon('rocket', 16), 'İş akışını başlat')), { ic: 'blog' });
  const wfBox = h('div', { class: 'stack' }, spinner());
  (async () => {
    try {
      const { workflows } = await api.get('/x/orkestra/akislar');
      const LABEL = { topic: 'Konu', formId: "Talep numarası (Form talepleri › #sayı)", focus: 'Odak ifade' };
      wfBox.replaceChildren(...workflows.filter((w) => w.builtin && !/^Blog Taslağı/.test(w.name)).map((w) => {
        const ps = paramsOf(w.steps);
        const inputs = Object.fromEntries(ps.map((p) => [p, h('input', { class: 'input', placeholder: LABEL[p] ?? p, inputmode: p === 'formId' ? 'numeric' : undefined })]));
        return h('div', { class: 'card card-pad stack' }, h('b', {}, w.name), h('p', { class: 'small muted' }, w.description), dag(w.steps),
          ps.length ? h('div', { class: 'grid cols-2' }, ps.map((p) => field(LABEL[p] ?? p, inputs[p]))) : null,
          h('button', { class: 'btn', style: 'justify-self:start', onclick: async (e) => {
            const btn = e.currentTarget; btn.disabled = true;
            try {
              const params = Object.fromEntries(ps.map((p) => [p, inputs[p].value.trim()]));
              if (ps.some((p) => !params[p])) throw new Error('Gerekli alanları doldurun');
              const r = params.formId ? await api.post('/x/orkestra/talep-analizi', { formId: Number(params.formId), idempotencyKey: uuid() }) : await api.post('/x/orkestra/calistir', { workflowId: w.id, params, idempotencyKey: uuid() });
              toast('Çalıştırma başlatıldı', 'ok'); location.hash = `#/orkestra/izleme/${r.id}`;
            } catch (er) { toast(er.data?.errors?.join(' · ') || er.message, 'err'); btn.disabled = false; }
          } }, icon('rocket', 14), 'Başlat'));
      }));
    } catch (e) { wfBox.replaceChildren(errorBanner(e)); }
  })();
  root.append(
    h('div', { class: 'dash-grid' }, h('div', { class: 'span-7' }, panel('Türkçe komut', h('div', { class: 'stack' }, cmd,
      h('div', { class: 'row wrap' }, EXAMPLES.map((x, i) => h('button', { class: 'btn ghost sm', onclick: () => { cmd.value = x; } }, `Örnek ${i + 1}`))), h('div', {}, planBtn)), { ic: 'edit' })), h('div', { class: 'span-5' }, quick)),
    panel('Hazır iş akışları', wfBox, { ic: 'rocket', sub: 'Site SEO denetimi · Müşteri talebi analizi · Sosyal gönderi + görsel' }),
    infoBox('Ana Koordinatör komutu yalnızca etkin ve bağlı ajanlarla çalışan bir görev planına ayırır; planı siz onaylamadan hiçbir ajan çalışmaz. Plan model çıktısıdır ve sunucuda yeniden doğrulanır.'),
    planBox);
  return h('div', {}, pageHead('Komut Merkezi', 'Türkçe komutu Ana Koordinatör alt görevlere ayırsın; planı onaylayın, ajanlar çalışsın.', { crumbs: 'Yapay Zekâ Orkestrası' }), subnav(), root);
};

/* ------------------------------ 3) Ajanlar ------------------------------ */
const jsonArea = (v) => { const t = h('textarea', { class: 'textarea mono', rows: 7 }); t.value = JSON.stringify(v, null, 2); return t; };
const editAgent = (a, providers, done) => {
  const f = {
    name: h('input', { class: 'input', value: a.name }), role: h('textarea', { class: 'textarea', rows: 2 }), prompt: h('textarea', { class: 'textarea', rows: 9 }),
    provider: h('select', { class: 'select' }, [['', 'Orkestra varsayılanı'], ...providers.map((p) => [p.id, `${p.label}${p.connected ? '' : ' (bağlı değil)'}`])].map(([v, l]) => h('option', { value: v, selected: v === a.provider }, l))),
    model: h('input', { class: 'input', value: a.model, placeholder: 'boş = sağlayıcı varsayılanı' }),
    retries: h('input', { class: 'input', type: 'number', min: 0, max: 5, value: a.max_retries }), timeout: h('input', { class: 'input', type: 'number', min: 10, max: 600, value: a.timeout_s }), maxTok: h('input', { class: 'input', type: 'number', min: 200, max: 8000, value: a.max_tokens }), daily: h('input', { class: 'input', type: 'number', min: 0, value: a.daily_token_limit ?? 0, disabled: !isAdmin() }),
    appr: h('input', { type: 'checkbox', checked: a.requires_approval }), en: h('input', { type: 'checkbox', checked: a.enabled }),
    inS: jsonArea(a.input_schema), outS: jsonArea(a.output_schema),
  };
  f.role.value = a.role; f.prompt.value = a.system_prompt;
  const history = h('div', { class: 'stack' }, h('b', {}, 'Son çalıştırmalar'), h('div', { class: 'small muted' }, 'Yükleniyor…'));
  api.get(`/x/orkestra/ajanlar/${a.key}/gecmis`).then(({ history: hs }) => history.replaceChildren(h('b', {}, 'Son çalıştırmalar'), hs.length ? h('div', { class: 'tbl-wrap', style: 'max-height:200px;overflow:auto' }, h('table', { class: 'tbl' }, h('tbody', {}, hs.map((x) => h('tr', {}, h('td', { class: 'small muted' }, fmtLocal(x.started_at ?? '')), h('td', {}, h('a', { href: `#/orkestra/izleme/${x.run_id}`, onclick: () => document.querySelector('.overlay')?.remove() }, x.run_title)), h('td', {}, stChip(x.status)), h('td', { class: 'small' }, `${fmtN(x.tokens)} belirteç${x.attempts > 1 ? ` · ${x.attempts} deneme` : ''}`), h('td', { class: 'small', style: 'color:var(--danger)' }, x.error ? String(x.error).slice(0, 60) : ''))))) ) : h('div', { class: 'small muted' }, 'Henüz çalışmadı.'))).catch(() => {});
  const toolBoxes = agentCache.tools.map(([k, label]) => [k, h('input', { type: 'checkbox', checked: a.tools.includes(k) }), label]);
  const m = modal({
    title: `${a.name} — yapılandırma`, wide: true,
    body: h('div', { class: 'stack' },
      a.executable ? null : infoBox(a.notConnectedReason, 'warn'),
      h('div', { class: 'grid cols-2' }, field('Ad', f.name), field('Görev tanımı', f.role)),
      field('Sistem talimatı', f.prompt, 'Güvenlik kuralları (güvenilmez kaynaklara uyma, sır ifşa etme, uydurma yapma) sunucuda her çağrıya EK olarak eklenir; buradan kaldırılamaz.'),
      h('div', { class: 'grid cols-2' }, field('Sağlayıcı', f.provider), field('Model', f.model)),
      h('div', { class: 'grid cols-3' }, field('Yeniden deneme (0–5)', f.retries), field('Zaman aşımı (sn)', f.timeout), field('Çıktı belirteç sınırı', f.maxTok)),
      h('div', { class: 'grid cols-2' }, field('Günlük belirteç limiti (0 = sınırsız)', f.daily), h('div', { class: 'small muted', style: 'align-self:end' }, `Bugün kullanılan: ${fmtN(a.today_tokens ?? 0)} belirteç`)),
      h('div', {}, h('b', {}, 'Araç yetkileri (salt okunur)'), h('div', { class: 'row wrap' }, toolBoxes.map(([, box, label]) => h('label', { class: 'switch' }, box, h('i'), h('span', {}, label))))),
      h('div', { class: 'row wrap' }, h('label', { class: 'switch' }, f.appr, h('i'), h('span', {}, 'Çıktısı insan onayı gerektirir')), h('label', { class: 'switch' }, f.en, h('i'), h('span', {}, 'Ajan açık'))),
      h('div', { class: 'grid cols-2' }, field('Girdi şeması (JSON)', f.inS), field('Çıktı şeması (JSON) — model çıktısı buna göre doğrulanır', f.outS)), history),
    actions: [
      { label: 'Varsayılana sıfırla', class: 'secondary', close: false, onClick: async (close) => { if (!(await confirmBox({ title: 'Ajan varsayılana dönsün mü?', message: 'Talimat, araç ve şema ayarları varsayılana döner.', confirmLabel: 'Sıfırla' }))) return false; try { await api.post(`/x/orkestra/ajanlar/${a.key}/sifirla`); toast('Sıfırlandı', 'ok'); close(); done(); } catch (e) { toast(e.message, 'err'); return false; } } },
      { label: 'Kapat', class: 'secondary' },
      { label: 'Kaydet', close: false, onClick: async (close) => {
        let inS, outS;
        try { inS = JSON.parse(f.inS.value); outS = JSON.parse(f.outS.value); } catch { toast('Şema geçerli JSON olmalı', 'err'); return false; }
        try { await api.put(`/x/orkestra/ajanlar/${a.key}`, { name: f.name.value, role: f.role.value, system_prompt: f.prompt.value, provider: f.provider.value, model: f.model.value.trim(), max_retries: Number(f.retries.value), timeout_s: Number(f.timeout.value), max_tokens: Number(f.maxTok.value), daily_token_limit: Number(f.daily.value), tools: toolBoxes.filter(([, b]) => b.checked).map(([k]) => k), requires_approval: f.appr.checked, enabled: f.en.checked, input_schema: inS, output_schema: outS }); toast('Ajan kaydedildi', 'ok'); close(); done(); } catch (e) { toast(e.message, 'err'); return false; }
      } }],
  });
  return m;
};
export const renderAgents = wrap('Ajan Yönetimi', '12 yapılandırılabilir ajan: talimat, model, araç yetkisi, şema, hata yönetimi ve çalıştırma geçmişi.', async (load) => {
  const [d, an, st] = await Promise.all([loadAgents(true), api.get('/x/orkestra/analitik?gun=30'), api.get('/x/orkestra/ayarlar')]);
  const usage = Object.fromEntries(an.byAgent.map((x) => [x.agent, x]));
  return [
    isAdmin() ? null : infoBox('Ajan ayarlarını yalnızca yönetici değiştirebilir; siz görüntüleyebilirsiniz.'),
    h('div', { class: 'agent-grid' }, d.agents.map((a) => {
      const u = usage[a.key];
      return h('div', { class: `card card-pad stack agent-card ${a.executable && a.enabled ? '' : 'off'}` },
        h('div', { class: 'row' }, h('b', { class: 'grow' }, a.name), a.executable ? (a.enabled ? chip('Hazır', 'ok') : chip('Kapalı')) : chip('Bağlı değil', 'warn')),
        h('div', { class: 'small muted' }, a.role),
        a.executable ? null : h('div', { class: 'small', style: 'color:var(--warn)' }, a.notConnectedReason),
        h('div', { class: 'row wrap small' }, chip(a.model || a.provider ? `${a.provider || 'varsayılan'} · ${a.model || 'varsayılan model'}` : 'varsayılan model'), a.requires_approval ? chip('Onay gerekir', 'warn') : null, ...a.tools.map((t) => chip(t))),
        h('div', { class: 'small muted' }, u ? `Son 30 gün: ${u.tasks} görev · ${fmtN(u.tokens_in + u.tokens_out)} belirteç · ${u.failed} hata · ${u.retried} yeniden deneme` : 'Son 30 günde çalışmadı'),
        a.daily_token_limit ? h('div', { class: 'small muted' }, `Bugün: ${fmtN(a.today_tokens)} / ${fmtN(a.daily_token_limit)} belirteç`) : null,
        h('div', { class: 'row wrap' }, h('button', { class: 'btn secondary sm', onclick: () => editAgent(a, st.providers, load) }, icon('edit', 14), isAdmin() ? 'Yapılandır' : 'Görüntüle'), h('a', { class: 'btn ghost sm', href: '#/orkestra/kayit' }, 'Geçmiş')));
    })),
  ];
});

/* ------------------------------ 4) İş Akışı Oluşturucu ------------------------------ */
const paramsOf = (steps) => [...new Set(JSON.stringify(steps).match(/\{\{\s*([a-z0-9_]+)\s*\}\}/gi)?.map((x) => x.replace(/[{}\s]/g, '')) ?? [])];
export const renderWorkflows = async (ctx) => {
  ctx.setTitle('İş Akışı Oluşturucu');
  const root = h('div', { class: 'stack' });
  let current = null; // { id, name, description, builtin, steps }
  const draw = async () => {
    const [{ workflows }, d] = await Promise.all([api.get('/x/orkestra/akislar'), loadAgents()]);
    if (current && current.id && !workflows.some((w) => w.id === current.id)) current = null;
    const side = h('div', { class: 'stack' }, panel('Kayıtlı iş akışları', h('div', {}, workflows.map((w) => h('button', { class: `listrow link ${current?.id === w.id ? 'on' : ''}`, onclick: () => { current = structuredClone(w); draw(); } }, h('div', { class: 'grow' }, h('b', {}, w.name), h('span', {}, `${w.steps.length} adım`)), w.builtin ? chip('Yerleşik', 'info') : null))), { ic: 'archive', action: isAdmin() ? h('button', { class: 'btn sm', onclick: () => { current = { id: 0, name: '', description: '', builtin: false, steps: [{ ref: 'adim1', kind: 'agent', agent: 'research', title: 'Araştırma', depends_on: [], input: { topic: '{{topic}}' } }] }; draw(); } }, icon('plus', 14), 'Yeni') : null }));
    root.replaceChildren(h('div', { class: 'dash-grid' }, h('div', { class: 'span-4' }, side), h('div', { class: 'span-8' }, current ? editor(d) : panel('İş akışı seçin', empty('Soldan bir iş akışı seçin veya yeni oluşturun.'), { ic: 'rocket' }))));
  };
  const editor = (d) => {
    const w = current, ro = w.builtin || !isAdmin();
    const name = h('input', { class: 'input', value: w.name, disabled: ro }), desc = h('input', { class: 'input', value: w.description, disabled: ro });
    const msg = h('div', {});
    const stepsBox = h('div', { class: 'stack' });
    const execAgents = d.agents.filter((a) => a.executable && a.key !== 'master');
    const drawSteps = () => {
      stepsBox.replaceChildren(...w.steps.map((s, i) => {
        const others = w.steps.filter((x) => x !== s);
        const agentSel = h('select', { class: 'select', disabled: ro, onchange: (e) => { s.agent = e.target.value; } }, (s.kind === 'agent' ? execAgents.map((a) => [a.key, a.name]) : s.kind === 'action' ? d.actions.map((a) => [a.key, a.label]) : [['', '—']]).map(([k, l]) => h('option', { value: k, selected: k === s.agent }, l)));
        const kindSel = h('select', { class: 'select', disabled: ro, onchange: (e) => { s.kind = e.target.value; s.agent = s.kind === 'agent' ? execAgents[0].key : s.kind === 'action' ? d.actions[0].key : ''; drawSteps(); } }, Object.entries(KIND).map(([k, l]) => h('option', { value: k, selected: k === s.kind }, l)));
        const inp = h('textarea', { class: 'textarea mono', rows: 2, disabled: ro }); inp.value = JSON.stringify(s.input ?? {});
        inp.addEventListener('change', () => { try { s.input = JSON.parse(inp.value || '{}'); inp.classList.remove('bad'); } catch { inp.classList.add('bad'); } });
        return h('div', { class: 'card card-pad stack wf-step' },
          h('div', { class: 'grid cols-3' }, field('Kod (ref)', h('input', { class: 'input', value: s.ref, disabled: ro, oninput: (e) => { const old = s.ref; s.ref = e.target.value.trim(); w.steps.forEach((x) => { x.depends_on = x.depends_on.map((r) => (r === old ? s.ref : r)); }); } })), field('Tür', kindSel), field('Ajan / eylem', agentSel)),
          field('Başlık', h('input', { class: 'input', value: s.title, disabled: ro, oninput: (e) => { s.title = e.target.value; } })),
          h('div', {}, h('b', { class: 'small' }, 'Bağımlılıklar (bunlar bitince başlar)'), h('div', { class: 'row wrap' }, others.length ? others.map((o) => h('label', { class: 'switch' }, h('input', { type: 'checkbox', checked: s.depends_on.includes(o.ref), disabled: ro, onchange: (e) => { s.depends_on = e.target.checked ? [...s.depends_on, o.ref] : s.depends_on.filter((r) => r !== o.ref); } }), h('i'), h('span', {}, o.ref))) : h('span', { class: 'muted small' }, 'Başka adım yok'))),
          s.kind === 'agent' ? field('Girdi (JSON; {{parametre}} kullanılabilir)', inp) : null,
          ro ? null : h('div', { class: 'row' }, h('button', { class: 'btn ghost sm', onclick: () => { w.steps.splice(i, 1); drawSteps(); } }, icon('trash', 14), 'Adımı sil')));
      }));
    };
    drawSteps();
    const validate = async () => { try { const r = await api.post('/x/orkestra/akislar/dogrula', { steps: w.steps }); msg.replaceChildren(r.ok ? infoBox('İş akışı geçerli: bağımlılıklar, ajanlar ve onay kuralları doğrulandı.', 'ok') : h('div', { class: 'banner danger' }, icon('alert'), h('ul', {}, r.errors.map((e) => h('li', {}, e))))); return r.ok; } catch (e) { msg.replaceChildren(errorBanner(e)); return false; } };
    const save = async () => { if (!(await validate())) return; try { const body = { name: name.value, description: desc.value, steps: w.steps }; const res = w.id ? await api.put(`/x/orkestra/akislar/${w.id}`, body) : await api.post('/x/orkestra/akislar', body); toast('Kaydedildi', 'ok'); current = { ...w, id: res.id, name: name.value, description: desc.value }; draw(); } catch (e) { toast(e.data?.errors?.join(' · ') || e.message, 'err'); } };
    const run = () => {
      const ps = paramsOf(w.steps);
      const inputs = Object.fromEntries(ps.map((p) => [p, h('input', { class: 'input' })]));
      modal({ title: `Çalıştır: ${w.name}`, body: h('div', { class: 'stack' }, ps.length ? ps.map((p) => field(p, inputs[p])) : h('p', {}, 'Bu iş akışı parametre istemiyor.')), actions: [{ label: 'Vazgeç', class: 'secondary' }, { label: 'Çalıştır', close: false, onClick: async (close) => {
        try { const r = await api.post('/x/orkestra/calistir', w.id ? { workflowId: w.id, params: Object.fromEntries(ps.map((p) => [p, inputs[p].value])), idempotencyKey: uuid() } : { title: name.value || 'Adsız', steps: w.steps, params: Object.fromEntries(ps.map((p) => [p, inputs[p].value])), idempotencyKey: uuid() }); close(); location.hash = `#/orkestra/izleme/${r.id}`; } catch (e) { toast(e.data?.errors?.join(' · ') || e.message, 'err'); return false; }
      } }] });
    };
    return h('div', { class: 'stack' }, panel(w.builtin ? `${w.name} (yerleşik, salt okunur)` : w.id ? 'İş akışını düzenle' : 'Yeni iş akışı', h('div', { class: 'stack' },
      w.builtin ? infoBox('Yerleşik iş akışı değiştirilemez; "Kopyasını düzenle" ile kendi sürümünüzü oluşturabilirsiniz.') : null,
      h('div', { class: 'grid cols-2' }, field('Ad', name), field('Açıklama', desc)),
      dag(w.steps), msg, stepsBox,
      h('div', { class: 'row wrap' },
        ro ? null : h('button', { class: 'btn secondary', onclick: () => { w.steps.push({ ref: `adim${w.steps.length + 1}`, kind: 'agent', agent: execAgents[0].key, title: 'Yeni adım', depends_on: [], input: {} }); drawSteps(); } }, icon('plus', 14), 'Adım ekle'),
        h('button', { class: 'btn secondary', onclick: validate }, icon('check', 14), 'Doğrula'),
        ro ? null : h('button', { class: 'btn', onclick: save }, 'Kaydet'),
        w.builtin && isAdmin() ? h('button', { class: 'btn secondary', onclick: () => { current = { ...structuredClone(w), id: 0, builtin: false, name: `${w.name} (kopya)`.slice(0, 100) }; draw(); } }, 'Kopyasını düzenle') : null,
        h('button', { class: 'btn', onclick: run }, icon('rocket', 14), 'Çalıştır'),
        isAdmin() && w.id && !w.builtin ? h('button', { class: 'btn danger secondary', onclick: async () => { if (await confirmBox({ title: 'İş akışı silinsin mi?', message: w.name, confirmLabel: 'Sil', danger: true })) { await api.del(`/x/orkestra/akislar/${w.id}`); current = null; draw(); } } }, 'Sil') : null)), { ic: 'rocket' }));
  };
  try { await draw(); } catch (e) { root.replaceChildren(errorBanner(e)); }
  return h('div', {}, pageHead('İş Akışı Oluşturucu', 'Ajan, onay ve eylem adımlarından bağımlılıklı iş akışları oluşturun; sıralı veya paralel çalıştırın.', { crumbs: 'Yapay Zekâ Orkestrası' }), subnav(), root);
};

/* ------------------------------ 5) Görev İzleme ------------------------------ */
const dur = (a, b) => { if (!a) return '—'; const s = Math.round((new Date(`${(b ?? new Date().toISOString().slice(0, 19).replace('T', ' ')).replace(' ', 'T')}Z`) - new Date(`${a.replace(' ', 'T')}Z`)) / 1000); return s < 60 ? `${Math.max(s, 0)} sn` : `${Math.floor(s / 60)} dk ${s % 60} sn`; };
const approvalBtns = (t, after) => h('span', { class: 'row' },
  h('button', { class: 'btn sm', onclick: async () => { const out = t.output ?? {}; let ack = false; if (out.qa_passed === false) { ack = await confirmBox({ title: 'QA kritik bulgu bildirdi', message: 'Kritik bulguları gördüğünüzü onaylıyor musunuz?', confirmLabel: 'Gördüm, onayla' }); if (!ack) return; } try { await api.post(`/x/orkestra/gorevler/${t.id}/onayla`, { ack }); toast('Onaylandı', 'ok'); after(); } catch (e) { toast(e.message, 'err'); } } }, icon('check', 14), 'Onayla'),
  h('button', { class: 'btn danger secondary sm', onclick: async () => { const note = prompt('Red gerekçesi (isteğe bağlı):') ?? null; if (note === null) return; try { await api.post(`/x/orkestra/gorevler/${t.id}/reddet`, { note }); toast('Reddedildi', 'ok'); after(); } catch (e) { toast(e.message, 'err'); } } }, 'Reddet'));
const runDetail = async (id, load) => {
  await loadAgents();
  const d = await api.get(`/x/orkestra/calistirmalar/${id}`);
  const r = d.run;
  const steps = d.tasks.map((t) => ({ ref: t.ref, kind: t.kind, agent: t.agent, title: t.title, depends_on: t.depends_on }));
  const active = ['queued', 'running', 'awaiting_approval', 'paused'].includes(r.status);
  const act = async (path, msg) => { try { await api.post(`/x/orkestra/calistirmalar/${id}/${path}`); toast(msg, 'ok'); load(); } catch (e) { toast(e.message, 'err'); } };
  const pauseBtn = ['queued', 'running', 'awaiting_approval'].includes(r.status) ? h('button', { class: 'btn secondary sm', title: 'Devam eden görevler tamamlanır, yenisi başlamaz', onclick: () => act('duraklat', 'Duraklatıldı') }, 'Duraklat') : r.status === 'paused' ? h('button', { class: 'btn sm', onclick: () => act('devam', 'Devam ediyor') }, 'Devam ettir') : null;
  return [
    h('div', { class: 'row wrap' }, h('a', { class: 'btn ghost sm', href: '#/orkestra/izleme' }, icon('chevron', 14), 'Tüm çalıştırmalar'), h('h2', { class: 'grow' }, r.title), stChip(r.status),
      pauseBtn,
      active ? h('button', { class: 'btn danger secondary sm', onclick: async () => { if (await confirmBox({ title: 'Çalıştırma iptal edilsin mi?', message: 'Bekleyen görevler iptal edilir; devam eden görevin sonucu atılır.', confirmLabel: 'İptal et', danger: true })) { try { await api.post(`/x/orkestra/calistirmalar/${id}/iptal`); toast('İptal edildi', 'ok'); load(); } catch (e) { toast(e.message, 'err'); } } } }, 'İptal et') : null),
    r.error ? h('div', { class: 'banner danger' }, icon('alert'), h('div', {}, r.error)) : null,
    h('div', { class: 'kpis' },
      kpiCard({ ic: 'bolt', label: 'Durum', value: ST[r.status]?.[0] ?? r.status, color: '#0b7bd6', deltaLabel: `${fmtLocal(r.created_at)} · ${r.created_by ?? ''}` }),
      kpiCard({ ic: 'chart', label: 'Belirteç', value: fmtN(r.tokens_in + r.tokens_out), color: '#8b5cf6', deltaLabel: `${fmtN(r.tokens_in)} girdi · ${fmtN(r.tokens_out)} çıktı${r.token_limit ? ` · limit ${fmtN(r.token_limit)}` : ''}` }),
      kpiCard({ ic: 'scale', label: 'Maliyet (tahmin)', value: usd(r.cost_est), color: '#28c76f', deltaLabel: 'fiyat tanımlıysa' }),
      kpiCard({ ic: 'log', label: 'Süre', value: dur(r.started_at ?? r.created_at, r.finished_at), color: '#ff9f43' })),
    panel('İş akışı', dag(steps, Object.fromEntries(d.tasks.map((t) => [t.ref, t.status]))), { ic: 'rocket' }),
    panel('Görevler', h('div', { class: 'stack' }, d.tasks.map((t) => h('details', { class: 'taskrow', open: t.status === 'awaiting_approval' || t.status === 'failed' },
      h('summary', {}, h('span', { class: 'grow' }, h('b', {}, t.title), h('span', { class: 'muted small' }, ` · ${t.kind === 'agent' ? agentName(t.agent) : KIND[t.kind]}${t.attempts ? ` · deneme ${t.attempts}/${t.max_attempts}` : ''}${t.tokens_in + t.tokens_out ? ` · ${fmtN(t.tokens_in + t.tokens_out)} belirteç` : ''}${t.started_at ? ` · ${dur(t.started_at, t.finished_at)}` : ''}`)), stChip(t.status)),
      h('div', { class: 'taskbody stack' },
        t.error ? h('div', { class: 'banner danger' }, icon('alert'), h('div', {}, t.error)) : null,
        t.approval_state === 'approved' || t.approval_state === 'rejected' ? h('div', { class: 'small muted' }, `${t.approval_state === 'approved' ? 'Onaylayan' : 'Reddeden'}: ${t.approved_by} · ${fmtLocal(t.approved_at)}${t.approval_note ? ` · "${t.approval_note}"` : ''}`) : null,
        t.status === 'awaiting_approval' ? approvalBtns(t, load) : null,
        t.status === 'failed' && t.approval_state !== 'rejected' ? h('button', { class: 'btn secondary sm', style: 'justify-self:start', onclick: async () => { try { await api.post(`/x/orkestra/gorevler/${t.id}/yeniden-dene`); toast('Yeniden başlatıldı', 'ok'); load(); } catch (e) { toast(e.message, 'err'); } } }, 'Yeniden dene') : null,
        t.output ? outputView(t.kind === 'agent' ? t.agent : t.kind === 'approval' ? 'gate' : t.agent, t.output) : null)))), { ic: 'log' }),
    panel('Olay günlüğü', d.events.length ? h('div', { class: 'tbl-wrap', style: 'max-height:260px;overflow:auto' }, h('table', { class: 'tbl' }, h('tbody', {}, d.events.map((e) => h('tr', {}, h('td', { class: 'small muted' }, fmtLocal(e.ts)), h('td', {}, chip(levelTr(e.level), e.level === 'error' ? 'danger' : e.level === 'warn' ? 'warn' : '')), h('td', { class: 'small' }, eventTr(e.event)), h('td', { class: 'small' }, e.message)))))) : empty('Olay yok.'), { ic: 'history' }),
  ];
};
export const renderMonitor = async (ctx, runId) => {
  ctx.setTitle('Görev İzleme');
  const root = h('div', { class: 'stack' });
  const filter = { status: '' };
  const load = async (silent = false) => {
    if (!silent) root.replaceChildren(spinner());
    try {
      if (runId) { root.replaceChildren(...(await runDetail(runId, load))); return; }
      await loadAgents();
      const { runs } = await api.get(`/x/orkestra/calistirmalar?durum=${filter.status}&limit=60`);
      const sel = h('select', { class: 'select', onchange: (e) => { filter.status = e.target.value; load(); } }, [['', 'Tüm durumlar'], ...Object.entries(ST).filter(([k]) => ['queued', 'running', 'awaiting_approval', 'succeeded', 'failed', 'cancelled'].includes(k)).map(([k, v]) => [k, v[0]])].map(([k, l]) => h('option', { value: k, selected: k === filter.status }, l)));
      root.replaceChildren(h('div', { class: 'row' }, sel), runs.length ? h('div', { class: 'card' }, h('div', { class: 'tbl-wrap' }, h('table', { class: 'tbl' }, h('thead', {}, h('tr', {}, ['#', 'Çalıştırma', 'Durum', 'İlerleme', 'Belirteç', 'Oluşturan', 'Zaman'].map((x) => h('th', {}, x)))),
        h('tbody', {}, runs.map((r) => h('tr', { class: 'clickable', onclick: () => { location.hash = `#/orkestra/izleme/${r.id}`; } }, h('td', {}, r.id), h('td', {}, h('b', {}, r.title)), h('td', {}, stChip(r.status)), h('td', {}, `${r.done_count}/${r.task_count}`), h('td', {}, fmtN(r.tokens_in + r.tokens_out)), h('td', { class: 'small' }, r.created_by ?? '—'), h('td', { class: 'small muted' }, fmtLocal(r.created_at)))))))) : empty('Çalıştırma yok.'));
    } catch (e) { root.replaceChildren(errorBanner(e)); }
  };
  load();
  live(root, () => load(true), 3000);
  return h('div', {}, pageHead('Görev İzleme', 'Çalıştırmaları, hangi ajanda olduğunu ve tamamlanma durumunu canlı izleyin.', { crumbs: 'Yapay Zekâ Orkestrası' }), subnav(), root);
};

/* ------------------------------ 6) Onay Merkezi ------------------------------ */
export const renderApprovals = wrap('İnsan Onay Merkezi', 'Ajan çıktıları ve eylemler yalnızca sizin onayınızdan sonra ilerler. Blog ve sosyal çıktılar taslak olarak açılır, yayınlanmaz.', async (load) => {
  await loadAgents();
  const { approvals } = await api.get('/x/orkestra/onaylar');
  if (!approvals.length) return [empty('Onay bekleyen görev yok.')];
  return approvals.map((a) => {
    const ctx = a.context ?? {};
    const out = a.output ?? {};
    const content = Object.values(ctx).find((c) => c?.body && c?.category && !c?.internal_links);
    const seo = Object.values(ctx).find((c) => c?.internal_links);
    const qa = Object.values(ctx).find((c) => typeof c?.passed === 'boolean' && c?.issues);
    const final = seo?.body ?? content?.body;
    return h('div', { class: 'card card-pad stack' },
      h('div', { class: 'row wrap' }, h('b', { class: 'grow' }, `${a.title}`), h('span', { class: 'muted small' }, `${a.run_title} · ${a.run_by ?? ''}`), chip(a.kind === 'approval' ? 'İnsan onayı' : `${agentName(a.agent)} çıktısı`, 'warn')),
      a.kind === 'approval' ? outputView('gate', out) : outputView(a.agent, out),
      qa ? h('details', { open: !qa.passed }, h('summary', {}, `Kalite raporu — ${qa.passed ? 'geçti' : `${qa.blocking_count} kritik bulgu`}`), outputView('qa', qa)) : null,
      seo ? h('details', {}, h('summary', {}, 'SEO raporu'), outputView('seo', seo)) : null,
      ...Object.values(ctx).filter((c) => c?.draft_reply || (c?.stage && c?.priority) || (c?.template && c?.theme) || Array.isArray(c?.posts) || c?.media).map((c) => h('details', { open: true }, h('summary', {}, c.draft_reply ? 'Talep analizi ve yanıt taslağı' : c.stage ? 'CRM fırsat önerisi' : c.template ? 'Görsel kurgusu' : c.media ? 'Üretilen görsel' : 'Sosyal gönderi metinleri'), outputView(null, c))),
      final ? h('details', {}, h('summary', {}, `Taslak metni (${final.split(/\s+/).length} sözcük)`), h('pre', { class: 'ov-pre' }, final)) : null,
      approvalBtns(a, load), h('a', { class: 'small', href: `#/orkestra/izleme/${a.run_id}` }, 'Çalıştırma ayrıntısı'));
  });
}, { refresh: 8000 });

/* ------------------------------ 7) Model ve API ------------------------------ */
export const renderModelConfig = wrap('Model ve API Yapılandırması', 'Sağlayıcılar, varsayılan model, eşzamanlılık ve belirteç sınırları. API anahtarları yalnızca sunucuda şifreli tutulur.', async (load) => {
  const [st, d] = await Promise.all([api.get('/x/orkestra/ayarlar'), loadAgents(true)]);
  const s = st.settings;
  const prov = h('select', { class: 'select', disabled: !isAdmin() }, [['', 'Otomatik (bağlı ilk sağlayıcı)'], ...st.providers.map((p) => [p.id, `${p.label}${p.connected ? '' : ' (bağlı değil)'}`])].map(([v, l]) => h('option', { value: v, selected: v === s.provider }, l)));
  const conc = h('input', { class: 'input', type: 'number', min: 1, max: 6, value: s.concurrency, disabled: !isAdmin() });
  const lim = h('input', { class: 'input', type: 'number', min: 0, value: s.tokenLimit, disabled: !isAdmin() });
  const dlim = h('input', { class: 'input', type: 'number', min: 0, value: s.dailyTokenLimit ?? 0, disabled: !isAdmin() });
  const aiImg = h('input', { type: 'checkbox', checked: s.aiImage !== false, disabled: !isAdmin() });
  return [
    st.fake ? infoBox('TEST MODU: ORCH_FAKE_LLM=1 — ajanlar gerçek model yerine deterministik sahte yanıt üretiyor. Canlı ortamda bu değişken kullanılmaz (NODE_ENV=production iken devre dışıdır).', 'warn') : null,
    panel('Sağlayıcılar', h('div', { class: 'tbl-wrap' }, h('table', { class: 'tbl' }, h('thead', {}, h('tr', {}, ['Sağlayıcı', 'Durum', 'Model', 'Bu ay', 'Aylık bütçe'].map((x) => h('th', {}, x)))),
      h('tbody', {}, st.providers.map((p) => h('tr', {}, h('td', {}, h('b', {}, p.label)), h('td', {}, p.connected ? chip('Bağlı', 'ok') : chip('Bağlantı gerekli', 'warn')), h('td', { class: 'mono small' }, p.model), h('td', { class: 'small' }, `${p.month.calls} çağrı · ${fmtN(p.month.inputTokens + p.month.outputTokens)} belirteç`), h('td', { class: 'small' }, p.budget ? fmtN(p.budget) : 'sınırsız')))))),
      { ic: 'plug', action: h('a', { class: 'btn secondary sm', href: '#/entegrasyonlar' }, 'API anahtarı / bütçe') }),
    panel('Orkestrasyon ayarları', h('div', { class: 'stack' },
      h('div', { class: 'grid cols-3' }, field('Varsayılan sağlayıcı', prov), field('Eşzamanlı görev (1–6)', conc), field('Çalıştırma başına belirteç limiti (0 = sınırsız)', lim), field('Günlük genel belirteç limiti (0 = sınırsız)', dlim)),
      h('label', { class: 'switch' }, aiImg, h('i'), h('span', {}, 'Design ajanı: onaydan sonra Yapay Zekâ ile arka plan görseli üret (Gemini/OpenAI görsel kotası gerekir; yoksa şablon kullanılır)')),
      h('p', { class: 'small muted' }, 'Belirteç limiti aşılan çalıştırma durdurulur. Aylık sağlayıcı bütçesi Entegrasyonlar sayfasındadır ve Orkestra çağrıları için de geçerlidir. Test ve canlı ortam ayrımı: ORCH_FAKE_LLM yalnızca NODE_ENV≠production iken çalışır.'),
      isAdmin() ? h('button', { class: 'btn', style: 'justify-self:start', onclick: async () => { try { await api.put('/x/orkestra/ayarlar', { provider: prov.value, concurrency: Number(conc.value), tokenLimit: Number(lim.value), dailyTokenLimit: Number(dlim.value), aiImage: aiImg.checked }); toast('Kaydedildi', 'ok'); load(); } catch (e) { toast(e.message, 'err'); } } }, 'Kaydet') : infoBox('Ayarları yalnızca yönetici değiştirebilir.')), { ic: 'gear' }),
    panel('Ajan bazlı model', h('div', { class: 'tbl-wrap' }, h('table', { class: 'tbl' }, h('thead', {}, h('tr', {}, ['Ajan', 'Sağlayıcı', 'Model', ''].map((x) => h('th', {}, x)))),
      h('tbody', {}, d.agents.filter((a) => a.executable).map((a) => {
        const ps = h('select', { class: 'select', disabled: !isAdmin() }, [['', 'Orkestra varsayılanı'], ...st.providers.map((p) => [p.id, p.label])].map(([v, l]) => h('option', { value: v, selected: v === a.provider }, l)));
        const md = h('input', { class: 'input', value: a.model, placeholder: 'boş = varsayılan', disabled: !isAdmin() });
        return h('tr', {}, h('td', {}, h('b', {}, a.name)), h('td', {}, ps), h('td', {}, md), h('td', {}, isAdmin() ? h('button', { class: 'btn secondary sm', onclick: async () => { try { await api.put(`/x/orkestra/ajanlar/${a.key}`, { provider: ps.value, model: md.value.trim() }); toast('Kaydedildi', 'ok'); } catch (e) { toast(e.message, 'err'); } } }, 'Kaydet') : null));
      })))), { ic: 'spark' }),
  ];
});

/* ------------------------------ 8) Kayıtlar & Analitik ------------------------------ */
export const renderLogs = async (ctx) => {
  ctx.setTitle('Çalıştırma Kayıtları ve Analiz');
  const root = h('div', { class: 'stack' });
  const f = { days: 30, level: '', run: '' };
  const load = async () => {
    root.replaceChildren(spinner());
    try {
      await loadAgents();
      const [an, ev] = await Promise.all([api.get(`/x/orkestra/analitik?gun=${f.days}`), api.get(`/x/orkestra/olaylar?seviye=${f.level}&calistirma=${f.run}&limit=120`)]);
      const days = [...Array(Math.min(f.days, 30))].map((_, i) => new Date(Date.now() - (Math.min(f.days, 30) - 1 - i) * 86_400_000).toLocaleDateString('sv-SE'));
      const dsel = h('select', { class: 'select', onchange: (e) => { f.days = Number(e.target.value); load(); } }, [7, 30, 90].map((n) => h('option', { value: n, selected: n === f.days }, `Son ${n} gün`)));
      const lsel = h('select', { class: 'select', onchange: (e) => { f.level = e.target.value; load(); } }, [['', 'Tüm seviyeler'], ['info', 'Bilgi'], ['warn', 'Uyarı'], ['error', 'Hata']].map(([k, l]) => h('option', { value: k, selected: k === f.level }, l)));
      const rin = h('input', { class: 'input', placeholder: 'Çalıştırma no', value: f.run, style: 'max-width:140px', onchange: (e) => { f.run = e.target.value.replace(/\D/g, ''); load(); } });
      const tot = an.byAgent.reduce((a, x) => ({ t: a.t + x.tasks, i: a.i + x.tokens_in, o: a.o + x.tokens_out, c: a.c + x.cost, f: a.f + x.failed }), { t: 0, i: 0, o: 0, c: 0, f: 0 });
      root.replaceChildren(
        h('div', { class: 'row wrap' }, dsel),
        h('div', { class: 'kpis' }, kpiCard({ ic: 'bolt', label: 'Ajan görevi', value: tot.t, color: '#0b7bd6' }), kpiCard({ ic: 'chart', label: 'Belirteç', value: fmtN(tot.i + tot.o), color: '#8b5cf6', deltaLabel: `${fmtN(tot.i)} girdi · ${fmtN(tot.o)} çıktı` }), kpiCard({ ic: 'scale', label: 'Maliyet (tahmin)', value: usd(tot.c || null), color: '#28c76f', deltaLabel: tot.c ? '' : 'sağlayıcı fiyatı tanımsız' }), kpiCard({ ic: 'alert', label: 'Başarısız görev', value: tot.f, color: '#ea5455', goodUp: false })),
        h('div', { class: 'dash-grid' },
          h('div', { class: 'span-7' }, panel('Günlük görev ve belirteç', areaChart({ labels: days.map((d) => d.slice(5)), series: [{ name: 'Görev', color: '#0b7bd6', values: days.map((d) => an.byDay.find((x) => x.day === d)?.tasks ?? 0) }], height: 200 }), { ic: 'chart' })),
          h('div', { class: 'span-5' }, panel('Belirteç (ajan başına)', hbars(an.byAgent.filter((a) => a.tokens_in + a.tokens_out).map((a) => ({ label: agentName(a.agent), value: a.tokens_in + a.tokens_out })), { empty: 'Veri yok' }), { ic: 'spark' })),
          h('div', { class: 'span-12' }, panel('Ajan performansı', an.byAgent.length ? h('div', { class: 'tbl-wrap' }, h('table', { class: 'tbl' }, h('thead', {}, h('tr', {}, ['Ajan', 'Görev', 'Girdi belirteç', 'Çıktı belirteç', 'Maliyet', 'Hata', 'Yeniden deneme'].map((x) => h('th', {}, x)))),
            h('tbody', {}, an.byAgent.map((a) => h('tr', {}, h('td', {}, h('b', {}, agentName(a.agent))), h('td', {}, a.tasks), h('td', {}, fmtN(a.tokens_in)), h('td', {}, fmtN(a.tokens_out)), h('td', {}, usd(a.cost || null)), h('td', {}, a.failed ? chip(String(a.failed), 'danger') : '0'), h('td', {}, a.retried)))))) : empty('Bu aralıkta ajan görevi yok.'), { ic: 'users' }))),
        panel('Yürütme kayıtları', h('div', { class: 'stack' }, h('div', { class: 'row wrap' }, lsel, rin), ev.events.length ? h('div', { class: 'tbl-wrap', style: 'max-height:380px;overflow:auto' }, h('table', { class: 'tbl' }, h('thead', {}, h('tr', {}, ['Zaman', 'Seviye', 'Çalıştırma', 'Ajan', 'Olay', 'Mesaj'].map((x) => h('th', {}, x)))),
          h('tbody', {}, ev.events.map((e) => h('tr', {}, h('td', { class: 'small muted' }, fmtLocal(e.ts)), h('td', {}, chip(levelTr(e.level), e.level === 'error' ? 'danger' : e.level === 'warn' ? 'warn' : '')), h('td', {}, e.run_id ? h('a', { href: `#/orkestra/izleme/${e.run_id}` }, `#${e.run_id}`) : '—'), h('td', { class: 'small' }, e.agent ? agentName(e.agent) : '—'), h('td', { class: 'small' }, eventTr(e.event)), h('td', { class: 'small' }, e.message)))))) : empty('Kayıt yok.')), { ic: 'log' }));
    } catch (e) { root.replaceChildren(errorBanner(e)); }
  };
  load();
  return h('div', {}, pageHead('Çalıştırma Kayıtları ve Analiz', 'Yürütme kayıtları, belirteç ve maliyet takibi, ajan başarı/hata oranları. Kayıtlara gizli bilgi yazılmaz.', { crumbs: 'Yapay Zekâ Orkestrası' }), subnav(), root);
};
