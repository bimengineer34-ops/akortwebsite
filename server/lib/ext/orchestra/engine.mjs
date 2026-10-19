// AI Orchestra orkestrasyon motoru — SQLite'ta kalıcı görev grafı (DAG), süreç içi zamanlayıcı, yeniden deneme, iptal, onay kapıları.
// Tasarım ilkeleri: (1) model çıktısı güvenilmez → şema + deterministik doğrulama; (2) dış sistemi/blog/sosyali değiştiren her eylem insan onayından SONRA ve
// tek sefer (idempotent) çalışır; (3) her geçiş atomik (CAS) olduğundan aynı işlem iki kez yürütülmez; (4) hiçbir gizli bilgi loga/olaya yazılmaz.
import crypto from 'node:crypto';
import { q, audit, getSetting, setSetting } from '../../db.mjs';
import { HttpError } from '../../http.mjs';
import { saveEntry, getEntry } from '../../entries.mjs';
import { savePost } from '../social.mjs';
import { saveRender } from '../brand.mjs';
import { featureOn } from '../schema.mjs';
import './schema.mjs';
import { seedAgents, getAgent, listAgents, setExecutable, isExecutable } from './agents.mjs';
import { RUNNERS, slugify } from './runners.mjs';
import { chatJson, llmReady } from './llm.mjs';
import { SAFETY_RULES, redact, validateSchema } from './safety.mjs';

/* ------------------------------ yardımcılar ------------------------------ */
const j = (v) => JSON.stringify(v);
const p = (s, d) => { try { return JSON.parse(s); } catch { return d; } };
const TERMINAL_RUN = new Set(['succeeded', 'failed', 'cancelled']);
const DONE_OK = new Set(['succeeded', 'skipped']);
const num = (name, def) => { const n = Number(getSetting(name, '')); return Number.isFinite(n) && n > 0 ? n : def; };
export const settings = () => ({ concurrency: num('orch.concurrency', 2), tokenLimit: Number(getSetting('orch.token_limit', '150000')) || 0, dailyTokenLimit: Number(getSetting('orch.daily_token_limit', '0')) || 0, provider: getSetting('orch.provider', '') });
export const saveSettings = (b, user) => {
  if (b.concurrency !== undefined) { const n = Number(b.concurrency); if (!Number.isInteger(n) || n < 1 || n > 6) throw new HttpError(400, 'Eşzamanlılık 1–6 arasında olmalı'); setSetting('orch.concurrency', String(n)); }
  if (b.tokenLimit !== undefined) { const n = Number(b.tokenLimit); if (!Number.isInteger(n) || n < 0 || n > 5_000_000) throw new HttpError(400, 'Görev başına token limiti 0–5.000.000 olmalı (0 = sınırsız)'); setSetting('orch.token_limit', String(n)); }
  if (b.dailyTokenLimit !== undefined) { const n = Number(b.dailyTokenLimit); if (!Number.isInteger(n) || n < 0 || n > 100_000_000) throw new HttpError(400, 'Günlük genel token limiti 0–100.000.000 olmalı (0 = sınırsız)'); setSetting('orch.daily_token_limit', String(n)); }
  if (b.provider !== undefined) { if (b.provider && !['openai', 'anthropic', 'gemini'].includes(b.provider)) throw new HttpError(400, 'Geçersiz sağlayıcı'); setSetting('orch.provider', b.provider); }
  audit(user, 'orkestra.ayar', 'orkestra', j({ concurrency: settings().concurrency, tokenLimit: settings().tokenLimit, dailyTokenLimit: settings().dailyTokenLimit }));
  return settings();
};

export const ev = (runId, taskId, agent, level, event, message = '') =>
  q.run('INSERT INTO orch_events (run_id, task_id, agent, level, event, message) VALUES (?,?,?,?,?,?)', runId ?? null, taskId ?? null, agent ?? null, level, event, redact(message).slice(0, 500));

const flag = () => { if (!featureOn('orchestra')) throw new HttpError(503, '"orkestra" modülü özellik bayrağı ile kapatılmış'); };

