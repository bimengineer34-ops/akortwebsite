// Genişletme paketi yol tablosu — mevcut api.mjs içindeki routes dizisine eklenir (mevcut uç noktalar değişmez)
import { q, audit } from '../db.mjs';
import { HttpError, readJson, sendJson } from '../http.mjs';
import { requireUser, requireAdmin } from '../auth.mjs';
import { getEntry, saveEntry, listEntries } from '../entries.mjs';
import { setSecret, deleteSecret, hasSecret, secretMeta } from './vault.mjs';
import { featureOn } from './schema.mjs';
import { PROVIDERS, providerStatus, setCfg, testProvider, listModels, generate, TASKS, markRun, recentRuns, recentUsage } from './ai.mjs';
import { scanSite, speedReport, getFocus, setFocus } from './seo.mjs';
import * as social from './social.mjs';
import * as intel from './intel.mjs';

const id = (v) => {
  const n = Number(v);
  if (!Number.isInteger(n) || n < 1) throw new HttpError(400, 'Geçersiz kimlik');
  return n;
};
const flag = (key) => {
  if (!featureOn(key)) throw new HttpError(503, `"${key}" modülü özellik bayrağı ile kapatılmış`);
};
const A = '/api/admin/x';
const J = (req, max = 64 * 1024) => readJson(req, max);

/** Entegrasyon durum matrisi: gerçek durum; bağlı olmayan "Bağlantı gerekli" görünür */
const integrations = () => {
  const ai = providerStatus();
  const need = (name, how) => ({ name, connected: false, how });
  return {
    ai: ai.map((p) => ({ id: p.id, name: p.label, connected: p.connected, hint: p.secret?.hint ?? null })),
    other: [
      need('Google Search Console', 'OAuth + doğrulanmış mülk gerekir (Search Analytics, URL Inspection, sitemap). Genel sayfalar için Indexing API kullanılmaz.'),
      need('Google Analytics 4', 'GA4 Data API için servis hesabı/OAuth ve çerez onayına uygun ölçüm kurulumu gerekir.'),
      need('PageSpeed Insights / CrUX', 'Google API anahtarı gerekir; sentetik ve alan verisi ayrı raporlanır.'),
      need('Google Business Profile', 'Yalnızca uygun/onaylı erişimi olan işletmeler için (başvuru gerekir).'),
      need('SERP / sıralama veri sağlayıcısı', 'Lisanslı üçüncü taraf API (isteğe bağlı). Olmadan sıralama verisi gösterilmez.'),
      need('Backlink veri sağlayıcısı', 'Lisanslı üçüncü taraf API (isteğe bağlı). Olmadan yalnızca elle/doğrulama taraması vardır.'),
      need('CDN / proxy', 'Veridyen planı veya Cloudflare gibi proxy gerekir.'),
      ...Object.entries(social.PLATFORMS).map(([k, p]) => need(p.label, p.needs)),
    ],
  };
};

