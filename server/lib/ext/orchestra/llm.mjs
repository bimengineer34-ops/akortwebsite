// AI Orchestra LLM katmanı: mevcut sağlayıcı adaptörleri (ai.mjs) üzerinden; anahtarlar yalnızca kasada, buradan geçmez.
// Test/geliştirme: ORCH_FAKE_LLM=1 (yalnızca NODE_ENV!=production) veya setLlmOverride() ile deterministik sahte yanıt — canlıda ASLA kullanılmaz.
import { getSetting } from '../../db.mjs';
import { HttpError } from '../../http.mjs';
import { providerStatus, rawChat, getCfg } from '../ai.mjs';
import { fakeRespond } from './fake.mjs';
import { extractJson, redact } from './safety.mjs';

let override = null;
/** Testler için: (agentKey, system, prompt) => string | Promise<string> */
export const setLlmOverride = (fn) => { override = fn; };

export const fakeEnabled = () => process.env.ORCH_FAKE_LLM === '1' && process.env.NODE_ENV !== 'production';

/** Kullanılacak sağlayıcı: ajan ayarı → Orchestra varsayılanı → bağlı ilk sağlayıcı */
export const resolveProvider = (agent) => {
  const connected = providerStatus().filter((p) => p.connected).map((p) => p.id);
  const want = agent?.provider || getSetting('orch.provider', '');
  if (want && connected.includes(want)) return want;
  return connected[0] ?? null;
};

export const llmReady = () => fakeEnabled() || !!override || providerStatus().some((p) => p.connected);

const estimate = (s) => Math.ceil(String(s ?? '').length / 4);

/**
 * Ajan çağrısı. Dönüş: { text, inTok, outTok, model, provider, costUsd }
 * Hata: sağlayıcı yoksa 409 (yeniden denenmez), bütçe doluysa 429 (yeniden denenmez).
 */
export const chat = async ({ agent, key, system, prompt, max }) => {
  if (override || fakeEnabled()) {
    const text = override ? await override(key, system, prompt) : fakeRespond(key, prompt);
    return { text, inTok: estimate(system) + estimate(prompt), outTok: estimate(text), model: 'test-llm', provider: 'test', costUsd: 0 };
  }
  const provider = resolveProvider(agent);
  if (!provider) throw new HttpError(409, 'Yapay zekâ sağlayıcısı bağlı değil: Entegrasyonlar sayfasından bir API anahtarı ekleyin.');
  const r = await rawChat({ provider, system, prompt, max: max ?? agent?.max_tokens ?? 2000, task: `orkestra:${key}`, model: agent?.model || undefined }, { email: 'orkestra' });
  const cfg = getCfg(provider);
  const usedModel = agent?.model || cfg.model;
  const costUsd = cfg.priceInPerM != null && cfg.priceOutPerM != null ? ((r.inTok ?? 0) * cfg.priceInPerM + (r.outTok ?? 0) * cfg.priceOutPerM) / 1e6 : null;
  return { text: r.text, inTok: r.inTok || estimate(system) + estimate(prompt), outTok: r.outTok || estimate(r.text), model: usedModel, provider, costUsd };
};

/** JSON üreten çağrı: yanıt ayrıştırılır; hata mesajı gizli bilgi içermez */
export const chatJson = async (opts) => {
  const r = await chat(opts);
  let json;
  try { json = extractJson(r.text); } catch (e) { throw Object.assign(new Error(`Model geçerli JSON döndürmedi: ${redact(e.message)}`), { usage: r }); }
  return { json, usage: r };
};