/* ------------------------------ eylemler (insan onayından sonra çalışır) ------------------------------ */
const ACTIONS = {
  'action.blog_draft': {
    label: 'Blog editöründe TASLAK oluştur (yayınlamaz)', external: false,
    run: async ({ task, deps, run }) => {
      const key = `orch.action.${task.id}`;
      const done = p(getSetting(key, ''), null);
      if (done) return { output: done }; // çökme sonrası yeniden çalıştırmada ikinci taslak oluşmaz
      const c = Object.values(deps).find((d) => d?.body && d?.category && !d.internal_links);
      const s = Object.values(deps).find((d) => d?.internal_links);
      if (!c) throw Object.assign(new Error('Blog taslağı için içerik çıktısı bulunamadı'), { fatal: true });
      const base = (s?.slug || c.slug || slugify(c.title)) || `yazi-${run.id}`;
      let slug = base, n = 2;
      const exists = (sl) => { try { getEntry('blog', sl); return true; } catch { return false; } };
      while (exists(slug) && n < 30) slug = `${base.slice(0, 74)}-${n++}`;
      if (exists(slug)) throw Object.assign(new Error('Benzersiz adres (slug) üretilemedi'), { fatal: true });
      const data = {
        title: (s?.title || c.title).slice(0, 110), description: (s?.description || c.description).slice(0, 170), excerpt: c.excerpt || undefined,
        pubDate: new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Istanbul' }), category: c.category, tags: s?.tags?.length ? s.tags : c.tags,
        draft: true, featured: false, popular: false,
      };
      try { saveEntry('blog', slug, { data, body: s?.body || c.body }, { email: task.approved_by || run.created_by || 'orkestra' }, { create: true }); }
      catch (e) { throw Object.assign(new Error(`Blog taslağı kaydedilemedi: ${e.extra?.errors?.join('; ') || e.message}`), { fatal: true }); }
      const out = { slug, href: `#/blog/${slug}`, draft: true, title: data.title };
      setSetting(key, j(out));
      return { output: out };
    },
  },
  'action.social_draft': {
    label: 'Social Studio\'da gönderi TASLAKLARI oluştur (yayınlamaz)', external: false,
    run: async ({ task, deps, run }) => {
      const key = `orch.action.${task.id}`;
      const done = p(getSetting(key, ''), null);
      if (done) return { output: done };
      const sc = Object.values(deps).find((d) => Array.isArray(d?.posts));
      if (!sc) throw Object.assign(new Error('Sosyal gönderi çıktısı bulunamadı'), { fatal: true });
      const img = Object.values(deps).find((d) => d?.media && d?.filename); // Visual Design → Brand Kit görseli (varsa)
      const ids = [];
      for (const post of sc.posts) {
        try {
          const r = savePost(0, { title: `Orkestra #${run.id} · ${post.platform}`, body: post.text, hashtags: (post.hashtags ?? []).join(' '), platforms: [post.platform], category: 'orkestra', media: img?.media ?? '', source_ref: `orkestra:run:${run.id}` }, { email: task.approved_by || run.created_by || 'orkestra', role: 'editor' });
          ids.push(r.id);
        } catch (e) { throw Object.assign(new Error(`Sosyal taslak kaydedilemedi: ${e.message}`), { fatal: true }); }
      }
      const out = { postIds: ids, draft: true, href: '#/sosyal/arsiv' };
      setSetting(key, j(out));
      return { output: out };
    },
  },
  'action.crm_opportunity': {
    label: "CRM'de iş fırsatı kaydı oluştur (e-posta/teklif GÖNDERMEZ)", external: false,
    run: async ({ task, deps, run }) => {
      const key = `orch.action.${task.id}`;
      const done = p(getSetting(key, ''), null);
      if (done) return { output: done };
      const crm = Object.values(deps).find((d) => d?.stage === 'yeni' && d?.title && d?.priority);
      const sl = Object.values(deps).find((d) => d?.draft_reply);
      if (!crm || !sl) throw Object.assign(new Error('Fırsat kaydı için Sales ve CRM çıktıları gerekli'), { fatal: true });
      const orig = q.get('SELECT id FROM forms WHERE id = ?', Number(crm.form_id));
      if (!orig) throw Object.assign(new Error(`Kaynak talep #${crm.form_id} bulunamadı (silinmiş olabilir)`), { fatal: true });
      const who = task.approved_by || run.created_by || 'orkestra';
      const msg = [sl.summary, sl.missing_info?.length ? `Eksik bilgiler:\n- ${sl.missing_info.join('\n- ')}` : '', sl.next_steps?.length ? `Önerilen adımlar:\n- ${sl.next_steps.join('\n- ')}` : '', `YANIT TASLAĞI (GÖNDERİLMEDİ — göndermeden önce gözden geçirin):\n${sl.draft_reply}`, sl.risk_flags?.length ? `Uyarılar:\n- ${sl.risk_flags.join('\n- ')}` : ''].filter(Boolean).join('\n\n');
      const r = q.run(`INSERT INTO forms (kind, name, email, subject, message, payload, consent, status, handled_by) VALUES ('firsat', 'Orkestra analizi', '', ?, ?, ?, 0, 'yeni', ?)`,
        `Fırsat: ${crm.title}`.slice(0, 200), msg.slice(0, 6000), j({ kaynak: 'orkestra', form_id: orig.id, oncelik: crm.priority, aciliyet: crm.urgency, etiketler: crm.tags, calistirma: run.id }), who);
      q.run(`UPDATE forms SET note = TRIM(COALESCE(note, '') || char(10) || ?), updated_at = datetime('now') WHERE id = ?`, `[Orkestra #${run.id}] Fırsat kaydı #${Number(r.lastInsertRowid)} oluşturuldu; yanıt taslağı gönderilmedi.`, orig.id);
      audit({ email: who }, 'orkestra.crm_firsat', String(orig.id), `fırsat #${Number(r.lastInsertRowid)}`);
      const out = { opportunityId: Number(r.lastInsertRowid), formId: orig.id, href: '#/formlar', sent: false };
      setSetting(key, j(out));
      return { output: out };
    },
  },
  'action.brand_image': {
    label: 'Brand Kit ile görsel üret ve medya kitaplığına kaydet (yayınlamaz)', external: false,
    run: async ({ task, deps, run }) => {
      const key = `orch.action.${task.id}`;
      const done = p(getSetting(key, ''), null);
      if (done) return { output: done };
      const d = Object.values(deps).find((x) => x?.template && x?.theme && x?.format && x?.title);
      if (!d) throw Object.assign(new Error('Görsel için Visual Design çıktısı gerekli'), { fatal: true });
      let rec;
      try { rec = await saveRender({ format: d.format, theme: d.theme, title: d.title, subtitle: d.subtitle, template: 'orkestra', out: 'png' }, { email: task.approved_by || run.created_by || 'orkestra' }); }
      catch (e) { throw Object.assign(new Error(`Görsel üretilemedi: ${e.message}`), { fatal: true }); }
      const out = { media: rec.url, id: rec.id, filename: rec.filename, alt: d.alt, width: rec.width, height: rec.height };
      setSetting(key, j(out));
      return { output: out };
    },
  },
};
export const _ACTIONS = ACTIONS; // yalnızca testler için
export const ACTION_LIST = Object.entries(ACTIONS).map(([k, a]) => ({ key: k, label: a.label, external: a.external }));

/* ------------------------------ iş akışı doğrulama ------------------------------ */
const REF_RE = /^[a-z0-9_]{1,24}$/;
/**
 * steps → { steps, errors, notes }. `autoApproval`: bir eylemin atalarında onay adımı yoksa otomatik eklenir (Master planları için).
 * Kural: hiçbir eylem onay adımı olmadan çalışamaz.
 */
export const validateSteps = (input, { autoApproval = false } = {}) => {
  const errors = [], notes = [];
  if (!Array.isArray(input) || !input.length) return { steps: [], errors: ['En az bir adım gerekli'], notes };
  if (input.length > 12) return { steps: [], errors: ['En fazla 12 adım olabilir'], notes };
  let steps = input.map((s) => ({
    ref: String(s.ref ?? '').trim(), kind: String(s.kind ?? 'agent'), agent: String(s.agent ?? '').trim(), title: String(s.title ?? '').trim().slice(0, 140),
    depends_on: Array.isArray(s.depends_on) ? s.depends_on.map(String) : [], input: s.input && typeof s.input === 'object' && !Array.isArray(s.input) ? s.input : {},
  }));
  const refs = new Set();
  for (const s of steps) {
    if (!REF_RE.test(s.ref)) errors.push(`Adım kodu geçersiz: "${s.ref}" (küçük harf/rakam/_ , ≤24)`);
    if (refs.has(s.ref)) errors.push(`Yinelenen adım kodu: ${s.ref}`);
    refs.add(s.ref);
    if (!['agent', 'approval', 'action'].includes(s.kind)) errors.push(`${s.ref}: geçersiz tür`);
    if (!s.title) errors.push(`${s.ref}: başlık gerekli`);
    if (s.kind === 'agent') {
      const a = getAgent(s.agent);
      if (s.agent === 'master') errors.push(`${s.ref}: Master Orchestrator iş akışı adımı olarak kullanılamaz (yalnızca planlar)`);
      else if (!a) errors.push(`${s.ref}: bilinmeyen ajan "${s.agent}"`);
      else if (!a.executable) errors.push(`${s.ref}: "${a.name}" bu sürümde çalıştırılamaz — ${a.notConnectedReason}`);
      else if (!a.enabled) errors.push(`${s.ref}: "${a.name}" kapalı (Ajanlar sayfasından açın)`);
    }
    if (s.kind === 'action' && !ACTIONS[s.agent]) errors.push(`${s.ref}: bilinmeyen eylem "${s.agent}"`);
    if (s.kind === 'approval') s.agent = '';
  }
  for (const s of steps) for (const d of s.depends_on) { if (!refs.has(d)) errors.push(`${s.ref}: bağımlılık bulunamadı → ${d}`); if (d === s.ref) errors.push(`${s.ref}: kendine bağımlı olamaz`); }
  if (errors.length) return { steps, errors, notes };
  // döngü denetimi (Kahn)
  const indeg = new Map(steps.map((s) => [s.ref, s.depends_on.length]));
  const queue = steps.filter((s) => !s.depends_on.length).map((s) => s.ref);
  let seen = 0;
  while (queue.length) { const r = queue.shift(); seen++; for (const s of steps) if (s.depends_on.includes(r)) { indeg.set(s.ref, indeg.get(s.ref) - 1); if (indeg.get(s.ref) === 0) queue.push(s.ref); } }
  if (seen !== steps.length) return { steps, errors: ['Adımlar arasında döngü var'], notes };
  const by = new Map(steps.map((s) => [s.ref, s]));
  const anc = (ref, acc = new Set()) => { for (const d of by.get(ref).depends_on) if (!acc.has(d)) { acc.add(d); anc(d, acc); } return acc; };
  for (const s of [...steps]) {
    if (s.kind !== 'action') continue;
    const hasGate = [...anc(s.ref)].some((r) => by.get(r)?.kind === 'approval');
    if (hasGate) continue;
    if (!autoApproval) { errors.push(`${s.ref}: eylem adımından önce bir insan onayı (approval) adımı gerekir`); continue; }
    let ref = `onay_${s.ref}`.slice(0, 24); let n = 2;
    while (by.has(ref)) ref = `onay_${s.ref}`.slice(0, 21) + `_${n++}`;
    const gate = { ref, kind: 'approval', agent: '', title: `İnsan onayı: ${s.title}`.slice(0, 140), depends_on: [...s.depends_on], input: {} };
    steps.splice(steps.indexOf(s), 0, gate);
    by.set(ref, gate);
    s.depends_on = [...new Set([...s.depends_on, ref])];
    notes.push(`"${s.title}" eyleminden önce otomatik insan onayı adımı eklendi`);
  }
  return { steps, errors, notes };
};