export const extRoutes = [
  /* ---------- entegrasyonlar + sır kasası ---------- */
  ['GET', new RegExp(`^${A}/entegrasyonlar$`), ({ req, res }) => {
    requireUser(req);
    sendJson(res, 200, { ...integrations(), providers: providerStatus(), flags: ['seo', 'ai', 'social', 'intel'].map((k) => ({ key: k, enabled: featureOn(k) })) });
  }],
  ['PUT', new RegExp(`^${A}/ai/([a-z]+)/anahtar$`), async ({ req, res, m }) => {
    const u = requireAdmin(req);
    if (!PROVIDERS[m[1]]) throw new HttpError(400, 'Bilinmeyen sağlayıcı');
    setSecret(PROVIDERS[m[1]].secret, (await J(req, 4096)).key, u);
    sendJson(res, 200, { ok: true, hint: secretMeta(PROVIDERS[m[1]].secret).hint });
  }],
  ['DELETE', new RegExp(`^${A}/ai/([a-z]+)/anahtar$`), ({ req, res, m }) => {
    const u = requireAdmin(req);
    if (!PROVIDERS[m[1]]) throw new HttpError(400, 'Bilinmeyen sağlayıcı');
    if (hasSecret(PROVIDERS[m[1]].secret)) deleteSecret(PROVIDERS[m[1]].secret, u);
    sendJson(res, 200, { ok: true });
  }],
  ['PUT', new RegExp(`^${A}/ai/([a-z]+)/ayar$`), async ({ req, res, m }) => sendJson(res, 200, { cfg: setCfg(m[1], await J(req, 4096), requireAdmin(req)) })],
  ['POST', new RegExp(`^${A}/ai/([a-z]+)/test$`), async ({ req, res, m }) => sendJson(res, 200, await testProvider(m[1], requireAdmin(req)))],
  ['GET', new RegExp(`^${A}/ai/([a-z]+)/modeller$`), async ({ req, res, m }) => (requireUser(req), sendJson(res, 200, { models: await listModels(m[1]) }))],
  ['PUT', new RegExp(`^${A}/bayrak/(seo|ai|social|intel)$`), async ({ req, res, m }) => {
    const u = requireAdmin(req);
    const on = (await J(req, 512)).enabled === false ? 0 : 1;
    q.run(`INSERT INTO feature_flags (key, enabled) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET enabled = excluded.enabled, updated_at = datetime('now')`, m[1], on);
    audit(u, 'bayrak', m[1], on ? 'açık' : 'kapalı');
    sendJson(res, 200, { ok: true });
  }],

  /* ---------- AI İçerik Stüdyosu ---------- */
  ['GET', new RegExp(`^${A}/ai$`), ({ req, res }) => (requireUser(req), sendJson(res, 200, { providers: providerStatus(), tasks: Object.entries(TASKS).map(([k, t]) => ({ key: k, label: t.label })), runs: recentRuns(), usage: recentUsage() }))],
  ['POST', new RegExp(`^${A}/ai/uret$`), async ({ req, res }) => {
    flag('ai');
    const u = requireUser(req);
    const b = await J(req, 80 * 1024);
    sendJson(res, 200, await generate({ provider: String(b.provider ?? ''), task: String(b.task ?? ''), text: b.text, focus: b.focus, tone: b.tone, userNote: b.note }, u));
  }],
  ['POST', new RegExp(`^${A}/ai/calisma/(\\d+)/(kabul|red)$`), ({ req, res, m }) => (markRun(id(m[1]), m[2], requireUser(req)), sendJson(res, 200, { ok: true }))],

  /* ---------- SEO ---------- */
  ['GET', new RegExp(`^${A}/seo/tarama$`), ({ req, res, url }) => (requireUser(req), flag('seo'), sendJson(res, 200, scanSite(url.searchParams.get('yenile') === '1')))],
  ['GET', new RegExp(`^${A}/seo/hiz$`), ({ req, res }) => (requireUser(req), sendJson(res, 200, speedReport()))],
  ['GET', new RegExp(`^${A}/seo/girdiler$`), ({ req, res }) => {
    requireUser(req);
    sendJson(res, 200, { rows: ['blog', 'projects'].flatMap((k) => listEntries(k).map((e) => ({ kind: k, slug: e.slug, title: e.title, draft: e.draft }))) });
  }],
  ['GET', new RegExp(`^${A}/seo/girdi/(blog|projects)/([a-z0-9-]+)$`), ({ req, res, m }) => {
    requireUser(req);
    const e = getEntry(m[1], m[2]);
    sendJson(res, 200, { kind: m[1], slug: m[2], data: e.data, body: e.body, focus: getFocus(m[1], m[2]), siteUrl: process.env.PUBLIC_SITE_URL || '' });
  }],
  ['PUT', new RegExp(`^${A}/seo/girdi/(blog|projects)/([a-z0-9-]+)$`), async ({ req, res, m }) => {
    const u = requireUser(req);
    flag('seo');
    const b = await J(req, 16 * 1024);
    const e = getEntry(m[1], m[2]);
    const seo = { ...(e.data.seo ?? {}) };
    for (const k of ['title', 'description']) if (typeof b[k] === 'string') seo[k] = b[k].trim();
    if (typeof b.noindex === 'boolean') seo.noindex = b.noindex;
    saveEntry(m[1], m[2], { data: { ...e.data, seo }, body: e.body }, u);
    if (typeof b.focus === 'string') setFocus(m[1], m[2], b.focus);
    sendJson(res, 200, { ok: true });
  }],

  /* ---------- Social Studio ---------- */
  ['GET', new RegExp(`^${A}/sosyal$`), ({ req, res }) => (requireUser(req), sendJson(res, 200, { summary: social.socialSummary(), platforms: Object.entries(social.PLATFORMS).map(([k, p]) => ({ id: k, label: p.label, limit: p.limit, caps: p.caps, needs: p.needs, connected: false })), specialDays: social.upcomingSpecialDays(), statuses: social.STATUSES }))],
  ['GET', new RegExp(`^${A}/sosyal/gonderiler$`), ({ req, res, url }) => {
    requireUser(req);
    const p = url.searchParams;
    sendJson(res, 200, { rows: social.listPosts({ status: p.get('durum') ?? '', from: p.get('bas') ?? '', to: p.get('bit') ?? '' }) });
  }],
  ['POST', new RegExp(`^${A}/sosyal/gonderiler$`), async ({ req, res }) => (flag('social'), sendJson(res, 200, social.savePost(0, await J(req), requireUser(req))))],
  ['GET', new RegExp(`^${A}/sosyal/gonderiler/(\\d+)$`), ({ req, res, m }) => (requireUser(req), sendJson(res, 200, social.getPost(id(m[1]))))],
  ['PUT', new RegExp(`^${A}/sosyal/gonderiler/(\\d+)$`), async ({ req, res, m }) => (flag('social'), sendJson(res, 200, social.savePost(id(m[1]), await J(req), requireUser(req))))],
  ['DELETE', new RegExp(`^${A}/sosyal/gonderiler/(\\d+)$`), ({ req, res, m }) => (social.deletePost(id(m[1]), requireUser(req)), sendJson(res, 200, { ok: true }))],
  ['POST', new RegExp(`^${A}/sosyal/gonderiler/(\\d+)/gecis$`), async ({ req, res, m }) => {
    const u = requireUser(req);
    const b = await J(req, 4096);
    sendJson(res, 200, social.transition(id(m[1]), String(b.to ?? ''), u, String(b.note ?? '')));
  }],
  ['POST', new RegExp(`^${A}/sosyal/gonderiler/(\\d+)/elle-yayimlandi$`), async ({ req, res, m }) => {
    const u = requireUser(req);
    const b = await J(req, 2048);
    sendJson(res, 200, social.markManuallyPublished(id(m[1]), String(b.platform ?? ''), b.ref, u));
  }],
  ['POST', new RegExp(`^${A}/sosyal/blogdan/([a-z0-9-]+)$`), ({ req, res, m }) => {
    const u = requireUser(req);
    flag('social');
    const e = getEntry('blog', m[1]);
    const d = e.data;
    const link = `${(process.env.PUBLIC_SITE_URL || '').replace(/\/$/, '')}/blog/${m[1]}`;
    const post = social.savePost(0, {
      title: `Blog: ${d.title}`,
      body: `${d.excerpt ?? d.description ?? d.title}\n\nDevamı: ${link}`,
      hashtags: (d.tags ?? []).slice(0, 4).map((t) => `#${String(t).replace(/[^\p{L}\p{N}]+/gu, '')}`).join(' '),
      category: d.category ?? 'Blog',
      platforms: ['linkedin'],
      source_ref: `blog/${m[1]}`,
    }, u);
    sendJson(res, 200, post);
  }],

  /* ---------- Market & Media / Rakip / Backlink ---------- */
  ['GET', new RegExp(`^${A}/pazar$`), ({ req, res }) => (requireUser(req), sendJson(res, 200, { sources: intel.listSources(), trending: intel.trending(), jobs: intel.listJobs() }))],
  ['POST', new RegExp(`^${A}/pazar/kaynaklar$`), async ({ req, res }) => (flag('intel'), intel.saveSource(0, await J(req), requireUser(req)), sendJson(res, 200, { ok: true }))],
  ['PUT', new RegExp(`^${A}/pazar/kaynaklar/(\\d+)$`), async ({ req, res, m }) => (intel.saveSource(id(m[1]), await J(req), requireUser(req)), sendJson(res, 200, { ok: true }))],
  ['DELETE', new RegExp(`^${A}/pazar/kaynaklar/(\\d+)$`), ({ req, res, m }) => (intel.deleteSource(id(m[1]), requireAdmin(req)), sendJson(res, 200, { ok: true }))],
  ['POST', new RegExp(`^${A}/pazar/kaynaklar/(\\d+)/cek$`), async ({ req, res, m }) => (flag('intel'), requireUser(req), sendJson(res, 200, await intel.fetchSource(id(m[1]))))],
  ['GET', new RegExp(`^${A}/pazar/ogeler$`), ({ req, res, url }) => {
    requireUser(req);
    const p = url.searchParams;
    sendJson(res, 200, { rows: intel.listItems({ status: p.get('durum') ?? '', minRel: p.get('min') ?? 0, search: p.get('ara') ?? '' }) });
  }],
  ['PATCH', new RegExp(`^${A}/pazar/ogeler/(\\d+)$`), async ({ req, res, m }) => (intel.setItemStatus(id(m[1]), (await J(req, 512)).status, requireUser(req)), sendJson(res, 200, { ok: true }))],
  ['POST', new RegExp(`^${A}/pazar/ogeler/(\\d+)/crm$`), ({ req, res, m }) => sendJson(res, 200, intel.itemToLead(id(m[1]), requireUser(req)))],
  ['GET', new RegExp(`^${A}/rakipler$`), ({ req, res }) => (requireUser(req), sendJson(res, 200, { rows: intel.listCompetitors() }))],
  ['POST', new RegExp(`^${A}/rakipler$`), async ({ req, res }) => (flag('intel'), intel.saveCompetitor(0, await J(req), requireUser(req)), sendJson(res, 200, { ok: true }))],
  ['PUT', new RegExp(`^${A}/rakipler/(\\d+)$`), async ({ req, res, m }) => (intel.saveCompetitor(id(m[1]), await J(req), requireUser(req)), sendJson(res, 200, { ok: true }))],
  ['DELETE', new RegExp(`^${A}/rakipler/(\\d+)$`), ({ req, res, m }) => (intel.deleteCompetitor(id(m[1]), requireAdmin(req)), sendJson(res, 200, { ok: true }))],
  ['POST', new RegExp(`^${A}/rakipler/(\\d+)/kontrol$`), async ({ req, res, m }) => (flag('intel'), sendJson(res, 200, await intel.checkCompetitor(id(m[1]), requireUser(req))))],
  ['GET', new RegExp(`^${A}/rakipler/(\\d+)/gecmis$`), ({ req, res, m }) => (requireUser(req), sendJson(res, 200, { rows: intel.competitorHistory(id(m[1])) }))],
  ['GET', new RegExp(`^${A}/backlink$`), ({ req, res }) => (requireUser(req), sendJson(res, 200, { rows: intel.listBacklinks() }))],
  ['POST', new RegExp(`^${A}/backlink$`), async ({ req, res }) => (flag('intel'), intel.saveBacklink(0, await J(req), requireUser(req)), sendJson(res, 200, { ok: true }))],
  ['PUT', new RegExp(`^${A}/backlink/(\\d+)$`), async ({ req, res, m }) => (intel.saveBacklink(id(m[1]), await J(req), requireUser(req)), sendJson(res, 200, { ok: true }))],
  ['DELETE', new RegExp(`^${A}/backlink/(\\d+)$`), ({ req, res, m }) => (intel.deleteBacklink(id(m[1]), requireAdmin(req)), sendJson(res, 200, { ok: true }))],
  ['POST', new RegExp(`^${A}/backlink/(\\d+)/dogrula$`), async ({ req, res, m }) => sendJson(res, 200, await intel.verifyBacklink(id(m[1]), requireUser(req)))],
];
