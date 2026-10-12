// Kullanıcı tanımlı KPI sistemi: GERÇEK veriden hesaplanan metrik kataloğu + kullanıcı başına kart/hedef tercihleri.
import { q, getSetting, setSetting, audit } from '../db.mjs';
import { HttpError } from '../http.mjs';
import { getStats } from '../stats.mjs';
import { scanSite } from './seo.mjs';
import './schema.mjs';
import { listEntries } from '../entries.mjs';

const dayStr = (offset) => new Date(Date.now() - offset * 86_400_000).toLocaleDateString('sv-SE', { timeZone: 'Europe/Istanbul' });
const days = (n) => Array.from({ length: n }, (_, i) => dayStr(n - 1 - i));

/** SQL: "SELECT <day> AS day, <v> AS v FROM ... WHERE day >= ?" biçiminde; N+N gün (önceki dönem karşılaştırması için) */
const series = (sql, n) => {
  const since = dayStr(2 * n - 1);
  const map = new Map(q.all(sql, since).map((r) => [r.day, Number(r.v) || 0]));
  const all = days(2 * n).map((d) => map.get(d) ?? 0);
  return { cur: all.slice(n), prev: all.slice(0, n) };
};
const ist = (col) => `date(${col}, '+3 hours')`;
const sum = (a) => a.reduce((x, y) => x + y, 0);

const rate = (num, den) => num.map((v, i) => (den[i] ? (v / den[i]) * 100 : 0));

const flowMetric = (sql) => (n) => {
  const s = series(sql, n);
  return { value: sum(s.cur), prev: sum(s.prev), series: s.cur };
};
const snap = (fn) => () => ({ value: fn(), prev: null, series: [] });