/** {{param}} yerleştirme (yalnızca düz metin alanlar) */
const fill = (v, params) => (typeof v === 'string' ? v.replace(/\{\{\s*([a-z0-9_]+)\s*\}\}/gi, (_, k) => String(params?.[k] ?? '')) : Array.isArray(v) ? v.map((x) => fill(x, params)) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, fill(x, params)])) : v);

/* ------------------------------ yerleşik iş akışı ------------------------------ */
export const BLOG_WORKFLOW = {
  name: 'Blog Taslağı: Araştırma → İçerik → SEO → QA → Onay → Taslak',
  description: 'Konu verin; Research, Content, SEO ve QA ajanları çalışır, siz onaylarsanız blog editöründe TASLAK olarak açılır (yayınlanmaz).',
  steps: [
    { ref: 'research', kind: 'agent', agent: 'research', title: 'Araştırma ve kaynak taraması', depends_on: [], input: { topic: '{{topic}}' } },
    { ref: 'content', kind: 'agent', agent: 'content', title: 'Blog taslağını yaz', depends_on: ['research'], input: { topic: '{{topic}}' } },
    { ref: 'seo', kind: 'agent', agent: 'seo', title: 'SEO analizi ve iyileştirme', depends_on: ['content'], input: { topic: '{{topic}}', focus: '{{focus}}' } },
    { ref: 'qa', kind: 'agent', agent: 'qa', title: 'Kalite ve doğruluk denetimi', depends_on: ['content', 'seo'], input: {} },
    { ref: 'approval', kind: 'approval', agent: '', title: 'İnsan onayı: blog taslağı', depends_on: ['qa'], input: {} },
    { ref: 'draft', kind: 'action', agent: 'action.blog_draft', title: 'Blog editöründe taslak oluştur', depends_on: ['approval', 'content', 'seo'], input: {} },
  ],
};
export const SITE_SEO_WORKFLOW = {
  name: 'Site SEO Denetimi (mevcut sayfalar)',
  description: 'Mevcut sayfaların başlık, meta açıklama, iç bağlantı ve teknik SEO durumunu tarar; SEO ajanı önceliklendirilmiş bir iyileştirme listesi çıkarır. Hiçbir içerik değiştirmez.',
  steps: [{ ref: 'seo', kind: 'agent', agent: 'seo', title: 'Mevcut sayfaların SEO analizi', depends_on: [], input: { scope: 'site' } }],
};
export const CRM_WORKFLOW = {
  name: 'Müşteri Talebi Analizi: Sales → CRM → Onay → Fırsat kaydı',
  description: 'Bir iletişim talebini analiz eder (kişisel veriler modele gönderilmez), yanıt TASLAĞI ve iş fırsatı önerisi hazırlar; onayınızdan sonra CRM\'e fırsat kaydı açar. E-posta/teklif GÖNDERMEZ.',
  steps: [
    { ref: 'sales', kind: 'agent', agent: 'sales', title: 'Talep analizi ve yanıt taslağı', depends_on: [], input: { formId: '{{formId}}' } },
    { ref: 'crm', kind: 'agent', agent: 'crm', title: 'İş fırsatı önerisi', depends_on: ['sales'], input: {} },
    { ref: 'approval', kind: 'approval', agent: '', title: 'İnsan onayı: CRM fırsat kaydı', depends_on: ['crm'], input: {} },
    { ref: 'record', kind: 'action', agent: 'action.crm_opportunity', title: "CRM'de fırsat kaydı oluştur", depends_on: ['approval', 'sales', 'crm'], input: {} },
  ],
};
export const SOCIAL_WORKFLOW = {
  name: 'Sosyal Gönderi: Social + Design → Onay → Görsel + Taslak',
  description: 'Social ajanı metni, Visual Design ajanı görsel kurgusunu paralel hazırlar; onayınızdan sonra Brand Kit görseli üretilir ve gönderi Social Studio\'da TASLAK olarak açılır (yayınlanmaz).',
  steps: [
    { ref: 'social', kind: 'agent', agent: 'social', title: 'Gönderi metinleri', depends_on: [], input: { topic: '{{topic}}' } },
    { ref: 'design', kind: 'agent', agent: 'design', title: 'Görsel kurgusu', depends_on: [], input: { topic: '{{topic}}' } },
    { ref: 'approval', kind: 'approval', agent: '', title: 'İnsan onayı: gönderi ve görsel', depends_on: ['social', 'design'], input: {} },
    { ref: 'image', kind: 'action', agent: 'action.brand_image', title: 'Brand Kit görselini üret', depends_on: ['approval', 'design'], input: {} },
    { ref: 'draft', kind: 'action', agent: 'action.social_draft', title: 'Social Studio taslağı oluştur', depends_on: ['approval', 'social', 'image'], input: {} },
  ],
};
export const seedWorkflows = () => {
  for (const w of [BLOG_WORKFLOW, SITE_SEO_WORKFLOW, CRM_WORKFLOW, SOCIAL_WORKFLOW]) q.run(`INSERT OR IGNORE INTO orch_workflows (name, description, steps, builtin, created_by) VALUES (?,?,?,1,'sistem')`, w.name, w.description, j(w.steps));
};

