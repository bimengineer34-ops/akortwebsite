// Genişletme paketi yol tablosu — mevcut api.mjs içindeki routes dizisine eklenir (mevcut uç noktalar değişmez)
import { q, audit, getSetting } from '../db.mjs';
import { config } from '../config.mjs';
import { HttpError, readJson, sendJson, baseHeaders } from '../http.mjs';
import { requireUser, requireAdmin } from '../auth.mjs';
import { getEntry, saveEntry, listEntries } from '../entries.mjs';
import { setSecret, deleteSecret, hasSecret, secretMeta } from './vault.mjs';
import { featureOn } from './schema.mjs';
import { PROVIDERS, providerStatus, setCfg, testProvider, listModels, generate, TASKS, markRun, recentRuns, recentUsage } from './ai.mjs';
import { scanSite, speedReport, getFocus, setFocus, seoOverview, internalLinkSuggestions } from './seo.mjs';
import * as social from './social.mjs';
import * as intel from './intel.mjs';
import { runPsi, speedOverview, clearCache, pruneDb } from './speed.mjs';
import { brandData, renderBrand, saveRender } from './brand.mjs';
import * as i18n from './i18n.mjs';
import * as oauth from './oauth.mjs';
import * as orch from './orchestra/engine.mjs';
import { listAgents, getAgent, updateAgent, resetAgent, ALL_TOOLS } from './orchestra/agents.mjs';
import { dashboard, setPrefs, computeCard, CATALOG } from './kpi.mjs';
import { getStats } from '../stats.mjs';

const id = (v) => {
  const n = Number(v);
  if (!Number.isInteger(n) || n < 1) throw new HttpError(400, 'Geçersiz kimlik');
  return n;
};
const flag = (key) => {
  if (!featureOn(key)) throw new HttpError(503, `"${key}" modülü özellik bayrağı ile kapatılmış`);
};
const baseOf = (req) => { const e = process.env.OAUTH_REDIRECT_BASE; if (e) return e.replace(/\/$/, ''); const h = String(req.headers.host ?? 'localhost'); return `${/^(localhost|127\.0\.0\.1|\[::1\])(:|$)/.test(h) ? 'http' : 'https'}://${h}`; };
const PID = '(linkedin|x|facebook|instagram|threads|youtube|pinterest|tiktok)';
const A = '/api/admin/x';
const J = (req, max = 64 * 1024) => readJson(req, max);

/** Entegrasyon durum matrisi: gerçek durum; bağlı olmayan "Bağlantı gerekli" görünür */
const integrations = () => {
  const ai = providerStatus();
  const need = (name, how, url, links = []) => ({ name, connected: false, how, url, links });
  return {
    ai: ai.map((p) => ({ id: p.id, name: p.label, connected: p.connected, hint: p.secret?.hint ?? null, url: PROVIDERS[p.id].docs })),
    other: [
      need('Google Search Console', 'OAuth + doğrulanmış mülk gerekir (Search Analytics, URL Inspection, sitemap). Genel sayfalar için Indexing API kullanılmaz.', 'https://search.google.com/search-console', [['API belgeleri', 'https://developers.google.com/webmaster-tools']]),
      need('Google Analytics 4', 'GA4 Data API için servis hesabı/OAuth ve çerez onayına uygun ölçüm kurulumu gerekir.', 'https://analytics.google.com/', [['Data API belgeleri', 'https://developers.google.com/analytics/devguides/reporting/data/v1']]),
      { name: 'PageSpeed Insights (Google)', connected: hasSecret('google.psi'), how: 'Anahtar isteğe bağlıdır (anahtarsız düşük kota); Speed Engine sayfasında test çalıştırılır. Sentetik ve alan verisi ayrı raporlanır.', psi: true, url: 'https://console.cloud.google.com/apis/credentials', links: [['Anahtar nasıl alınır', 'https://developers.google.com/speed/docs/insights/v5/get-started'], ['Speed Engine sayfası', '#/hiz']] },
      need('Google Business Profile', 'Yalnızca uygun/onaylı erişimi olan işletmeler için (başvuru gerekir).', 'https://business.google.com/', [['API erişim başvurusu', 'https://developers.google.com/my-business/content/prereqs']]),
      need('SERP / sıralama veri sağlayıcısı', 'Lisanslı üçüncü taraf API (isteğe bağlı). Olmadan sıralama verisi gösterilmez.', 'https://dataforseo.com/apis/serp-api', [['Alternatif: SerpApi', 'https://serpapi.com/']]),
      need('Backlink veri sağlayıcısı', 'Lisanslı üçüncü taraf API (isteğe bağlı). Olmadan yalnızca elle/doğrulama taraması vardır.', 'https://ahrefs.com/api', [['Alternatif: Semrush API', 'https://www.semrush.com/api-analytics/']]),
      need('CDN / proxy', 'Veridyen planı veya Cloudflare gibi proxy gerekir.', 'https://dash.cloudflare.com/', [['Cloudflare belgeleri', 'https://developers.cloudflare.com/fundamentals/']]),
      ...Object.entries(social.PLATFORMS).map(([k, p]) => ({ ...need(p.label, p.needs, p.url, p.docs ? [['API belgeleri', p.docs]] : []), social: true, connected: oauth.listAccounts('x').find((a) => a.id === k)?.connected ?? false })),
    ],
  };
};