/** id → {label, group, unit, icon, color, goodUp, hint, compute(n)} */
export const CATALOG = {
  visits: { label: 'Site ziyareti', group: 'Trafik', icon: 'eye', color: '#7367f0', hint: 'Çerezsiz sayfa görüntüleme', compute: (n) => {
    const s = getStats(2 * n).daily.map((d) => d.views);
    return { value: sum(s.slice(n)), prev: sum(s.slice(0, n)), series: s.slice(n) };
  } },
  forms: { label: 'Form talebi', group: 'Dönüşüm', icon: 'mail', color: '#28c76f', hint: 'Seçili dönemde gelen iletişim/teklif talepleri', compute: flowMetric(`SELECT ${ist('created_at')} AS day, COUNT(*) AS v FROM forms WHERE kind != 'firsat' AND ${ist('created_at')} >= ? GROUP BY 1`) },
  conversion: { label: 'Dönüşüm oranı', group: 'Dönüşüm', unit: '%', icon: 'rocket', color: '#9f87ff', hint: 'Form talebi ÷ ziyaret', compute: (n) => {
    const v = getStats(2 * n).daily.map((d) => d.views);
    const f = series(`SELECT ${ist('created_at')} AS day, COUNT(*) AS v FROM forms WHERE kind != 'firsat' AND ${ist('created_at')} >= ? GROUP BY 1`, n);
    const vc = v.slice(n), vp = v.slice(0, n);
    const cur = sum(vc) ? (sum(f.cur) / sum(vc)) * 100 : 0, prev = sum(vp) ? (sum(f.prev) / sum(vp)) * 100 : 0;
    return { value: Math.round(cur * 100) / 100, prev: Math.round(prev * 100) / 100, series: rate(f.cur, vc).map((x) => Math.round(x * 10) / 10) };
  } },
  forms_open: { label: 'Yanıt bekleyen talep', group: 'Dönüşüm', icon: 'mail', color: '#ff9f43', goodUp: false, hint: 'Durumu "yeni" olan form talepleri', compute: snap(() => q.get(`SELECT COUNT(*) AS n FROM forms WHERE status = 'yeni' AND kind != 'firsat'`).n) },
  subscribers: { label: 'Yeni bülten abonesi', group: 'Dönüşüm', icon: 'users', color: '#00cfe8', compute: flowMetric(`SELECT ${ist('created_at')} AS day, COUNT(*) AS v FROM subscribers WHERE ${ist('created_at')} >= ? GROUP BY 1`) },
  subscribers_total: { label: 'Toplam aktif abone', group: 'Dönüşüm', icon: 'users', color: '#00cfe8', compute: snap(() => q.get(`SELECT COUNT(*) AS n FROM subscribers WHERE status = 'aktif'`).n) },
  blog: { label: 'Yayında blog yazısı', group: 'İçerik', icon: 'blog', color: '#7367f0', compute: snap(() => listEntries('blog').filter((e) => !e.draft).length) },
  projects: { label: 'Yayında proje', group: 'İçerik', icon: 'project', color: '#7367f0', compute: snap(() => listEntries('projects').filter((e) => !e.draft).length) },
  drafts: { label: 'Taslak içerik', group: 'İçerik', icon: 'edit', color: '#ff9f43', goodUp: false, compute: snap(() => listEntries('blog').filter((e) => e.draft).length + listEntries('projects').filter((e) => e.draft).length) },
  media: { label: 'Medya dosyası', group: 'İçerik', icon: 'image', color: '#ff6bb5', compute: snap(() => q.get('SELECT COUNT(*) AS n FROM media').n) },
  seo_score: { label: 'Teknik SEO puanı', group: 'SEO', unit: '/100', icon: 'search', color: '#28c76f', hint: 'Google skoru değildir; açıklanabilir teknik kontroller', compute: snap(() => { try { return scanSite().avgScore; } catch { return 0; } }) },
  seo_errors: { label: 'SEO hatası', group: 'SEO', icon: 'alert', color: '#ea5455', goodUp: false, compute: snap(() => { try { return scanSite().errors; } catch { return 0; } }) },
  social_total: { label: 'Sosyal içerik', group: 'Sosyal', icon: 'share', color: '#9f87ff', compute: flowMetric(`SELECT ${ist('created_at')} AS day, COUNT(*) AS v FROM social_posts WHERE ${ist('created_at')} >= ? GROUP BY 1`) },
  social_awaiting: { label: 'Onay bekleyen içerik', group: 'Sosyal', icon: 'shield', color: '#ff9f43', goodUp: false, compute: snap(() => q.get(`SELECT COUNT(*) AS n FROM social_posts WHERE status = 'onay_bekliyor'`).n) },
  social_planned: { label: 'Planlanan paylaşım', group: 'Sosyal', icon: 'share', color: '#7367f0', compute: snap(() => q.get(`SELECT COUNT(*) AS n FROM social_posts WHERE status IN ('onaylandi','planlandi')`).n) },
  social_published: { label: 'Yayımlanan paylaşım', group: 'Sosyal', icon: 'check', color: '#28c76f', compute: snap(() => q.get(`SELECT COUNT(*) AS n FROM social_posts WHERE status = 'yayimlandi'`).n) },
  ai_tokens: { label: 'AI token kullanımı', group: 'AI', icon: 'spark', color: '#9f87ff', goodUp: false, compute: flowMetric(`SELECT ${ist('ts')} AS day, COALESCE(SUM(input_tokens),0)+COALESCE(SUM(output_tokens),0) AS v FROM ai_usage WHERE ok = 1 AND ${ist('ts')} >= ? GROUP BY 1`) },
  ai_calls: { label: 'AI çağrısı', group: 'AI', icon: 'spark', color: '#9f87ff', goodUp: false, compute: flowMetric(`SELECT ${ist('ts')} AS day, COUNT(*) AS v FROM ai_usage WHERE ${ist('ts')} >= ? GROUP BY 1`) },
  news: { label: 'Yeni sektör haberi', group: 'Pazar', icon: 'radar', color: '#00cfe8', compute: flowMetric(`SELECT ${ist('fetched_at')} AS day, COUNT(*) AS v FROM source_items WHERE ${ist('fetched_at')} >= ? GROUP BY 1`) },
  competitor_changes: { label: 'Rakip değişikliği', group: 'Pazar', icon: 'eye', color: '#ea5455', goodUp: false, compute: flowMetric(`SELECT ${ist('ts')} AS day, COUNT(*) AS v FROM competitor_checks WHERE changed = 1 AND ${ist('ts')} >= ? GROUP BY 1`) },
  backlinks_won: { label: 'Doğrulanmış backlink', group: 'SEO', icon: 'link', color: '#28c76f', compute: snap(() => q.get(`SELECT COUNT(*) AS n FROM backlink_opps WHERE status = 'kazanildi'`).n) },
  pending: { label: 'Yayın bekleyen değişiklik', group: 'Sistem', icon: 'rocket', color: '#ff9f43', goodUp: false, compute: snap(() => q.get('SELECT COUNT(*) AS n FROM drafts').n + (getSetting('entries_dirty', '0') === '1' ? 1 : 0)) },
};

