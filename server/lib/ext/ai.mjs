// Yapay Zekâ İçerik Stüdyosu — OpenAI / Anthropic / Gemini sağlayıcı adaptörleri (yalnızca sunucu tarafı, anahtarlar kasada)
import { q, audit, getSetting, setSetting } from '../db.mjs';
import { HttpError } from '../http.mjs';
import { getSecret, hasSecret, secretMeta } from './vault.mjs';

const TIMEOUT = 60_000;

export const PROVIDERS = {
  openai: { label: 'OpenAI', secret: 'ai.openai', defaultModel: 'gpt-4o-mini', docs: 'https://platform.openai.com/api-keys' },
  anthropic: { label: 'Anthropic (Claude)', secret: 'ai.anthropic', defaultModel: 'claude-sonnet-4-5', docs: 'https://console.anthropic.com/settings/keys' },
  gemini: { label: 'Google Gemini', secret: 'ai.gemini', defaultModel: 'gemini-3.5-flash', docs: 'https://aistudio.google.com/apikey' },
};

const need = (p) => {
  const meta = PROVIDERS[p];
  if (!meta) throw new HttpError(400, 'Bilinmeyen sağlayıcı');
  const key = getSecret(meta.secret);
  if (!key) throw new HttpError(409, `${meta.label} için bağlantı gerekli: Entegrasyonlar sayfasından API anahtarı ekleyin.`);
  return { meta, key };
};

/* ---------- devre kesici (3 ardışık hata → 60 sn kapalı) ---------- */
const breaker = new Map();
const checkBreaker = (p) => {
  const b = breaker.get(p);
  if (b && b.until > Date.now()) throw new HttpError(503, `${PROVIDERS[p].label} geçici olarak devre dışı (ardışık hatalar). ${Math.ceil((b.until - Date.now()) / 1000)} sn sonra yeniden deneyin.`);
};
const noteResult = (p, ok) => {
  const b = breaker.get(p) ?? { fails: 0, until: 0 };
  if (ok) breaker.set(p, { fails: 0, until: 0 });
  else {
    b.fails += 1;
    if (b.fails >= 3) b.until = Date.now() + 60_000;
    breaker.set(p, b);
  }
};

const call = async (p, url, init) => {
  let last;
  for (let i = 0; i < 2; i++) {
    try {
      const { timeoutMs, ...fetchInit } = init ?? {};
      const res = await fetch(url, { ...fetchInit, signal: AbortSignal.timeout(timeoutMs ?? TIMEOUT) });
      const text = await res.text();
      let data = null;
      try { data = JSON.parse(text); } catch { /* json değil */ }
      if (res.ok) return data;
      const msg = data?.error?.message ?? data?.error ?? data?.message ?? text.slice(0, 200);
      last = new HttpError(res.status === 401 || res.status === 403 ? 401 : res.status === 429 ? 429 : 502, `${PROVIDERS[p].label}: ${typeof msg === 'string' ? msg : JSON.stringify(msg)}`.slice(0, 300));
      if (res.status < 500 && res.status !== 429) break; // yeniden denemeye değmez
    } catch (e) {
      last = new HttpError(502, `${PROVIDERS[p].label} erişilemedi: ${e.name === 'TimeoutError' ? 'zaman aşımı' : e.message}`.slice(0, 300));
    }
    await new Promise((r) => setTimeout(r, 800 * (i + 1)));
  }
  throw last;
};