export const listWorkflows = () => q.all('SELECT * FROM orch_workflows ORDER BY builtin DESC, id').map((w) => ({ ...w, steps: p(w.steps, []), builtin: !!w.builtin }));
export const saveWorkflow = (id, b, user) => {
  const name = String(b.name ?? '').trim().slice(0, 100);
  if (name.length < 3) throw new HttpError(400, 'Ad en az 3 karakter olmalı');
  const v = validateSteps(b.steps);
  if (v.errors.length) throw new HttpError(422, 'Geçersiz iş akışı', { errors: v.errors });
  if (id) {
    const cur = q.get('SELECT * FROM orch_workflows WHERE id = ?', id);
    if (!cur) throw new HttpError(404, 'İş akışı bulunamadı');
    if (cur.builtin) throw new HttpError(409, 'Yerleşik iş akışı değiştirilemez; kopyasını kaydedin');
    q.run(`UPDATE orch_workflows SET name=?, description=?, steps=?, updated_at=datetime('now') WHERE id=?`, name, String(b.description ?? '').slice(0, 400), j(v.steps), id);
    audit(user, 'orkestra.akis_guncelle', String(id), name);
    return { id };
  }
  try {
    const r = q.run(`INSERT INTO orch_workflows (name, description, steps, builtin, created_by) VALUES (?,?,?,0,?)`, name, String(b.description ?? '').slice(0, 400), j(v.steps), user.email);
    audit(user, 'orkestra.akis_olustur', String(r.lastInsertRowid), name);
    return { id: Number(r.lastInsertRowid) };
  } catch (e) { if (/UNIQUE/.test(e.message)) throw new HttpError(409, 'Bu adla bir iş akışı zaten var'); throw e; }
};
export const deleteWorkflow = (id, user) => {
  const cur = q.get('SELECT * FROM orch_workflows WHERE id = ?', id);
  if (!cur) throw new HttpError(404, 'İş akışı bulunamadı');
  if (cur.builtin) throw new HttpError(409, 'Yerleşik iş akışı silinemez');
  q.run('DELETE FROM orch_workflows WHERE id = ?', id);
  audit(user, 'orkestra.akis_sil', String(id), cur.name);
};

/* ------------------------------ Master planlama ------------------------------ */
export const planFromCommand = async (command, user) => {
  flag();
  command = String(command ?? '').trim();
  if (command.length < 8) throw new HttpError(400, 'Komut çok kısa');
  if (command.length > 2000) throw new HttpError(413, 'Komut çok uzun (en çok 2000 karakter)');
  const master = getAgent('master');
  if (!master?.enabled) throw new HttpError(409, 'Master Orchestrator kapalı');
  if (!llmReady()) throw new HttpError(409, 'Yapay zekâ sağlayıcısı bağlı değil: Entegrasyonlar sayfasından bir API anahtarı ekleyin.');
  const agents = listAgents().filter((a) => a.executable && a.enabled && a.key !== 'master');
  const catalog = agents.map((a) => `- ${a.key}: ${a.role} | girdi alanları: ${Object.keys(a.input_schema.properties ?? {}).join(', ') || '—'}`).join('\n');
  const actions = ACTION_LIST.map((a) => `- ${a.key}: ${a.label}`).join('\n');
  const system = `${master.system_prompt}\n\n${SAFETY_RULES}\n\nÇIKTI BİÇİMİ: yalnızca şu JSON şemasına uyan TEK bir JSON nesnesi:\n${j(master.output_schema)}`;
  const prompt = `## KOMUT\n${command}\n\n## KULLANILABİLİR AJANLAR (kind: "agent", agent: anahtar)\n${catalog}\n\n## KULLANILABİLİR EYLEMLER (kind: "action", agent: eylem anahtarı; her eylemden önce kind: "approval" adımı gerekir)\n${actions}\n\n## KURALLAR\n- En çok 12 adım. "ref" yalnızca küçük harf, rakam ve _ ; en çok 24 karakter.\n- Blog yazısı hazırlama sırası: research → content → seo → qa → approval → action.blog_draft.\n- Listede olmayan istekleri "unsupported" içine yaz.`;
  const { json, usage } = await chatJson({ agent: master, key: 'master', system, prompt, max: master.max_tokens });
  const schemaErrs = validateSchema(master.output_schema, json);
  if (schemaErrs.length) throw new HttpError(502, `Master geçerli plan üretemedi: ${schemaErrs.slice(0, 3).join('; ')}`);
  const v = validateSteps(json.steps, { autoApproval: true });
  if (v.errors.length) throw new HttpError(422, 'Master planı doğrulamadan geçemedi', { errors: v.errors });
  ev(null, null, 'master', 'info', 'plan', `Komut ${v.steps.length} adıma ayrıldı (${usage.inTok}+${usage.outTok} token)`);
  audit(user, 'orkestra.plan', '', command.slice(0, 120));
  return { summary: json.summary, steps: v.steps, notes: v.notes, unsupported: json.unsupported ?? [], usage: { inTok: usage.inTok, outTok: usage.outTok, model: usage.model } };
};