const dayList = (n) => Array.from({ length: n }, (_, i) => new Date(Date.now() - (n - 1 - i) * 86_400_000).toLocaleDateString('sv-SE', { timeZone: 'Europe/Istanbul' }));

export const extRoutes = [
  /* ---------- KPI panosu (kullanıcı tanımlı) ---------- */
  ['GET', new RegExp(`^${A}/kpi$`), ({ req, res, url }) => sendJson(res, 200, dashboard(requireUser(req), url.searchParams.get('gun')))],
  ['PUT', new RegExp(`^${A}/kpi$`), async ({ req, res }) => sendJson(res, 200, setPrefs(requireUser(req), await J(req, 8 * 1024)))],
  ['GET', new RegExp(`^${A}/kpi/([a-z_]+)$`), ({ req, res, m, url }) => {
    requireUser(req);
    if (!CATALOG[m[1]]) throw new HttpError(404, 'Bilinmeyen KPI');
    sendJson(res, 200, computeCard(m[1], [7, 30, 90].includes(Number(url.searchParams.get('gun'))) ? Number(url.searchParams.get('gun')) : 30));
  }],
  ['GET', new RegExp(`^${A}/grafik$`), ({ req, res, url }) => {
    const me = requireUser(req);
    const n = [7, 30, 90].includes(Number(url.searchParams.get('gun'))) ? Number(url.searchParams.get('gun')) : 30;
    const since = dayList(n)[0];
    const ist = (c) => `date(${c}, '+3 hours')`;
    const byDay = (sql) => { const m = new Map(q.all(sql, since).map((r) => [r.day, r.v])); return dayList(n).map((d) => m.get(d) ?? 0); };
    const st = getStats(n);
    sendJson(res, 200, {
      range: n,
      labels: dayList(n).map((d) => d.slice(8) + '/' + d.slice(5, 7)),
      visits: st.daily.map((d) => d.views),
      forms: byDay(`SELECT ${ist('created_at')} AS day, COUNT(*) AS v FROM forms WHERE kind != 'firsat' AND ${ist('created_at')} >= ? GROUP BY 1`),
      subscribers: byDay(`SELECT ${ist('created_at')} AS day, COUNT(*) AS v FROM subscribers WHERE ${ist('created_at')} >= ? GROUP BY 1`),
      aiTokens: byDay(`SELECT ${ist('ts')} AS day, COALESCE(SUM(input_tokens),0)+COALESCE(SUM(output_tokens),0) AS v FROM ai_usage WHERE ok = 1 AND ${ist('ts')} >= ? GROUP BY 1`),
      news: byDay(`SELECT ${ist('fetched_at')} AS day, COUNT(*) AS v FROM source_items WHERE ${ist('fetched_at')} >= ? GROUP BY 1`),
      formStatus: q.all(`SELECT status, COUNT(*) AS n FROM forms WHERE kind != 'firsat' GROUP BY status`),
      socialStatus: q.all('SELECT status, COUNT(*) AS n FROM social_posts GROUP BY status'),
      socialPlatforms: Object.keys(social.PLATFORMS).map((id) => ({ id, label: social.PLATFORMS[id].label, n: q.all('SELECT platforms FROM social_posts').filter((r) => JSON.parse(r.platforms).includes(id)).length })),
      topPages: st.topPages.slice(0, 8),
      referrers: st.referrers.slice(0, 6),
      upcoming: social.socialSummary().upcoming,
      mine: q.all('SELECT ts, action, target FROM audit WHERE user_email = ? ORDER BY id DESC LIMIT 6', me.email),
      awaitingApproval: q.get(`SELECT COUNT(*) AS n FROM social_posts WHERE status = 'onay_bekliyor'`).n,
      aiConnected: q.get(`SELECT COUNT(*) AS n FROM secrets WHERE name LIKE 'ai.%'`).n,
      backlinkStatus: q.all('SELECT status, COUNT(*) AS n FROM backlink_opps GROUP BY status'),
    });
  }],

  /* ---------- Speed Engine ---------- */
  ['GET', new RegExp(`^${A}/hiz$`), ({ req, res, url }) => (requireUser(req), sendJson(res, 200, speedOverview([7, 30, 90].includes(Number(url.searchParams.get('gun'))) ? Number(url.searchParams.get('gun')) : 30)))],
  ['POST', new RegExp(`^${A}/hiz/test$`), async ({ req, res }) => {
    const u = requireUser(req);
    const b = await J(req, 2048);
    sendJson(res, 200, await runPsi(String(b.url ?? ''), String(b.strategy ?? 'mobile'), u));
  }],
  ['POST', new RegExp(`^${A}/hiz/onbellek-temizle$`), ({ req, res }) => sendJson(res, 200, clearCache(requireAdmin(req)))],
  ['POST', new RegExp(`^${A}/hiz/veritabani-temizle$`), ({ req, res }) => sendJson(res, 200, pruneDb(requireAdmin(req)))],
  ['PUT', new RegExp(`^${A}/anahtar/psi$`), async ({ req, res }) => { const u = requireAdmin(req); setSecret('google.psi', (await J(req, 2048)).key, u); sendJson(res, 200, { ok: true }); }],
  ['DELETE', new RegExp(`^${A}/anahtar/psi$`), ({ req, res }) => { const u = requireAdmin(req); if (hasSecret('google.psi')) deleteSecret('google.psi', u); sendJson(res, 200, { ok: true }); }],

  /* ---------- entegrasyonlar + sır kasası ---------- */
  ['GET', new RegExp(`^${A}/entegrasyonlar$`), ({ req, res }) => {
    requireUser(req);
    sendJson(res, 200, { ...integrations(), providers: providerStatus(), flags: ['seo', 'ai', 'social', 'intel', 'orchestra'].map((k) => ({ key: k, enabled: featureOn(k) })) });
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
  ['PUT', new RegExp(`^${A}/bayrak/(seo|ai|social|intel|orchestra)$`), async ({ req, res, m }) => {
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
  ['GET', new RegExp(`^${A}/seo/ozet$`), ({ req, res, url }) => (requireUser(req), flag('seo'), sendJson(res, 200, seoOverview([7, 30, 90].includes(Number(url.searchParams.get('gun'))) ? Number(url.searchParams.get('gun')) : 30)))],
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
  ['GET', new RegExp(`^${A}/seo/ic-baglanti/(blog|projects)/([a-z0-9-]+)$`), ({ req, res, m }) => (requireUser(req), sendJson(res, 200, { rows: internalLinkSuggestions(m[1], m[2]) }))],
  ['PUT', new RegExp(`^${A}/seo/girdi/(blog|projects)/([a-z0-9-]+)$`), async ({ req, res, m }) => {
    const u = requireUser(req);
    flag('seo');
    const b = await J(req, 600 * 1024);
    const e = getEntry(m[1], m[2]);
    const seo = { ...(e.data.seo ?? {}) };
    const data = { ...e.data };
    if (typeof b.seoTitle === 'string') seo.title = b.seoTitle.trim();
    if (typeof b.description === 'string') seo.description = b.description.trim();
    if (typeof b.noindex === 'boolean') seo.noindex = b.noindex;
    if (typeof b.h1 === 'string' && b.h1.trim()) data.title = b.h1.trim();
    data.seo = seo;
    saveEntry(m[1], m[2], { data, body: typeof b.body === 'string' ? b.body : e.body }, u);
    if (typeof b.focus === 'string') setFocus(m[1], m[2], b.focus);
    sendJson(res, 200, { ok: true });
  }],

  /* ---------- Sosyal hesap bağlantıları (OAuth) ---------- */
  ['GET', new RegExp(`^${A}/sosyal/hesaplar$`), ({ req, res }) => (requireUser(req), sendJson(res, 200, { accounts: oauth.listAccounts(baseOf(req)) }))],
  ['PUT', new RegExp(`^${A}/sosyal/hesaplar/${PID}/uygulama$`), async ({ req, res, m }) => { const u = requireAdmin(req); const b = await J(req, 4096); oauth.saveApp(m[1], b.clientId, b.clientSecret, u); sendJson(res, 200, { ok: true }); }],
  ['DELETE', new RegExp(`^${A}/sosyal/hesaplar/${PID}/uygulama$`), ({ req, res, m }) => (oauth.removeApp(m[1], requireAdmin(req)), sendJson(res, 200, { ok: true }))],
  ['POST', new RegExp(`^${A}/sosyal/hesaplar/${PID}/baglan$`), ({ req, res, m }) => sendJson(res, 200, { url: oauth.startAuth(m[1], requireAdmin(req), baseOf(req)) })],
  ['POST', new RegExp(`^${A}/sosyal/hesaplar/${PID}/kes$`), ({ req, res, m }) => (oauth.disconnect(m[1], requireAdmin(req)), sendJson(res, 200, { ok: true }))],
  ['POST', new RegExp(`^${A}/sosyal/hesaplar/${PID}/secim$`), async ({ req, res, m }) => { const u = requireAdmin(req); const b = await J(req, 2048); await oauth.selectAccount(m[1], String(b.id ?? ''), u); sendJson(res, 200, { ok: true }); }],
  // Geri çağrı: oturum çerezi (SameSite=Strict) sağlayıcıdan dönüşte gönderilmez; doğrulama tek kullanımlık "state" ile yapılır
  ['GET', new RegExp(`^${A}/oauth/cb/${PID}$`), async ({ res, url, m }) => {
    let loc;
    try { const r = await oauth.handleCallback(m[1], Object.fromEntries(url.searchParams)); loc = `/yonetim/#/sosyal?baglandi=${m[1]}`; void r; }
    catch (e) { loc = `/yonetim/#/sosyal?baglanti_hata=${encodeURIComponent(String(e.message).slice(0, 200))}`; }
    res.writeHead(302, baseHeaders({ Location: loc, 'Cache-Control': 'no-store' }));
    res.end();
  }],
  ['POST', new RegExp(`^${A}/sosyal/gonderiler/(\\d+)/paylas$`), async ({ req, res, m }) => {
    const u = requireUser(req);
    const b = await J(req, 2048);
    sendJson(res, 200, await oauth.publishNow(id(m[1]), String(b.platform ?? ''), u));
  }],

  /* ---------- AI Orchestra (çok ajanlı yönetim modülü) ---------- */
  // Okuma: yalnızca yönetici/editör (rbac.mjs). Çalıştırma/onay: yönetici/editör. Ajan, akış ve ayar tanımları: yalnızca yönetici.
  ['GET', new RegExp(`^${A}/orkestra/ozet$`), ({ req, res }) => (requireUser(req), orch.initOrchestra(), sendJson(res, 200, orch.overview()))],
  ['GET', new RegExp(`^${A}/orkestra/ajanlar$`), ({ req, res }) => (requireUser(req), orch.initOrchestra(), sendJson(res, 200, { agents: listAgents(), tools: ALL_TOOLS, actions: orch.ACTION_LIST }))],
  ['PUT', new RegExp(`^${A}/orkestra/ajanlar/([a-z_]+)$`), async ({ req, res, m }) => { const u = requireAdmin(req); sendJson(res, 200, updateAgent(m[1], await J(req, 64 * 1024), u)); }],
  ['POST', new RegExp(`^${A}/orkestra/ajanlar/([a-z_]+)/sifirla$`), ({ req, res, m }) => sendJson(res, 200, resetAgent(m[1], requireAdmin(req)))],
  ['GET', new RegExp(`^${A}/orkestra/akislar$`), ({ req, res }) => (requireUser(req), orch.initOrchestra(), sendJson(res, 200, { workflows: orch.listWorkflows() }))],
  ['POST', new RegExp(`^${A}/orkestra/akislar$`), async ({ req, res }) => { const u = requireAdmin(req); sendJson(res, 200, orch.saveWorkflow(0, await J(req, 64 * 1024), u)); }],
  ['PUT', new RegExp(`^${A}/orkestra/akislar/(\\d+)$`), async ({ req, res, m }) => { const u = requireAdmin(req); sendJson(res, 200, orch.saveWorkflow(id(m[1]), await J(req, 64 * 1024), u)); }],
  ['DELETE', new RegExp(`^${A}/orkestra/akislar/(\\d+)$`), ({ req, res, m }) => (orch.deleteWorkflow(id(m[1]), requireAdmin(req)), sendJson(res, 200, { ok: true }))],
  ['POST', new RegExp(`^${A}/orkestra/akislar/dogrula$`), async ({ req, res }) => { requireUser(req); const v = orch.validateSteps((await J(req, 64 * 1024)).steps); sendJson(res, 200, { ok: !v.errors.length, errors: v.errors, steps: v.steps }); }],
  ['POST', new RegExp(`^${A}/orkestra/plan$`), async ({ req, res }) => { const u = requireUser(req); sendJson(res, 200, await orch.planFromCommand((await J(req, 8 * 1024)).command, u)); }],
  ['POST', new RegExp(`^${A}/orkestra/calistir$`), async ({ req, res }) => {
    const u = requireUser(req);
    const b = await J(req, 128 * 1024);
    let steps = b.steps, workflowId = null, title = b.title;
    if (b.workflowId) { const w = orch.listWorkflows().find((x) => x.id === Number(b.workflowId)); if (!w) throw new HttpError(404, 'İş akışı bulunamadı'); steps = w.steps; workflowId = w.id; title ||= w.name; }
    sendJson(res, 200, orch.createRun({ title, command: b.command, steps, workflowId, params: b.params, idempotencyKey: b.idempotencyKey, tokenLimit: u.role === 'admin' ? b.tokenLimit : undefined }, u));
  }],
  ['GET', new RegExp(`^${A}/orkestra/calistirmalar$`), ({ req, res, url }) => (requireUser(req), sendJson(res, 200, { runs: orch.listRuns({ status: url.searchParams.get('durum') ?? '', limit: url.searchParams.get('limit') ?? 40 }) }))],
  ['GET', new RegExp(`^${A}/orkestra/calistirmalar/(\\d+)$`), ({ req, res, m }) => (requireUser(req), sendJson(res, 200, orch.getRun(id(m[1]))))],
  ['POST', new RegExp(`^${A}/orkestra/calistirmalar/(\\d+)/iptal$`), ({ req, res, m }) => sendJson(res, 200, orch.cancelRun(id(m[1]), requireUser(req)))],
  ['POST', new RegExp(`^${A}/orkestra/calistirmalar/(\\d+)/duraklat$`), ({ req, res, m }) => sendJson(res, 200, orch.pauseRun(id(m[1]), requireUser(req)))],
  ['POST', new RegExp(`^${A}/orkestra/calistirmalar/(\\d+)/devam$`), ({ req, res, m }) => sendJson(res, 200, orch.resumeRun(id(m[1]), requireUser(req)))],
  ['GET', new RegExp(`^${A}/orkestra/ajanlar/([a-z_]+)/gecmis$`), ({ req, res, m }) => (requireUser(req), sendJson(res, 200, { history: orch.agentHistory(m[1]) }))],
  ['POST', new RegExp(`^${A}/orkestra/talep-analizi$`), async ({ req, res }) => { const u = requireUser(req); const b = await J(req, 2048); sendJson(res, 200, orch.createFormRun({ formId: b.formId, idempotencyKey: b.idempotencyKey }, u)); }],
  ['GET', new RegExp(`^${A}/orkestra/onaylar$`), ({ req, res }) => (requireUser(req), sendJson(res, 200, { approvals: orch.pendingApprovals() }))],
  ['POST', new RegExp(`^${A}/orkestra/gorevler/(\\d+)/onayla$`), async ({ req, res, m }) => { const u = requireUser(req); const b = await J(req, 4096); sendJson(res, 200, orch.approveTask(id(m[1]), u, { note: b.note, ack: b.ack === true })); }],
  ['POST', new RegExp(`^${A}/orkestra/gorevler/(\\d+)/reddet$`), async ({ req, res, m }) => { const u = requireUser(req); const b = await J(req, 4096); sendJson(res, 200, orch.rejectTask(id(m[1]), u, b.note)); }],
  ['POST', new RegExp(`^${A}/orkestra/gorevler/(\\d+)/yeniden-dene$`), ({ req, res, m }) => sendJson(res, 200, orch.retryTask(id(m[1]), requireUser(req)))],
  ['GET', new RegExp(`^${A}/orkestra/olaylar$`), ({ req, res, url }) => (requireUser(req), sendJson(res, 200, { events: orch.eventsList({ level: url.searchParams.get('seviye') ?? '', runId: url.searchParams.get('calistirma') ?? '', limit: url.searchParams.get('limit') ?? 100 }) }))],
  ['GET', new RegExp(`^${A}/orkestra/analitik$`), ({ req, res, url }) => (requireUser(req), sendJson(res, 200, orch.analytics({ days: url.searchParams.get('gun') ?? 30 })))],
  ['GET', new RegExp(`^${A}/orkestra/ayarlar$`), ({ req, res }) => (requireUser(req), sendJson(res, 200, { settings: orch.settings(), providers: providerStatus().map((p) => ({ id: p.id, label: p.label, connected: p.connected, model: p.cfg.model, month: p.month, budget: p.cfg.monthlyTokenBudget })), fake: process.env.ORCH_FAKE_LLM === '1' && process.env.NODE_ENV !== 'production' }))],
  ['PUT', new RegExp(`^${A}/orkestra/ayarlar$`), async ({ req, res }) => { const u = requireAdmin(req); sendJson(res, 200, { settings: orch.saveSettings(await J(req, 4096), u) }); }],

  /* ---------- Social Studio ---------- */
  ['GET', new RegExp(`^${A}/sosyal$`), ({ req, res }) => (requireUser(req), sendJson(res, 200, { summary: social.socialSummary(), platforms: Object.entries(social.PLATFORMS).map(([k, p]) => ({ id: k, label: p.label, limit: p.limit, caps: p.caps, needs: p.needs, url: p.url, docs: p.docs, connected: oauth.listAccounts('x').find((a) => a.id === k)?.connected ?? false })), specialDays: social.upcomingSpecialDays(), statuses: social.STATUSES }))],
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

  ['GET', new RegExp(`^${A}/sosyal/ozet$`), ({ req, res, url }) => (requireUser(req), sendJson(res, 200, social.socialOverview([7, 30, 90].includes(Number(url.searchParams.get('gun'))) ? Number(url.searchParams.get('gun')) : 30)))],
  ['PUT', new RegExp(`^${A}/sosyal/ozelgun$`), async ({ req, res }) => { const b = await J(req, 1024); social.setAutoDay(String(b.date ?? ''), b.enabled === true, requireUser(req)); sendJson(res, 200, { ok: true, made: b.enabled === true ? social.autoDraftSpecialDays() : 0 }); }],
  ['POST', new RegExp(`^${A}/sosyal/hashtag$`), async ({ req, res }) => { requireUser(req); sendJson(res, 200, { tags: social.hashtagSuggestions(String((await J(req, 20 * 1024)).text ?? '')) }); }],
  ['GET', new RegExp(`^${A}/marka$`), ({ req, res }) => (requireUser(req), sendJson(res, 200, brandData()))],
  ['POST', new RegExp(`^${A}/marka/onizle$`), async ({ req, res }) => {
    requireUser(req);
    const r = await renderBrand(await J(req, 8 * 1024));
    sendJson(res, 200, { mime: r.mime, w: r.w, h: r.h, data: r.buf.toString('base64') });
  }],
  ['POST', new RegExp(`^${A}/marka/kaydet$`), async ({ req, res }) => sendJson(res, 200, await saveRender(await J(req, 8 * 1024), requireUser(req)))],

  /* ---------- İngilizce site (çeviri hafızası) ---------- */
  ['GET', new RegExp(`^${A}/dil$`), ({ req, res }) => {
    requireUser(req);
    const connected = providerStatus().filter((p) => p.connected).map((p) => ({ id: p.id, label: p.label, model: p.cfg.model }));
    sendJson(res, 200, { mode: i18n.getMode(), provider: getSetting('i18n.provider', ''), connected, glossary: i18n.getGlossary(), slugs: i18n.getSlugs(), ...i18n.stats(), job: i18n.jobState(), fake: process.env.I18N_FAKE === '1' && process.env.NODE_ENV !== 'production' });
  }],
  ['GET', new RegExp(`^${A}/dil/tahmin$`), ({ req, res }) => (requireUser(req), sendJson(res, 200, i18n.estimate()))],
  ['PUT', new RegExp(`^${A}/dil/ayar$`), async ({ req, res }) => {
    const u = requireAdmin(req);
    const b = await J(req, 32 * 1024);
    if (b.glossary) i18n.setGlossary(b.glossary, u);
    if (b.slugs) { try { i18n.setSlugs(b.slugs, u); } catch (e) { throw new HttpError(e.status ?? 400, e.message); } }
    if (b.mode !== undefined || b.provider !== undefined) i18n.setMode(b.mode ?? i18n.getMode(), b.provider, u);
    const started = i18n.getMode() === 'otomatik' && b.mode === 'otomatik' ? i18n.startBackground() : { started: false };
    sendJson(res, 200, { ok: true, mode: i18n.getMode(), started: started.started });
  }],
  ['POST', new RegExp(`^${A}/dil/cevir$`), ({ req, res }) => { requireAdmin(req); sendJson(res, 200, i18n.startBackground()); }],
  ['POST', new RegExp(`^${A}/dil/uret$`), async ({ req, res }) => { requireUser(req); const rep = await i18n.generate(config.siteDir); sendJson(res, 200, { published: rep.published, total: rep.pages?.length ?? 0, missing: rep.missing?.length ?? 0 }); }],
  ['GET', new RegExp(`^${A}/dil/hafiza$`), ({ req, res, url }) => {
    requireUser(req);
    const p = url.searchParams;
    sendJson(res, 200, i18n.listTm({ status: p.get('durum') ?? '', search: p.get('ara') ?? '', limit: p.get('limit') ?? 50, offset: p.get('offset') ?? 0 }));
  }],
  ['PUT', new RegExp(`^${A}/dil/hafiza/([a-f0-9]{24})$`), async ({ req, res, m }) => { const b = await J(req, 32 * 1024); i18n.editTm(m[1], b.en, b.approve === true, requireUser(req)); sendJson(res, 200, { ok: true }); }],
  ['DELETE', new RegExp(`^${A}/dil/hafiza/([a-f0-9]{24})$`), ({ req, res, m }) => (i18n.deleteTm(m[1], requireAdmin(req)), i18n.scheduleGenerate(), sendJson(res, 200, { ok: true }))],

  /* ---------- Market & Media / Rakip / Backlink ---------- */
  ['GET', new RegExp(`^${A}/pazar/ozet$`), ({ req, res, url }) => (requireUser(req), sendJson(res, 200, intel.marketOverview([7, 30, 90].includes(Number(url.searchParams.get('gun'))) ? Number(url.searchParams.get('gun')) : 30)))],
  ['GET', new RegExp(`^${A}/rakip-ozet$`), ({ req, res, url }) => (requireUser(req), sendJson(res, 200, intel.competitorOverview([7, 30, 90].includes(Number(url.searchParams.get('gun'))) ? Number(url.searchParams.get('gun')) : 30)))],
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