/* ---------- sağlayıcı çağrıları ---------- */
const adapters = {
  openai: {
    models: async (key) => (await call('openai', 'https://api.openai.com/v1/models', { headers: { Authorization: `Bearer ${key}` } })).data.map((m) => m.id).filter((id) => /^(gpt|o\d|chatgpt)/.test(id)).sort(),
    chat: async (key, model, system, user, maxTokens) => {
      const d = await call('openai', 'https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, messages: [{ role: 'system', content: system }, { role: 'user', content: user }], max_completion_tokens: maxTokens }),
      });
      return { text: d.choices?.[0]?.message?.content ?? '', inTok: d.usage?.prompt_tokens, outTok: d.usage?.completion_tokens };
    },
  },
  anthropic: {
    models: async (key) => (await call('anthropic', 'https://api.anthropic.com/v1/models?limit=100', { headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01' } })).data.map((m) => m.id),
    chat: async (key, model, system, user, maxTokens) => {
      const d = await call('anthropic', 'https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, max_tokens: maxTokens, system, messages: [{ role: 'user', content: user }] }),
      });
      return { text: (d.content ?? []).filter((c) => c.type === 'text').map((c) => c.text).join('\n'), inTok: d.usage?.input_tokens, outTok: d.usage?.output_tokens };
    },
  },
  gemini: {
    models: async (key) =>
      (await call('gemini', 'https://generativelanguage.googleapis.com/v1beta/models?pageSize=100', { headers: { 'x-goog-api-key': key } })).models
        .filter((m) => (m.supportedGenerationMethods ?? []).includes('generateContent'))
        .map((m) => m.name.replace(/^models\//, '')),
    chat: async (key, model, system, user, maxTokens, json = false) => {
      const gen = (m) => call('gemini', `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(m)}:generateContent`, {
        method: 'POST',
        headers: { 'x-goog-api-key': key, 'Content-Type': 'application/json' },
        body: JSON.stringify({ systemInstruction: { parts: [{ text: system }] }, contents: [{ role: 'user', parts: [{ text: user }] }], generationConfig: { maxOutputTokens: maxTokens + 2048, ...(json ? { responseMimeType: 'application/json' } : {}) } }), // +2048: Gemini 3 "düşünme" belirteçleri çıktı sınırından yer alır, JSON kesilmesin
      });
      let d;
      try { d = await gen(model); } catch (e) { // seçili model kaldırılmış/yeni hesaba kapalıysa listedeki en yeni "gemini-X-flash" modeline düş
        if (!/no longer available|not found|is not supported|404/i.test(e.message)) throw e;
        const ver = (n) => Number(/^gemini-(\d+(?:\.\d+)?)-flash$/.exec(n)?.[1] ?? -1);
        const alt = (await adapters.gemini.models(key)).filter((n) => ver(n) > 0 && n !== model).sort((x, y) => (y === 'gemini-3.5-flash') - (x === 'gemini-3.5-flash') || ver(y) - ver(x))[0]; // doğrulanmış 3.5 önce (en yeni sürüm önizlemede yanıt vermeyebilir)
        if (!alt) throw e;
        d = await gen(alt);
      }
      return { text: (d.candidates?.[0]?.content?.parts ?? []).map((p) => p.text ?? '').join(''), inTok: d.usageMetadata?.promptTokenCount, outTok: (d.usageMetadata?.candidatesTokenCount ?? 0) + (d.usageMetadata?.thoughtsTokenCount ?? 0) };
    },
  },
};

/* ---------- ayarlar: model, bütçe, fiyat ---------- */
const cfgKey = (p) => `ai.cfg.${p}`;
export const getCfg = (p) => {
  try { return { model: PROVIDERS[p].defaultModel, monthlyTokenBudget: 0, priceInPerM: null, priceOutPerM: null, ...JSON.parse(getSetting(cfgKey(p), '{}')) }; } catch { return { model: PROVIDERS[p].defaultModel, monthlyTokenBudget: 0, priceInPerM: null, priceOutPerM: null }; }
};
export const setCfg = (p, patch, user) => {
  if (!PROVIDERS[p]) throw new HttpError(400, 'Bilinmeyen sağlayıcı');
  const cur = getCfg(p);
  const next = { ...cur };
  if (typeof patch.model === 'string' && /^[\w.:/-]{2,80}$/.test(patch.model)) next.model = patch.model;
  for (const k of ['monthlyTokenBudget', 'priceInPerM', 'priceOutPerM']) {
    if (patch[k] === null || patch[k] === '') next[k] = k === 'monthlyTokenBudget' ? 0 : null;
    else if (patch[k] !== undefined) {
      const n = Number(patch[k]);
      if (!Number.isFinite(n) || n < 0) throw new HttpError(400, `${k}: geçersiz sayı`);
      next[k] = n;
    }
  }
  setSetting(cfgKey(p), JSON.stringify(next));
  audit(user, 'ai.ayar', p, `model=${next.model}`);
  return next;
};

export const monthUsage = (p) => q.get(`SELECT COALESCE(SUM(input_tokens),0) AS i, COALESCE(SUM(output_tokens),0) AS o, COUNT(*) AS n FROM ai_usage WHERE provider = ? AND ok = 1 AND ts >= date('now','start of month')`, p);

export const providerStatus = () =>
  Object.entries(PROVIDERS).map(([id, m]) => {
    const cfg = getCfg(id);
    const u = monthUsage(id);
    const cost = cfg.priceInPerM != null && cfg.priceOutPerM != null ? (u.i * cfg.priceInPerM + u.o * cfg.priceOutPerM) / 1e6 : null;
    return { id, label: m.label, docs: m.docs, connected: hasSecret(m.secret), secret: secretMeta(m.secret), cfg, month: { calls: u.n, inputTokens: u.i, outputTokens: u.o, costUsd: cost }, breakerOpen: (breaker.get(id)?.until ?? 0) > Date.now() };
  });

export const listModels = async (p) => {
  const { key } = need(p);
  checkBreaker(p);
  try {
    const m = await adapters[p].models(key);
    noteResult(p, true);
    return m;
  } catch (e) {
    noteResult(p, false);
    throw e;
  }
};

/** Bağlantı testi: model listesini çeker (ücretsiz uç nokta) */
export const testProvider = async (p, user) => {
  const models = await listModels(p);
  audit(user, 'ai.baglanti_testi', p, `${models.length} model`);
  return { ok: true, modelCount: models.length, models: models.slice(0, 200) };
};

/* ---------- görevler ---------- */
const BRAND = `Sen AKORT Mühendislik'in (MEP, BIM, enerji verimliliği, maliyet ve yazılım danışmanlığı) kurumsal metin editörüsün. Ton: sade, güvenilir, mühendislik odaklı, abartısız. Dil: Türkçe.
KESİN KURALLAR: Doğrulanamayan rakam, referans, müşteri adı, sertifika veya mevzuat maddesi UYDURMA. Teknik/mevzuat iddiası yazarsan yanına [KAYNAK GEREKLİ] ekle. Reklam abartısı ("en iyi", "garantili") kullanma. Çıktı düz metin olsun (HTML üretme).`;

export const TASKS = {
  taslak: { label: 'Sıfırdan taslak yaz', sys: 'Verilen konuda, başlık + kısa giriş + ara başlıklı bölümler içeren Markdown blog/hizmet taslağı yaz.', max: 1800 },
  'yeniden-yaz': { label: 'Seçili metni yeniden yaz', sys: 'Verilen metni anlamı koruyarak daha akıcı ve profesyonel yeniden yaz. Yalnızca yeni metni döndür.', max: 1200 },
  kisalt: { label: 'Kısalt', sys: 'Verilen metni önemli bilgiyi kaybetmeden yaklaşık yarısına kısalt. Yalnızca yeni metni döndür.', max: 800 },
  genislet: { label: 'Genişlet', sys: 'Verilen metni, yeni olgu eklemeden, açıklayıcı cümlelerle genişlet. Yalnızca yeni metni döndür.', max: 1500 },
  cevir: { label: 'İngilizceye çevir', sys: 'Verilen Türkçe metni teknik terimleri koruyarak profesyonel İngilizceye çevir. Yalnızca çeviriyi döndür.', max: 1500 },
  'meta-oneri': { label: 'Başlık/meta önerileri', sys: 'Verilen içerik için 3 farklı SEO başlığı (en çok 60 karakter) ve 3 meta açıklaması (120-160 karakter) öner. Şu biçimde numaralı liste ver: "BAŞLIK 1: …" ve "AÇIKLAMA 1: …".', max: 700 },
  'prompt-iyilestir': { label: 'Prompt iyileştir', sys: 'Kullanıcının yazı üretimi için yazdığı istemi (prompt) daha net, ölçülebilir ve uygulanabilir hale getir: hedef kitle, ton, uzunluk ve biçimi belirt, ama yeni olgu/rakam ekleme. Yalnızca iyileştirilmiş istemi döndür.', max: 400 },
  'seo-analiz': { label: 'SEO uyum yorumu', sys: 'Verilen içeriği odak sorgusuna göre değerlendir: güçlü yönler, eksikler ve 5 somut iyileştirme önerisi ver. Bu bir tahmindir, Google puanı değildir.', max: 900 },
};

export const generate = async ({ provider, task, text, focus = '', tone = '', userNote = '' }, user) => {
  const t = TASKS[task];
  if (!t) throw new HttpError(400, 'Bilinmeyen görev');
  text = String(text ?? '').trim();
  if (!text) throw new HttpError(400, 'Metin veya konu boş');
  if (text.length > 24_000) throw new HttpError(413, 'Metin çok uzun (en çok 24.000 karakter)');
  const { key } = need(provider);
  const cfg = getCfg(provider);
  if (cfg.monthlyTokenBudget > 0) {
    const u = monthUsage(provider);
    if (u.i + u.o >= cfg.monthlyTokenBudget) throw new HttpError(429, `${PROVIDERS[provider].label} aylık belirteç bütçesi doldu (${cfg.monthlyTokenBudget}). Bütçeyi Entegrasyonlar sayfasından güncelleyin.`);
  }
  checkBreaker(provider);
  const system = `${BRAND}\n\nGÖREV: ${t.sys}${tone ? `\nEk ton notu: ${tone.slice(0, 200)}` : ''}`;
  const prompt = `${focus ? `Odak sorgu: ${String(focus).slice(0, 120)}\n` : ''}${userNote ? `Not: ${String(userNote).slice(0, 300)}\n` : ''}\n---\n${text}`;
  const t0 = Date.now();
  try {
    const r = await adapters[provider].chat(key, cfg.model, system, prompt, t.max);
    noteResult(provider, true);
    const cost = cfg.priceInPerM != null && cfg.priceOutPerM != null ? ((r.inTok ?? 0) * cfg.priceInPerM + (r.outTok ?? 0) * cfg.priceOutPerM) / 1e6 : null;
    q.run('INSERT INTO ai_usage (provider, model, task, input_tokens, output_tokens, cost_est, ok, user_email, ms) VALUES (?,?,?,?,?,?,1,?,?)', provider, cfg.model, task, r.inTok ?? null, r.outTok ?? null, cost, user.email, Date.now() - t0);
    const out = String(r.text ?? '').slice(0, 30_000);
    const run = q.run('INSERT INTO ai_runs (provider, model, task, prompt, output, user_email) VALUES (?,?,?,?,?,?)', provider, cfg.model, task, text.slice(0, 4000), out, user.email);
    return { id: Number(run.lastInsertRowid), provider, model: cfg.model, task, output: out, usage: { input: r.inTok ?? null, output: r.outTok ?? null, costUsd: cost }, unverifiedClaims: /\[KAYNAK GEREKLİ\]/.test(out) };
  } catch (e) {
    noteResult(provider, false);
    q.run('INSERT INTO ai_usage (provider, model, task, ok, error, user_email, ms) VALUES (?,?,?,0,?,?,?)', provider, cfg.model, task, String(e.message).slice(0, 300), user.email, Date.now() - t0);
    throw e;
  }
};

export const markRun = (id, status, user) => {
  if (!['kabul', 'red'].includes(status)) throw new HttpError(400, 'Geçersiz durum');
  q.run('UPDATE ai_runs SET status = ? WHERE id = ?', status, id);
  audit(user, `ai.${status}`, String(id));
};
export const recentRuns = () => q.all('SELECT id, ts, provider, model, task, status, user_email, substr(output,1,160) AS preview FROM ai_runs ORDER BY id DESC LIMIT 30');
export const recentUsage = () => q.all('SELECT ts, provider, model, task, input_tokens, output_tokens, cost_est, ok, error, user_email, ms FROM ai_usage ORDER BY id DESC LIMIT 30');

/** Toplu/sistem görevleri için ham çağrı (bütçe, devre kesici ve kullanım kaydı dahil). Metin güvenilmez kabul edilir; çağıran doğrular. */
export const rawChat = async ({ provider, system, prompt, max = 2000, task = 'sistem', model, json = false }, user = { email: 'sistem' }) => {
  const { key } = need(provider);
  const cfg = { ...getCfg(provider), ...(model && /^[\w.:/-]{2,80}$/.test(model) ? { model } : {}) }; // model: çağrı başına geçersiz kılma (Yapay Zekâ Orkestrası ajanları)
  if (cfg.monthlyTokenBudget > 0) {
    const u = monthUsage(provider);
    if (u.i + u.o >= cfg.monthlyTokenBudget) throw new HttpError(429, `${PROVIDERS[provider].label} aylık belirteç bütçesi doldu (${cfg.monthlyTokenBudget}).`);
  }
  checkBreaker(provider);
  const t0 = Date.now();
  try {
    const r = await adapters[provider].chat(key, cfg.model, system, prompt, max, json);
    noteResult(provider, true);
    q.run('INSERT INTO ai_usage (provider, model, task, input_tokens, output_tokens, ok, user_email, ms) VALUES (?,?,?,?,?,1,?,?)', provider, cfg.model, task, r.inTok ?? null, r.outTok ?? null, user.email, Date.now() - t0);
    return { text: String(r.text ?? ''), model: cfg.model, inTok: r.inTok ?? 0, outTok: r.outTok ?? 0 };
  } catch (e) {
    noteResult(provider, false);
    q.run('INSERT INTO ai_usage (provider, model, task, ok, error, user_email, ms) VALUES (?,?,?,0,?,?,?)', provider, cfg.model, task, String(e.message).slice(0, 300), user.email, Date.now() - t0);
    throw e;
  }
};

/* ---------- görsel üretimi (marka kuralları korumalı) ---------- */
const IMG_GUARD = 'Kurumsal mühendislik danışmanlığı (AKORT) için görsel. Kurallar: görselde HİÇBİR yazı, rakam, logo, marka adı, sertifika veya sahte belge olmasın; gerçek kişi yüzü veya tanınabilir kişi olmasın; gerçek bir projeyi/müşteriyi iddia eden sahne olmasın; sade, profesyonel, lacivert-mavi-beyaz ağırlıklı renkler, temiz kompozisyon, metin için boş alan bırak.';
export const IMAGE_ASPECTS = { kare: { gemini: '1:1', openai: '1024x1024', label: 'Kare (1:1)' }, yatay: { gemini: '16:9', openai: '1536x1024', label: 'Yatay (16:9)' }, dikey: { gemini: '9:16', openai: '1024x1536', label: 'Dikey (9:16)' }, portre: { gemini: '4:5', openai: '1024x1536', label: 'Portre (4:5)' } };
export const IMAGE_STYLES = {
  mimari: 'Minimal mimari çizim / teknik illüstrasyon stili, ince çizgiler, açık zemin.',
  izometrik: 'İzometrik 3B teknik illüstrasyon, temiz geometri, yumuşak gölgeler.',
  soyut: 'Soyut geometrik arka plan, mavi tonlarda gradyanlar ve çizgiler.',
  foto: 'Fotogerçekçi mimari/şantiye atmosferi; yalnızca genel sahne (belirli bir proje değil), insansız.',
};
const sniffImage = (buf) => (buf.length > 8 && buf[0] === 0x89 && buf[1] === 0x50 ? 'image/png' : buf[0] === 0xff && buf[1] === 0xd8 ? 'image/jpeg' : buf.length > 12 && buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP' ? 'image/webp' : null);
let geminiImageModel = null;
const pickGeminiImageModel = async (key) => {
  const cfgModel = getSetting('ai.imageModel.gemini');
  if (cfgModel) return cfgModel;
  if (geminiImageModel) return geminiImageModel;
  const names = await adapters.gemini.models(key);
  const img = names.filter((n) => /image/i.test(n) && !/tts|preview/i.test(n));
  geminiImageModel = ['gemini-3.1-flash-image', 'gemini-2.5-flash-image'].find((n) => img.includes(n)) ?? img[0] ?? 'gemini-2.5-flash-image';
  return geminiImageModel;
};

/** Görsel üretebilen ve anahtarı bağlı sağlayıcı (tercih edilen varsa o); yoksa null */
export const imageProvider = (preferred = '') => { const ok = ['gemini', 'openai'].filter((p) => hasSecret(PROVIDERS[p].secret)); return ok.includes(preferred) ? preferred : ok[0] ?? null; };

/** Prompt'tan görsel üretir (Gemini veya OpenAI). Dönen görsel kitaplığa KAYDEDİLMEZ; çağıran kaydeder. Anthropic görsel üretmez. */
export const generateImage = async ({ provider, prompt, aspect = 'kare', style = 'mimari' }, user) => {
  if (!['gemini', 'openai'].includes(provider)) throw new HttpError(400, 'Görsel üretimi yalnızca Gemini veya OpenYapay Zekâ ile yapılır');
  const subject = String(prompt ?? '').trim().slice(0, 600);
  if (subject.length < 8) throw new HttpError(400, 'Görseli kısaca tarif edin (en az 8 karakter)');
  const asp = IMAGE_ASPECTS[aspect] ?? IMAGE_ASPECTS.kare;
  const full = `${subject}\n\nStil: ${IMAGE_STYLES[style] ?? IMAGE_STYLES.mimari}\n${IMG_GUARD}`;
  const { key } = need(provider);
  checkBreaker(provider);
  const t0 = Date.now();
  let model = provider === 'openai' ? 'gpt-image-1' : null;
  try {
    let b64;
    if (provider === 'gemini') {
      model = await pickGeminiImageModel(key);
      const d = await call('gemini', `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
        method: 'POST', timeoutMs: 120_000,
        headers: { 'x-goog-api-key': key, 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: full }] }], generationConfig: { responseModalities: ['IMAGE'], imageConfig: { aspectRatio: asp.gemini } } }),
      });
      b64 = (d.candidates?.[0]?.content?.parts ?? []).find((p) => p.inlineData?.data)?.inlineData.data;
      if (!b64) throw new HttpError(502, 'Gemini görsel döndürmedi (içerik filtresi veya model desteği olabilir); tarifi değiştirip yeniden deneyin.');
    } else {
      const d = await call('openai', 'https://api.openai.com/v1/images/generations', {
        method: 'POST', timeoutMs: 120_000,
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, prompt: full, size: asp.openai, n: 1 }),
      });
      b64 = d.data?.[0]?.b64_json;
      if (!b64) throw new HttpError(502, 'OpenAI görsel döndürmedi; tarifi değiştirip yeniden deneyin.');
    }
    const buf = Buffer.from(b64, 'base64');
    const mime = sniffImage(buf);
    if (!mime) throw new HttpError(502, 'Sağlayıcı geçerli bir görsel döndürmedi');
    if (buf.length > 14 * 1024 * 1024) throw new HttpError(502, 'Üretilen görsel çok büyük');
    noteResult(provider, true);
    q.run('INSERT INTO ai_usage (provider, model, task, ok, user_email, ms) VALUES (?,?,?,1,?,?)', provider, model, 'gorsel', user.email, Date.now() - t0);
    audit(user, 'ai.gorsel_uret', `${provider}/${model}`);
    return { mime, data: buf.toString('base64'), model, provider, bytes: buf.length };
  } catch (e) {
    noteResult(provider, false);
    q.run('INSERT INTO ai_usage (provider, model, task, ok, error, user_email, ms) VALUES (?,?,?,0,?,?,?)', provider, model, 'gorsel', String(e.message).slice(0, 300), user.email, Date.now() - t0);
    throw e;
  }
};