/* ------------------------------ görev çalıştırma oluşturma ------------------------------ */
export const createRun = ({ title, command = '', steps, workflowId = null, params = {}, idempotencyKey, tokenLimit }, user) => {
  flag();
  if (!/^[A-Za-z0-9_-]{16,80}$/.test(String(idempotencyKey ?? ''))) throw new HttpError(400, 'idempotencyKey (16–80 karakter) zorunlu');
  const dup = q.get('SELECT id FROM orch_runs WHERE idempotency_key = ?', idempotencyKey);
  if (dup) return { id: dup.id, duplicate: true };
  const v = validateSteps(steps, { autoApproval: false });
  if (v.errors.length) throw new HttpError(422, 'Geçersiz iş akışı', { errors: v.errors });
  const cleanParams = {};
  for (const [k, val] of Object.entries(params ?? {})) if (/^[a-z0-9_]{1,30}$/i.test(k)) cleanParams[k] = String(val ?? '').slice(0, 500);
  const t = String(title ?? '').trim().slice(0, 140) || 'Adsız çalıştırma';
  const lim = tokenLimit !== undefined ? Math.max(0, Math.min(5_000_000, Number(tokenLimit) || 0)) : settings().tokenLimit;
  const run = q.run(`INSERT INTO orch_runs (title, command, workflow_id, params, idempotency_key, token_limit, created_by) VALUES (?,?,?,?,?,?,?)`, t, String(command).slice(0, 2000), workflowId, j(cleanParams), idempotencyKey, lim, user.email);
  const runId = Number(run.lastInsertRowid);
  for (const s of v.steps) {
    const a = s.kind === 'agent' ? getAgent(s.agent) : null;
    q.run(`INSERT INTO orch_tasks (run_id, ref, kind, agent, title, depends_on, input, max_attempts, requires_approval, external, approval_state) VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
      runId, s.ref, s.kind, s.agent, s.title, j(s.depends_on), j(fill(s.input, cleanParams)), (a?.max_retries ?? 0) + 1,
      s.kind === 'approval' || a?.requires_approval ? 1 : 0, s.kind === 'action' && ACTIONS[s.agent]?.external ? 1 : 0, 'none');
  }
  ev(runId, null, '', 'info', 'olusturuldu', `${v.steps.length} adım · oluşturan ${user.email}`);
  audit(user, 'orkestra.calistir', String(runId), t);
  setImmediate(() => tick().catch(() => {}));
  return { id: runId, duplicate: false };
};

/* ------------------------------ zamanlayıcı ------------------------------ */
const inFlight = new Set(); // task id
const cancelledRuns = new Set();
let ticking = false;

const tasksOf = (runId) => q.all('SELECT * FROM orch_tasks WHERE run_id = ? ORDER BY id', runId);

export const refreshRun = (runId) => {
  const run = q.get('SELECT * FROM orch_runs WHERE id = ?', runId);
  if (!run || TERMINAL_RUN.has(run.status) || run.status === 'paused') return run; // duraklatılmış çalıştırmanın durumu elle değişir
  const ts = tasksOf(runId);
  let status = run.status, error = run.error;
  const failed = ts.find((t) => t.status === 'failed');
  if (failed) {
    status = 'failed'; error = `${failed.title}: ${failed.error ?? 'başarısız'}`;
    q.run(`UPDATE orch_tasks SET status = 'skipped', error = COALESCE(error, 'Önceki adım başarısız olduğu için atlandı'), finished_at = datetime('now') WHERE run_id = ? AND status IN ('pending','queued')`, runId);
    q.run(`UPDATE orch_tasks SET status = 'cancelled', finished_at = datetime('now') WHERE run_id = ? AND status = 'awaiting_approval'`, runId);
  } else if (ts.every((t) => DONE_OK.has(t.status))) status = 'succeeded';
  else if (ts.some((t) => t.status === 'running' || t.status === 'queued')) status = 'running';
  else if (ts.some((t) => t.status === 'awaiting_approval')) status = 'awaiting_approval'; // kalan adımlar onayı bekliyor
  else status = ts.some((t) => t.status === 'pending') ? 'running' : 'queued';
  if (status !== run.status || error !== run.error) {
    const fin = TERMINAL_RUN.has(status) ? ", finished_at = datetime('now')" : '';
    const start = status === 'running' && !run.started_at ? ", started_at = datetime('now')" : '';
    q.run(`UPDATE orch_runs SET status = ?, error = ?${fin}${start} WHERE id = ?`, status, error ?? null, runId);
    ev(runId, null, '', status === 'failed' ? 'error' : 'info', `durum_${status}`, error ?? '');
  }
  return q.get('SELECT * FROM orch_runs WHERE id = ?', runId);
};

/** Bir görevin tüm atalarının çıktıları (dolaylı olanlar dahil) — onay kapısı özeti için */
const ancestorOutputs = (task, all) => {
  const out = {}, seen = new Set();
  const walk = (t) => { for (const ref of p(t.depends_on, [])) { if (seen.has(ref)) continue; seen.add(ref); const d = all.find((x) => x.ref === ref); if (!d) continue; if (d.output && d.kind === 'agent') out[ref] = p(d.output, null); walk(d); } };
  walk(task);
  return out;
};
const depOutputs = (task, all) => {
  const out = {};
  for (const ref of p(task.depends_on, [])) { const d = all.find((x) => x.ref === ref); if (d && d.output) out[ref] = p(d.output, null); }
  return out;
};

const gateDigest = (task, deps) => {
  const qaOut = Object.values(deps).find((d) => typeof d?.passed === 'boolean' && Array.isArray(d?.issues));
  const seoOut = Object.values(deps).find((d) => d?.internal_links);
  const content = Object.values(deps).find((d) => d?.body && d?.category);
  return { title: seoOut?.title ?? content?.title ?? task.title, qa_passed: qaOut ? qaOut.passed : null, qa_blocking: qaOut?.blocking_count ?? 0, qa_summary: qaOut?.summary ?? '', seo_score: seoOut?.score ?? null, words: content?.body ? content.body.split(/\s+/).length : null, dependsOn: Object.keys(deps) };
};

const finishTask = (task, run, { output, usage }, requiresApproval) => {
  const status = requiresApproval ? 'awaiting_approval' : 'succeeded';
  const ok = q.run(`UPDATE orch_tasks SET status = ?, output = ?, error = NULL, approval_state = ?, tokens_in = tokens_in + ?, tokens_out = tokens_out + ?, model = ?, cost_est = COALESCE(cost_est,0) + ?, finished_at = datetime('now') WHERE id = ? AND status = 'running'`,
    status, j(output), requiresApproval ? 'pending' : task.approval_state === 'approved' ? 'approved' : 'none', usage?.inTok ?? 0, usage?.outTok ?? 0, usage?.model ?? null, usage?.costUsd ?? 0, task.id).changes;
  if (ok && usage) q.run('UPDATE orch_runs SET tokens_in = tokens_in + ?, tokens_out = tokens_out + ?, cost_est = COALESCE(cost_est,0) + ? WHERE id = ?', usage.inTok ?? 0, usage.outTok ?? 0, usage.costUsd ?? 0, run.id);
  ev(run.id, task.id, task.agent, 'info', requiresApproval ? 'onay_bekliyor' : 'tamamlandi', `${task.title}${usage ? ` · ${usage.inTok ?? 0}+${usage.outTok ?? 0} token` : ''}`);
};

const NO_RETRY = new Set([400, 401, 403, 404, 409, 413, 422, 429]);
const failOrRetry = (task, run, e) => {
  const msg = redact(e.message ?? String(e)).slice(0, 400);
  const usage = e.usage;
  if (usage) {
    q.run('UPDATE orch_tasks SET tokens_in = tokens_in + ?, tokens_out = tokens_out + ?, cost_est = COALESCE(cost_est,0) + ? WHERE id = ?', usage.inTok ?? 0, usage.outTok ?? 0, usage.costUsd ?? 0, task.id);
    q.run('UPDATE orch_runs SET tokens_in = tokens_in + ?, tokens_out = tokens_out + ?, cost_est = COALESCE(cost_est,0) + ? WHERE id = ?', usage.inTok ?? 0, usage.outTok ?? 0, usage.costUsd ?? 0, run.id);
  }
  const cur = q.get('SELECT attempts, max_attempts FROM orch_tasks WHERE id = ?', task.id);
  const retriable = !e.fatal && !NO_RETRY.has(e.status) && cur.attempts < cur.max_attempts;
  if (retriable) {
    const wait = Math.min(60, 3 * 2 ** (cur.attempts - 1));
    q.run(`UPDATE orch_tasks SET status = 'queued', error = ?, next_at = datetime('now', ?) WHERE id = ? AND status = 'running'`, msg, `+${wait} seconds`, task.id);
    ev(run.id, task.id, task.agent, 'warn', 'yeniden_deneme', `Deneme ${cur.attempts}/${cur.max_attempts} başarısız (${msg}); ${wait} sn sonra yeniden denenecek`);
  } else {
    q.run(`UPDATE orch_tasks SET status = 'failed', error = ?, finished_at = datetime('now') WHERE id = ? AND status = 'running'`, msg, task.id);
    ev(run.id, task.id, task.agent, 'error', 'basarisiz', `${task.title}: ${msg}`);
  }
};

/** Günlük token sınırları (ajan başına + genel). Kullanım görev bitince yazıldığından eşzamanlı görevlerde küçük bir aşım olabilir. */
const todayTokens = (where, ...args) => q.get(`SELECT COALESCE(SUM(tokens_in + tokens_out), 0) AS n FROM orch_tasks WHERE date(started_at) = date('now') ${where}`, ...args).n;
const warnOnce = (key, log, msg) => { if (getSetting(key, '') === '1') return; setSetting(key, '1'); log('warn', 'butce_uyari', msg); };
const checkDaily = (agent, log) => {
  const day = new Date().toISOString().slice(0, 10);
  for (const [kind, label, lim, used] of [
    ['ajan', agent.name, agent.daily_token_limit, () => todayTokens('AND agent = ?', agent.key)],
    ['genel', 'AI Orchestra', settings().dailyTokenLimit, () => todayTokens("AND kind = 'agent'")],
  ]) {
    if (!(lim > 0)) continue;
    const u = used();
    if (u >= lim) throw Object.assign(new Error(`${label} günlük token limiti aşıldı (${u}/${lim}); yarın veya limit yükseltilince devam eder`), { fatal: true });
    if (u >= lim * 0.8) warnOnce(`orch.warned.${kind}.${kind === 'ajan' ? agent.key : 'x'}.${day}`, log, `${label} günlük token limitinin %80'ine ulaştı (${u}/${lim})`);
  }
};
const executeTask = async (task) => {
  const run = q.get('SELECT * FROM orch_runs WHERE id = ?', task.run_id);
  const all = tasksOf(task.run_id);
  const deps = depOutputs(task, all);
  const input = p(task.input, {});
  try {
    if (task.kind === 'action') {
      const a = ACTIONS[task.agent];
      if (!a) throw Object.assign(new Error(`Bilinmeyen eylem: ${task.agent}`), { fatal: true });
      // Güvenlik ağı: ataların hiçbirinde ONAYLANMIŞ onay adımı yoksa eylem çalışmaz
      const gated = (function anc(t, seen = new Set()) { for (const r of p(t.depends_on, [])) { if (seen.has(r)) continue; seen.add(r); const d = all.find((x) => x.ref === r); if (d?.kind === 'approval' && d.approval_state === 'approved') return true; if (d && anc(d, seen)) return true; } return false; })(task);
      if (!gated) throw Object.assign(new Error('Onaylanmış insan onayı olmadan eylem çalıştırılamaz'), { fatal: true });
      const r = await a.run({ task, deps, run });
      if (q.get('SELECT status FROM orch_runs WHERE id = ?', run.id).status === 'cancelled') return;
      finishTask(task, run, { output: r.output, usage: null }, false);
      audit({ email: task.approved_by ?? 'orkestra' }, 'orkestra.eylem', `${run.id}/${task.ref}`, task.agent);
      return;
    }
    const agent = getAgent(task.agent);
    if (!agent?.enabled) throw Object.assign(new Error(`${agent?.name ?? task.agent} kapalı`), { fatal: true });
    const runner = RUNNERS[agent.key];
    if (!runner) throw Object.assign(new Error('Bu ajan için çalıştırıcı bağlı değil'), { fatal: true });
    if (run.token_limit > 0 && run.tokens_in + run.tokens_out >= run.token_limit) throw Object.assign(new Error(`Çalıştırma token limiti aşıldı (${run.token_limit})`), { fatal: true });
    const log = (level, event, msg) => ev(run.id, task.id, agent.key, level, event, msg);
    checkDaily(agent, log);
    const fresh = q.get('SELECT * FROM orch_tasks WHERE id = ?', task.id);
    const res = await Promise.race([
      runner({ agent, task: fresh, input, deps, run, log }),
      new Promise((_, rej) => setTimeout(() => rej(Object.assign(new Error(`Zaman aşımı (${agent.timeout_s} sn)`), { status: 504 })), agent.timeout_s * 1000).unref()),
    ]);
    if (q.get('SELECT status FROM orch_runs WHERE id = ?', run.id).status === 'cancelled') { q.run(`UPDATE orch_tasks SET status = 'cancelled', finished_at = datetime('now') WHERE id = ? AND status = 'running'`, task.id); return; }
    finishTask(task, run, res, !!agent.requires_approval);
  } catch (e) {
    if (q.get('SELECT status FROM orch_runs WHERE id = ?', run.id)?.status === 'cancelled') { q.run(`UPDATE orch_tasks SET status = 'cancelled', finished_at = datetime('now') WHERE id = ? AND status = 'running'`, task.id); return; }
    failOrRetry(task, run, e);
  } finally {
    refreshRun(run.id);
  }
};

export const tick = async () => {
  if (ticking) return;
  ticking = true;
  try {
    const active = q.all(`SELECT id FROM orch_runs WHERE status IN ('queued','running','awaiting_approval')`);
    for (const { id } of active) {
      const ts = tasksOf(id);
      for (const t of ts.filter((x) => x.status === 'pending')) {
        const deps = p(t.depends_on, []).map((r) => ts.find((x) => x.ref === r));
        if (deps.some((d) => !d || ['failed', 'cancelled', 'skipped'].includes(d.status))) { q.run(`UPDATE orch_tasks SET status = 'skipped', error = 'Bağımlı adım tamamlanamadı', finished_at = datetime('now') WHERE id = ? AND status = 'pending'`, t.id); continue; }
        if (!deps.every((d) => d.status === 'succeeded')) continue;
        if (t.kind === 'approval') {
          const digest = gateDigest(t, ancestorOutputs(t, ts));
          const ok = q.run(`UPDATE orch_tasks SET status = 'awaiting_approval', approval_state = 'pending', output = ?, started_at = datetime('now') WHERE id = ? AND status = 'pending'`, j(digest), t.id).changes;
          if (ok) ev(id, t.id, '', 'info', 'onay_bekliyor', t.title);
        } else q.run(`UPDATE orch_tasks SET status = 'queued' WHERE id = ? AND status = 'pending'`, t.id);
      }
      refreshRun(id);
    }
    const cap = settings().concurrency - inFlight.size;
    if (cap > 0) {
      const ready = q.all(`SELECT t.* FROM orch_tasks t JOIN orch_runs r ON r.id = t.run_id WHERE t.status = 'queued' AND r.status IN ('queued','running','awaiting_approval') AND (t.next_at IS NULL OR t.next_at <= datetime('now')) ORDER BY t.id LIMIT ?`, cap);
      for (const t of ready) {
        if (inFlight.has(t.id)) continue;
        // Atomik sahiplenme: aynı görev iki kez başlatılamaz
        const claimed = q.run(`UPDATE orch_tasks SET status = 'running', attempts = attempts + 1, started_at = datetime('now'), next_at = NULL WHERE id = ? AND status = 'queued'`, t.id).changes;
        if (!claimed) continue;
        inFlight.add(t.id);
        ev(t.run_id, t.id, t.agent, 'info', 'basladi', `${t.title} (deneme ${t.attempts + 1})`);
        refreshRun(t.run_id);
        executeTask({ ...t, attempts: t.attempts + 1 }).catch((e) => ev(t.run_id, t.id, t.agent, 'error', 'motor_hatasi', e.message)).finally(() => { inFlight.delete(t.id); setImmediate(() => tick().catch(() => {})); });
      }
    }
  } finally { ticking = false; }
};

/** Testler için: çalıştırma tamamlanana veya insan onayı bekleyene kadar motoru sür */
export const runUntilSettled = async (runId, { maxMs = 20000 } = {}) => {
  const t0 = Date.now();
  for (;;) {
    await tick();
    const run = refreshRun(runId);
    if (['succeeded', 'failed', 'cancelled', 'awaiting_approval'].includes(run.status) && !inFlight.size) return run;
    if (Date.now() - t0 > maxMs) throw new Error(`Zaman aşımı: çalıştırma ${run.status}`);
    await new Promise((r) => setTimeout(r, 25));
  }
};

/* ------------------------------ onay / red / iptal / yeniden deneme ------------------------------ */
const canApprove = (task, user) => {
  if (task.external && user.role !== 'admin') throw new HttpError(403, 'Dış sistemi değiştiren eylemler yalnızca yönetici onayıyla çalışır');
};
export const approveTask = (taskId, user, { note = '', ack = false } = {}) => {
  const t = q.get('SELECT * FROM orch_tasks WHERE id = ?', taskId);
  if (!t) throw new HttpError(404, 'Görev bulunamadı');
  if (t.status !== 'awaiting_approval' || t.approval_state !== 'pending') throw new HttpError(409, 'Bu görev onay beklemiyor (zaten işlenmiş olabilir)');
  const all = tasksOf(t.run_id);
  const downstreamExternal = all.some((x) => x.kind === 'action' && ACTIONS[x.agent]?.external && p(x.depends_on, []).includes(t.ref));
  canApprove({ external: t.external || downstreamExternal }, user);
  const out = p(t.output, {});
  if (out.qa_passed === false && !ack) throw new HttpError(409, 'QA kritik bulgu bildirdi; onaylamak için uyarıları gördüğünüzü işaretleyin (ack)');
  const ok = q.run(`UPDATE orch_tasks SET status = 'succeeded', approval_state = 'approved', approved_by = ?, approved_at = datetime('now'), approval_note = ?, finished_at = datetime('now') WHERE id = ? AND status = 'awaiting_approval' AND approval_state = 'pending'`, user.email, String(note).slice(0, 400), taskId).changes;
  if (!ok) throw new HttpError(409, 'Bu görev başka biri tarafından işlendi');
  ev(t.run_id, taskId, t.agent, 'info', 'onaylandi', `${t.title} · ${user.email}${out.qa_passed === false ? ' (QA uyarısı bilinerek)' : ''}`);
  audit(user, 'orkestra.onayla', `${t.run_id}/${t.ref}`, String(note).slice(0, 120));
  refreshRun(t.run_id);
  setImmediate(() => tick().catch(() => {}));
  return { ok: true };
};
export const rejectTask = (taskId, user, note = '') => {
  const t = q.get('SELECT * FROM orch_tasks WHERE id = ?', taskId);
  if (!t) throw new HttpError(404, 'Görev bulunamadı');
  const ok = q.run(`UPDATE orch_tasks SET status = 'failed', approval_state = 'rejected', approved_by = ?, approved_at = datetime('now'), approval_note = ?, error = ?, finished_at = datetime('now') WHERE id = ? AND status = 'awaiting_approval' AND approval_state = 'pending'`, user.email, String(note).slice(0, 400), `Reddedildi${note ? `: ${String(note).slice(0, 200)}` : ''}`, taskId).changes;
  if (!ok) throw new HttpError(409, 'Bu görev onay beklemiyor (zaten işlenmiş olabilir)');
  ev(t.run_id, taskId, t.agent, 'warn', 'reddedildi', `${t.title} · ${user.email}`);
  audit(user, 'orkestra.reddet', `${t.run_id}/${t.ref}`, String(note).slice(0, 120));
  refreshRun(t.run_id);
  return { ok: true };
};
export const pauseRun = (runId, user) => {
  const run = q.get('SELECT * FROM orch_runs WHERE id = ?', runId);
  if (!run) throw new HttpError(404, 'Çalıştırma bulunamadı');
  const ok = q.run(`UPDATE orch_runs SET status = 'paused' WHERE id = ? AND status IN ('queued','running','awaiting_approval')`, runId).changes;
  if (!ok) throw new HttpError(409, `"${run.status}" durumundaki çalıştırma duraklatılamaz`);
  ev(runId, null, '', 'warn', 'duraklatildi', `Duraklatan: ${user.email} (devam eden görevler tamamlanır, yenisi başlamaz)`);
  audit(user, 'orkestra.duraklat', String(runId));
  return { ok: true };
};
export const resumeRun = (runId, user) => {
  const ok = q.run(`UPDATE orch_runs SET status = 'running' WHERE id = ? AND status = 'paused'`, runId).changes;
  if (!ok) throw new HttpError(409, 'Yalnızca duraklatılmış çalıştırma devam ettirilebilir');
  ev(runId, null, '', 'info', 'devam_etti', `Devam ettiren: ${user.email}`);
  audit(user, 'orkestra.devam', String(runId));
  refreshRun(runId);
  setImmediate(() => tick().catch(() => {}));
  return { ok: true };
};
export const cancelRun = (runId, user) => {
  const run = q.get('SELECT * FROM orch_runs WHERE id = ?', runId);
  if (!run) throw new HttpError(404, 'Çalıştırma bulunamadı');
  if (TERMINAL_RUN.has(run.status)) throw new HttpError(409, 'Çalıştırma zaten sonlanmış');
  q.run(`UPDATE orch_runs SET status = 'cancelled', finished_at = datetime('now'), error = 'İptal edildi' WHERE id = ? AND status NOT IN ('succeeded','failed','cancelled')`, runId);
  q.run(`UPDATE orch_tasks SET status = 'cancelled', finished_at = datetime('now') WHERE run_id = ? AND status IN ('pending','queued','awaiting_approval')`, runId);
  cancelledRuns.add(runId);
  ev(runId, null, '', 'warn', 'iptal', `İptal eden: ${user.email}`);
  audit(user, 'orkestra.iptal', String(runId));
  return { ok: true };
};
export const retryTask = (taskId, user) => {
  const t = q.get('SELECT * FROM orch_tasks WHERE id = ?', taskId);
  if (!t) throw new HttpError(404, 'Görev bulunamadı');
  if (t.status !== 'failed' || t.approval_state === 'rejected') throw new HttpError(409, 'Yalnızca başarısız (reddedilmemiş) görevler yeniden denenebilir');
  const run = q.get('SELECT * FROM orch_runs WHERE id = ?', t.run_id);
  if (run.status === 'cancelled') throw new HttpError(409, 'İptal edilmiş çalıştırma yeniden başlatılamaz');
  const keepPaused = run.status === 'paused';
  q.run(`UPDATE orch_tasks SET status = 'queued', attempts = 0, error = NULL, next_at = NULL, finished_at = NULL WHERE id = ? AND status = 'failed'`, taskId);
  q.run(`UPDATE orch_tasks SET status = 'pending', error = NULL, finished_at = NULL WHERE run_id = ? AND status IN ('skipped','cancelled') AND id != ?`, t.run_id, taskId);
  q.run(`UPDATE orch_runs SET status = ?, error = NULL, finished_at = NULL WHERE id = ?`, keepPaused ? 'paused' : 'running', t.run_id);
  ev(t.run_id, taskId, t.agent, 'info', 'yeniden_baslatildi', `${t.title} · ${user.email}`);
  audit(user, 'orkestra.yeniden_dene', `${t.run_id}/${t.ref}`);
  setImmediate(() => tick().catch(() => {}));
  return { ok: true };
};

/* ------------------------------ sorgular ------------------------------ */
const taskView = (t) => ({ ...t, depends_on: p(t.depends_on, []), input: p(t.input, {}), output: p(t.output, null), requires_approval: !!t.requires_approval, external: !!t.external });
export const listRuns = ({ status = '', limit = 40 } = {}) => {
  const where = status ? 'WHERE status = ?' : '';
  const rows = q.all(`SELECT r.*, (SELECT COUNT(*) FROM orch_tasks t WHERE t.run_id = r.id) AS task_count, (SELECT COUNT(*) FROM orch_tasks t WHERE t.run_id = r.id AND t.status IN ('succeeded','skipped')) AS done_count FROM orch_runs r ${where} ORDER BY r.id DESC LIMIT ?`, ...(status ? [status] : []), Math.min(Number(limit) || 40, 200));
  return rows.map((r) => ({ ...r, params: p(r.params, {}) }));
};
export const getRun = (id) => {
  const run = q.get('SELECT * FROM orch_runs WHERE id = ?', id);
  if (!run) throw new HttpError(404, 'Çalıştırma bulunamadı');
  return { run: { ...run, params: p(run.params, {}), result: p(run.result, {}) }, tasks: tasksOf(id).map(taskView), events: q.all('SELECT * FROM orch_events WHERE run_id = ? ORDER BY id DESC LIMIT 200', id) };
};
export const pendingApprovals = () => q.all(`SELECT t.*, r.title AS run_title, r.created_by AS run_by FROM orch_tasks t JOIN orch_runs r ON r.id = t.run_id WHERE t.status = 'awaiting_approval' AND t.approval_state = 'pending' ORDER BY t.id`).map((t) => ({ ...taskView(t), run_title: t.run_title, run_by: t.run_by,
  context: ancestorOutputs(t, tasksOf(t.run_id)) }));

export const overview = () => {
  const daily = { tokens: todayTokens("AND kind = 'agent'"), limit: settings().dailyTokenLimit };
  const c = (s) => q.get(`SELECT COUNT(*) AS n FROM orch_runs WHERE status = ?`, s).n;
  const month = q.get(`SELECT COALESCE(SUM(tokens_in),0) AS i, COALESCE(SUM(tokens_out),0) AS o, COALESCE(SUM(cost_est),0) AS cost FROM orch_tasks WHERE created_at >= date('now','start of month')`);
  const byDay = q.all(`SELECT date(created_at) AS day, COUNT(*) AS runs FROM orch_runs WHERE created_at >= date('now','-13 days') GROUP BY day ORDER BY day`);
  const byAgent = q.all(`SELECT agent, COUNT(*) AS tasks, COALESCE(SUM(tokens_in+tokens_out),0) AS tokens, SUM(CASE WHEN status='failed' THEN 1 ELSE 0 END) AS failed FROM orch_tasks WHERE kind = 'agent' GROUP BY agent ORDER BY tokens DESC`);
  return { counts: { running: c('running'), queued: c('queued'), awaiting: c('awaiting_approval'), succeeded: c('succeeded'), failed: c('failed'), cancelled: c('cancelled'), total: q.get('SELECT COUNT(*) AS n FROM orch_runs').n }, month, byDay, byAgent, pending: pendingApprovals().length, ready: llmReady(), concurrency: settings().concurrency, daily };
};
export const analytics = ({ days = 30 } = {}) => {
  const d = Math.min(Math.max(Number(days) || 30, 1), 365);
  return {
    byDay: q.all(`SELECT date(created_at) AS day, COUNT(*) AS tasks, COALESCE(SUM(tokens_in+tokens_out),0) AS tokens, COALESCE(SUM(cost_est),0) AS cost FROM orch_tasks WHERE created_at >= date('now', ?) GROUP BY day ORDER BY day`, `-${d - 1} days`),
    byAgent: q.all(`SELECT agent, COUNT(*) AS tasks, COALESCE(SUM(tokens_in),0) AS tokens_in, COALESCE(SUM(tokens_out),0) AS tokens_out, COALESCE(SUM(cost_est),0) AS cost, SUM(CASE WHEN status='failed' THEN 1 ELSE 0 END) AS failed, SUM(CASE WHEN attempts>1 THEN 1 ELSE 0 END) AS retried FROM orch_tasks WHERE kind='agent' AND created_at >= date('now', ?) GROUP BY agent ORDER BY tokens_in+tokens_out DESC`, `-${d - 1} days`),
    runs: q.all(`SELECT status, COUNT(*) AS n FROM orch_runs WHERE created_at >= date('now', ?) GROUP BY status`, `-${d - 1} days`),
  };
};
export const eventsList = ({ level = '', runId = '', limit = 100 } = {}) => {
  const where = [], args = [];
  if (['info', 'warn', 'error'].includes(level)) { where.push('level = ?'); args.push(level); }
  if (runId) { where.push('run_id = ?'); args.push(Number(runId)); }
  return q.all(`SELECT * FROM orch_events ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY id DESC LIMIT ?`, ...args, Math.min(Number(limit) || 100, 500));
};

/* ------------------------------ başlatma ------------------------------ */
let timer = null;
export const initOrchestra = () => {
  setExecutable([...Object.keys(RUNNERS), 'master']);
  seedAgents();
  seedWorkflows();
  void isExecutable;
};
/** Sunucu açılışı: yarım kalan (running) görevler kuyruğa döner; zamanlayıcı başlar. */
export const startOrchestra = () => {
  initOrchestra();
  q.run(`UPDATE orch_tasks SET status = 'queued' WHERE status = 'running'`);
  if (timer) return;
  timer = setInterval(() => tick().catch(() => {}), 2000);
  timer.unref();
  setImmediate(() => tick().catch(() => {}));
};
export const stopOrchestra = () => { if (timer) clearInterval(timer); timer = null; };
void crypto;

export const agentHistory = (key, n = 15) => q.all(`SELECT t.id, t.run_id, r.title AS run_title, t.title, t.status, t.attempts, t.tokens_in + t.tokens_out AS tokens, t.model, t.error, t.started_at, t.finished_at FROM orch_tasks t JOIN orch_runs r ON r.id = t.run_id WHERE t.agent = ? AND t.kind = 'agent' ORDER BY t.id DESC LIMIT ?`, key, Math.min(Number(n) || 15, 50));

/** Bir müşteri talebi için yerleşik "Sales → CRM → Onay → Fırsat kaydı" akışını başlatır */
export const createFormRun = ({ formId, idempotencyKey }, user) => {
  const f = q.get('SELECT id, kind FROM forms WHERE id = ?', Number(formId));
  if (!f) throw new HttpError(404, 'Talep bulunamadı');
  if (f.kind === 'firsat') throw new HttpError(409, 'Bu kayıt bir fırsat önerisi; müşteri talebi seçin');
  const w = q.get('SELECT * FROM orch_workflows WHERE name = ?', CRM_WORKFLOW.name);
  if (!w) throw new HttpError(500, 'Yerleşik iş akışı bulunamadı');
  return createRun({ title: `Talep #${f.id} analizi`, steps: p(w.steps, []), workflowId: w.id, params: { formId: String(f.id) }, idempotencyKey }, user);
};