export const DEFAULT_CARDS = ['visits', 'forms', 'conversion', 'seo_score', 'social_awaiting'];

const prefKey = (userId) => `kpi.user.${userId}`;
export const getPrefs = (userId) => {
  try {
    const p = JSON.parse(getSetting(prefKey(userId), 'null'));
    if (p && Array.isArray(p.cards)) return { range: [7, 30, 90].includes(p.range) ? p.range : 30, cards: p.cards.filter((c) => CATALOG[c.id]).slice(0, 12) };
  } catch { /* varsayılan */ }
  return { range: 30, cards: DEFAULT_CARDS.map((id) => ({ id })) };
};
export const setPrefs = (user, body) => {
  const range = [7, 30, 90].includes(Number(body.range)) ? Number(body.range) : 30;
  if (!Array.isArray(body.cards)) throw new HttpError(400, 'cards listesi gerekli');
  const seen = new Set();
  const cards = [];
  for (const c of body.cards.slice(0, 12)) {
    if (!CATALOG[c?.id] || seen.has(c.id)) continue;
    seen.add(c.id);
    const target = c.target === '' || c.target === null || c.target === undefined ? null : Number(c.target);
    if (target !== null && (!Number.isFinite(target) || target < 0)) throw new HttpError(400, `${CATALOG[c.id].label}: hedef geçersiz`);
    cards.push(target ? { id: c.id, target } : { id: c.id });
  }
  if (!cards.length) throw new HttpError(400, 'En az bir KPI seçin');
  setSetting(prefKey(user.id), JSON.stringify({ range, cards }));
  audit(user, 'kpi.tercih', String(cards.length));
  return { range, cards };
};

const pctChange = (cur, prev) => (prev === null || prev === undefined ? null : prev === 0 ? (cur === 0 ? 0 : null) : ((cur - prev) / prev) * 100);

export const computeCard = (id, n, target) => {
  const m = CATALOG[id];
  const r = m.compute(n);
  return { id, label: m.label, group: m.group, unit: m.unit ?? '', icon: m.icon, color: m.color, hint: m.hint ?? '', goodUp: m.goodUp !== false, value: r.value, prev: r.prev, delta: pctChange(r.value, r.prev), series: r.series, target: target ?? null, flow: r.series.length > 0 };
};

export const dashboard = (user, rangeOverride) => {
  const prefs = getPrefs(user.id);
  const n = [7, 30, 90].includes(Number(rangeOverride)) ? Number(rangeOverride) : prefs.range;
  return {
    range: n,
    prefs: { ...prefs, range: n },
    catalog: Object.entries(CATALOG).map(([id, m]) => ({ id, label: m.label, group: m.group, unit: m.unit ?? '', flow: false, hint: m.hint ?? '' })),
    cards: prefs.cards.map((c) => computeCard(c.id, n, c.target)),
    labels: days(n).map((d) => d.slice(5).replace('-', '/')),
  };
};
