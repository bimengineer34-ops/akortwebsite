// AI Orchestra ajan çalıştırıcıları. Her çalıştırıcı: araçları (yetki listesine göre) çalıştırır → modeli çağırır → çıktıyı şemaya karşı doğrular
// → kaynak/iç bağlantı/iddia denetimlerini deterministik uygular. Model çıktısı HİÇBİR ZAMAN doğrudan güvenilmez.
import { config } from '../../config.mjs';
import { chatJson } from './llm.mjs';
import { SAFETY_RULES, untrustedBlock, validateSchema, sanitizeMarkdown, scanRiskyClaims } from './safety.mjs';
import { sourceItems, siteContext, blogCategories, competitorsInfo, statsInfo, seoCheck, siteSeoInfo, formInfo, brandKitInfo } from './tools.mjs';

export const slugify = (t) => String(t).toLocaleLowerCase('tr').replace(/ç/g, 'c').replace(/ğ/g, 'g').replace(/ı/g, 'i').replace(/ö/g, 'o').replace(/ş/g, 's').replace(/ü/g, 'u').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80).replace(/-+$/, '');

const has = (agent, tool) => (agent.tools ?? []).includes(tool);
const siteOrigin = () => String(config.siteUrl ?? '').replace(/\/$/, '');

/** Ortak çağrı: sistem talimatı + güvenlik kuralları + çıktı şeması; şema ihlali yeniden denenebilir hata verir */
const runLlm = async ({ agent, task, sections, ctxNote = '', schema = agent.output_schema }) => {
  const system = `${agent.system_prompt}\n\n${SAFETY_RULES}\n\nÇIKTI BİÇİMİ: yalnızca şu JSON şemasına uyan TEK bir JSON nesnesi döndür (başka metin yazma):\n${JSON.stringify(schema)}`;
  const retryHint = task?.attempts > 1 && task?.error ? `\n\n[Önceki denemede şu hata alındı, düzelt: ${String(task.error).slice(0, 400)}]` : '';
  const prompt = sections.filter((s) => s.text).map((s) => `## ${s.title}\n${s.text}`).join('\n\n') + ctxNote + retryHint;
  const { json, usage } = await chatJson({ agent, key: agent.key, system, prompt, max: agent.max_tokens });
  const errs = validateSchema(schema, json);
  if (errs.length) throw Object.assign(new Error(`Çıktı şemaya uymuyor: ${errs.slice(0, 4).join('; ')}`), { usage });
  return { output: json, usage };
};

const siteLines = (pages) => pages.map((p) => `- ${p.title} → ${p.url}`).join('\n');

/* ------------------------------ Research ------------------------------ */
const research = async ({ agent, task, input, log }) => {
  const topic = String(input.topic ?? '').trim();
  if (!topic) throw Object.assign(new Error('Konu (topic) boş'), { fatal: true });
  const src = has(agent, 'source_items') ? sourceItems(topic) : { items: [], blocked: [] };
  if (src.blocked.length) log('warn', 'enjeksiyon_suphesi', `${src.blocked.length} kaynak öğesi talimat enjeksiyonu şüphesiyle bağlama alınmadı`);
  const site = has(agent, 'site_content') ? siteContext(topic) : { pages: [] };
  const allowed = new Set(src.items.map((i) => i.url));
  const blocks = src.items.map((i, n) => untrustedBlock(`K${n + 1}`, `URL: ${i.url}\nBAŞLIK: ${i.title}\nKAYNAK: ${i.source}${i.date ? ` (${i.date})` : ''}\nÖZET: ${i.summary}`)).join('\n');
  const { output, usage } = await runLlm({
    agent, task,
    sections: [
      { title: 'KONU', text: topic },
      { title: `KAYNAKLAR (${src.items.length} adet; yalnızca bunlara atıf yapabilirsin)`, text: blocks || '(Pazar & Medya kaynaklarında bu konuyla eşleşen öğe yok — bunu "gaps" içinde belirt, kaynak uydurma.)' },
      { title: 'SİTEDE ZATEN VAR OLAN İLGİLİ SAYFALAR (tekrarlama, yeni açı bul)', text: siteLines(site.pages.slice(0, 15)) || '(yok)' },
    ],
  });
  // Atıf doğrulama: yalnızca verilen kaynak adresleri geçerlidir
  let stripped = 0;
  output.key_points = output.key_points.map((k) => {
    const urls = (k.source_urls ?? []).filter((u) => allowed.has(u));
    stripped += (k.source_urls ?? []).length - urls.length;
    return { point: k.point, source_urls: urls, confidence: urls.length ? 'kaynakli' : 'genel_bilgi' };
  });
  output.sources = (output.sources ?? []).filter((s) => allowed.has(s.url)).map((s) => ({ url: s.url, title: src.items.find((i) => i.url === s.url)?.title ?? s.title ?? '' }));
  for (const u of new Set(output.key_points.flatMap((k) => k.source_urls))) if (!output.sources.some((s) => s.url === u)) output.sources.push({ url: u, title: src.items.find((i) => i.url === u)?.title ?? '' });
  if (stripped) log('warn', 'atif_temizlendi', `${stripped} doğrulanamayan kaynak atfı çıktıdan kaldırıldı`);
  output.meta = { sourceCount: src.items.length, blockedSources: src.blocked.length, strippedCitations: stripped };
  return { output, usage };
};

/* ------------------------------ Content ------------------------------ */
const content = async ({ agent, task, input, deps, log }) => {
  const r = deps.research ?? Object.values(deps).find((d) => d?.key_points);
  const topic = String(input.topic ?? r?.brief ?? '').trim();
  if (!topic) throw Object.assign(new Error('Konu (topic) boş'), { fatal: true });
  const cats = blogCategories();
  const site = has(agent, 'site_content') ? siteContext(topic, 10) : { pages: [] };
  const ctx = r ? JSON.stringify({ brief: r.brief, angle: r.angle, key_points: r.key_points, outline: r.outline, gaps: r.gaps }, null, 1) : '(araştırma özeti yok — yalnızca genel mühendislik bilgisiyle, ihtiyatlı yaz)';
  const { output, usage } = await runLlm({
    agent, task,
    sections: [
      { title: 'KONU', text: topic },
      { title: 'ARAŞTIRMA ÖZETİ (güvenilir iç çıktı; kaynak adresleri bu özetteki sources alanındadır)', text: ctx },
      { title: `İZİN VERİLEN KATEGORİLER (category bunlardan biri olmalı)`, text: cats.join(' | ') },
      { title: 'SİTEDEKİ İLGİLİ SAYFALAR (içerik tekrarını önlemek için)', text: siteLines(site.pages) || '(yok)' },
    ],
  });
  const allowedUrls = new Set((r?.sources ?? []).map((s) => s.url));
  const before = output.body;
  output.body = sanitizeMarkdown(output.body, { allowedUrls, siteOrigin: siteOrigin() }).replace(/^#\s+/gm, '## ').trim();
  if (output.body !== before) log('info', 'govde_temizlendi', 'Gövdeden HTML/izinsiz bağlantı temizlendi');
  if (!cats.includes(output.category)) { log('warn', 'kategori_duzeltildi', `"${String(output.category).slice(0, 40)}" geçersiz kategori; "${cats[0]}" atandı`); output.category = cats[0]; }
  output.title = output.title.trim();
  output.description = output.description.trim().slice(0, 170);
  output.tags = [...new Set((output.tags ?? []).map((t) => String(t).trim()).filter(Boolean))].slice(0, 8);
  output.slug = slugify(output.title);
  output.risk_flags = scanRiskyClaims(`${output.title}\n${output.description}\n${output.body}`);
  output.sources = r?.sources ?? [];
  return { output, usage };
};

/* ------------------------------ SEO ------------------------------ */
/** Mevcut sayfaların SEO denetimi: deterministik tarama verisi + model önceliklendirmesi (uydurma sayfa/bağlantı temizlenir) */
const SITE_SEO_SCHEMA = { type: 'object', required: ['summary', 'priorities'], properties: {
  summary: { type: 'string', minLength: 20, maxLength: 900 },
  priorities: { type: 'array', minItems: 1, maxItems: 10, items: { type: 'object', required: ['page', 'issue', 'fix', 'impact'], properties: { page: { type: 'string' }, issue: { type: 'string', minLength: 5 }, fix: { type: 'string', minLength: 5 }, impact: { type: 'string', enum: ['yuksek', 'orta', 'dusuk'] } } } },
  quick_wins: { type: 'array', maxItems: 8, items: { type: 'string' } },
  internal_link_opportunities: { type: 'array', maxItems: 8, items: { type: 'object', required: ['from', 'to', 'anchor'], properties: { from: { type: 'string' }, to: { type: 'string' }, anchor: { type: 'string', maxLength: 80 } } } },
} };
const seoSite = async ({ agent, task, log }) => {
  if (!has(agent, 'site_seo')) throw Object.assign(new Error('Bu ajanın site_seo aracı yetkisi yok (Ajanlar › araç yetkileri)'), { fatal: true });
  const info = siteSeoInfo();
  const { output, usage } = await runLlm({
    agent, task, schema: SITE_SEO_SCHEMA,
    sections: [
      { title: 'TARAMA ÖZETİ (deterministik, güvenilir)', text: JSON.stringify({ sayfa: info.total, kritik: info.errors, onemli: info.warnings, iyilestirme: info.infos, ortalamaSkor: info.avgScore, yinelenenBasliklar: info.duplicateTitles, sitemapteOlmayan: info.notInSitemap }) },
      { title: 'EN DÜŞÜK PUANLI SAYFALAR', text: JSON.stringify(info.worstPages) },
      { title: 'KISA/EKSİK META AÇIKLAMALI İÇERİKLER', text: JSON.stringify(info.shortMeta) },
      { title: 'İÇ BAĞLANTISI OLMAYAN İÇERİKLER VE ÖNERİLEN HEDEFLER', text: JSON.stringify(info.noInternalLink) },
    ],
  });
  const before = output.priorities.length;
  output.priorities = output.priorities.filter((p) => info.urls.has(p.page));
  const links = (output.internal_link_opportunities ?? []).filter((l) => info.urls.has(l.from) && info.urls.has(l.to) && l.from !== l.to);
  const dropped = before - output.priorities.length + ((output.internal_link_opportunities ?? []).length - links.length);
  if (dropped) log('warn', 'site_seo_temizlendi', `${dropped} sitede bulunmayan sayfa/bağlantı önerisi çıktıdan atıldı`);
  if (!output.priorities.length) throw Object.assign(new Error('Model, taramadaki gerçek sayfalara dayanan öncelik üretemedi'), { usage });
  output.internal_link_opportunities = links;
  output.scan = { pages: info.total, errors: info.errors, warnings: info.warnings, infos: info.infos, avgScore: info.avgScore };
  output.mode = 'site';
  return { output, usage };
};

const seo = async ({ agent, task, input, deps, log }) => {
  const c = deps.content ?? Object.values(deps).find((d) => d?.body);
  if (!c && (input.scope === 'site' || input.mode === 'site')) return seoSite({ agent, task, log });
  if (!c) throw Object.assign(new Error('SEO ajanı için içerik (content) çıktısı gerekli (veya girdide scope=site)'), { fatal: true });
  const site = has(agent, 'site_content') ? siteContext(input.topic ?? c.title, 25) : { pages: [], urls: new Set() };
  const pre = has(agent, 'seo_check') ? seoCheck({ title: c.title, description: c.description, body: c.body, slug: c.slug, focus: input.focus ?? '' }) : { checks: [], score: null };
  const { output, usage } = await runLlm({
    agent, task,
    sections: [
      { title: 'TASLAK', text: JSON.stringify({ title: c.title, description: c.description, slug: c.slug, tags: c.tags, category: c.category, words: c.body.split(/\s+/).length }) },
      { title: 'TASLAK GÖVDE (ilk bölüm)', text: c.body.slice(0, 2500) },
      { title: 'DETERMİNİSTİK KONTROL SONUCU (başarısız olanları düzeltmeye çalış)', text: pre.checks.map((x) => `${x.ok ? 'OK ' : 'EKSİK'}: ${x.note}`).join('\n') || '(kapalı)' },
      { title: 'MEVCUT SİTE SAYFALARI (iç bağlantıyı YALNIZCA buradan seç)', text: siteLines(site.pages) || '(yok)' },
    ],
  });
  // İç bağlantılar: yalnızca sitede gerçekten var olan adresler
  const seen = new Set();
  const links = (output.internal_links ?? []).filter((l) => { const ok = site.urls.has(l.url) && !seen.has(l.url); if (ok) seen.add(l.url); return ok; }).slice(0, 5);
  if ((output.internal_links ?? []).length !== links.length) log('warn', 'baglanti_temizlendi', `${(output.internal_links ?? []).length - links.length} geçersiz/yinelenen iç bağlantı önerisi atıldı`);
  output.internal_links = links;
  output.slug = slugify(output.slug || c.slug) || c.slug;
  output.tags = [...new Set([...(output.tags ?? []), ...(c.tags ?? [])].map((t) => String(t).trim()).filter(Boolean))].slice(0, 8);
  output.description = output.description.trim().slice(0, 170);
  // Son gövde: iç bağlantılar deterministik olarak "İlgili sayfalar" bölümüne eklenir
  output.body = links.length ? `${c.body.replace(/\s+$/, '')}\n\n## İlgili Sayfalar\n\n${links.map((l) => `- [${l.anchor.replace(/[\[\]]/g, '')}](${l.url})`).join('\n')}\n` : c.body;
  const post = seoCheck({ title: output.title, description: output.description, body: output.body, slug: output.slug, focus: output.focus ?? input.focus ?? '' });
  output.checks = post.checks;
  output.score = post.score;
  return { output, usage };
};

/* ------------------------------ QA ------------------------------ */
const qa = async ({ agent, task, deps, log }) => {
  const c = deps.content ?? Object.values(deps).find((d) => d?.body);
  const s = deps.seo ?? Object.values(deps).find((d) => d?.internal_links);
  if (!c) throw Object.assign(new Error('QA ajanı için içerik gerekli'), { fatal: true });
  const draft = s ? { title: s.title, description: s.description, body: s.body } : { title: c.title, description: c.description, body: c.body };
  const scan = has(agent, 'risk_scan') ? scanRiskyClaims(`${draft.title}\n${draft.description}\n${draft.body}`) : [];
  const { output, usage } = await runLlm({
    agent, task,
    sections: [
      { title: 'DENETLENECEK TASLAK', text: `BAŞLIK: ${draft.title}\nMETA: ${draft.description}\n\n${draft.body.slice(0, 7000)}` },
      { title: 'OTOMATİK RİSK TARAMASI', text: scan.length ? scan.map((x) => `- ${x}`).join('\n') : '(otomatik taramada bulgu yok)' },
      { title: 'SEO ÖZETİ', text: s ? `skor ${s.score}; eksik kontroller: ${(s.checks ?? []).filter((x) => !x.ok).map((x) => x.note).join(' | ') || 'yok'}` : '(SEO çıktısı yok)' },
      { title: 'İÇERİK AJANININ KAYNAK İSTEYEN İDDİALARI', text: (c.claims_needing_source ?? []).map((x) => `- ${x}`).join('\n') || '(yok)' },
    ],
  });
  // Deterministik bulgular modelden bağımsız eklenir; kritik bulgu varsa geçmedi sayılır
  const issues = [...output.issues];
  for (const why of scan) issues.push({ severity: /sertifika|referans|müşteri|deneyim|proje/i.test(why) ? 'kritik' : 'uyari', text: `Otomatik tarama: ${why}` });
  for (const cl of c.claims_needing_source ?? []) issues.push({ severity: 'uyari', text: `Kaynak gerekli iddia: ${String(cl).slice(0, 200)}` });
  const blocking = issues.filter((i) => i.severity === 'kritik').length;
  output.issues = issues;
  output.blocking_count = blocking;
  output.passed = blocking === 0 && output.passed !== false;
  if (!output.passed) log('warn', 'qa_gecmedi', `${blocking} kritik bulgu — insan onayında uyarı gösterilecek`);
  return { output, usage };
};

/* ------------------------------ diğer ajanlar (yalnızca verilen veriyle çalışır) ------------------------------ */
const competitor = async ({ agent, task, input }) => {
  const topic = String(input.topic ?? '');
  const comps = has(agent, 'competitors') ? competitorsInfo() : [];
  const src = has(agent, 'source_items') ? sourceItems(topic || 'rakip', 8) : { items: [] };
  const allowed = new Set([...src.items.map((i) => i.url), ...comps.map((c) => c.url)]);
  const { output, usage } = await runLlm({
    agent, task,
    sections: [
      { title: 'KONU', text: topic || '(genel)' },
      { title: 'İZLENEN RAKİP KAYITLARI (bizim tarama kayıtlarımız)', text: JSON.stringify(comps) },
      { title: 'KAYNAKLAR', text: src.items.map((i, n) => untrustedBlock(`K${n + 1}`, `URL: ${i.url}\nBAŞLIK: ${i.title}\nÖZET: ${i.summary}`)).join('\n') || '(yok)' },
    ],
  });
  output.findings = output.findings.map((f) => ({ ...f, source_url: allowed.has(f.source_url) ? f.source_url : '' }));
  return { output, usage };
};

const mep = async ({ agent, task, input, deps }) => {
  const c = deps.seo ?? deps.content ?? Object.values(deps).find((d) => d?.body);
  const text = c?.body ?? String(input.text ?? input.topic ?? '');
  if (!text.trim()) throw Object.assign(new Error('İncelenecek metin yok'), { fatal: true });
  return runLlm({ agent, task, sections: [{ title: 'İNCELENECEK METİN', text: text.slice(0, 8000) }] });
};

const analytics = async ({ agent, task }) => {
  const stats = has(agent, 'stats') ? statsInfo() : {};
  return runLlm({ agent, task, sections: [{ title: 'SAYAÇLAR (yalnızca bunları kullan; kişi bazlı veri yoktur)', text: JSON.stringify(stats, null, 1) }] });
};

const social = async ({ agent, task, input, deps }) => {
  const c = deps.seo ?? deps.content ?? Object.values(deps).find((d) => d?.body);
  const topic = String(input.topic ?? c?.title ?? '').trim();
  if (!topic) throw Object.assign(new Error('Konu boş'), { fatal: true });
  const { output, usage } = await runLlm({ agent, task, sections: [{ title: 'KONU', text: topic }, { title: 'İÇERİK ÖZETİ', text: c ? `${c.title}\n${c.description}\n${c.body.slice(0, 1800)}` : '(yok)' }] });
  const LIM = { linkedin: 1200, x: 270 };
  for (const p of output.posts) {
    const full = `${p.text}${p.hashtags?.length ? `\n${p.hashtags.join(' ')}` : ''}`;
    if (full.length > LIM[p.platform]) throw Object.assign(new Error(`${p.platform} gönderisi ${full.length}/${LIM[p.platform]} karakter sınırını aşıyor`), { usage });
    p.hashtags = (p.hashtags ?? []).map((t) => `#${String(t).replace(/^#+/, '').replace(/[^\p{L}\p{N}_]/gu, '')}`).filter((t) => t.length > 1).slice(0, 5);
  }
  return { output, usage };
};

/* ------------------------------ Visual Design (yalnızca kurgu; görsel Brand Kit ile deterministik üretilir) ------------------------------ */
const design = async ({ agent, task, input, deps, log }) => {
  if (!has(agent, 'brand_kit')) throw Object.assign(new Error('Bu ajanın brand_kit aracı yetkisi yok'), { fatal: true });
  const kit = brandKitInfo();
  const c = deps.seo ?? deps.content ?? deps.social ?? Object.values(deps)[0];
  const topic = String(input.topic ?? c?.title ?? '').trim();
  if (!topic) throw Object.assign(new Error('Konu boş'), { fatal: true });
  const { output, usage } = await runLlm({
    agent, task,
    sections: [
      { title: 'KONU', text: topic },
      { title: 'İÇERİK ÖZETİ', text: c ? `${c.title ?? ''}\n${(c.description ?? c.body ?? '').toString().slice(0, 500)}` : '(yok)' },
      { title: 'SEÇENEKLER (yalnızca bunlardan seç)', text: `şablonlar: ${kit.templates.map((t) => `${t.key} (${t.note})`).join(' | ')}\ntemalar: ${kit.themes.map((t) => t.key).join(' | ')}\nbiçimler: ${kit.formats.map((f) => f.key).join(' | ')}` },
    ],
  });
  const fix = (v, list, def, what) => { if (list.includes(v)) return v; log('warn', 'tasarim_duzeltildi', `${what} "${String(v).slice(0, 30)}" geçersiz; "${def}" kullanıldı`); return def; };
  output.template = fix(output.template, kit.templates.map((t) => t.key), 'blog-paylasimi', 'şablon');
  output.theme = fix(output.theme, kit.themes.map((t) => t.key), 'marka', 'tema');
  output.format = fix(output.format, kit.formats.map((f) => f.key), 'link', 'biçim');
  output.title = output.title.replace(/<[^>]*>/g, '').trim().slice(0, 60);
  output.subtitle = String(output.subtitle ?? '').replace(/<[^>]*>/g, '').trim().slice(0, 140);
  output.alt = output.alt.replace(/<[^>]*>/g, '').trim().slice(0, 200);
  output.risk_flags = scanRiskyClaims(`${output.title} ${output.subtitle}`);
  return { output, usage };
};

/* ------------------------------ Sales (müşteri talebi analizi; kişisel veri modele gitmez; hiçbir şey göndermez) ------------------------------ */
const PRICE_RE = /(?:\d[\d.,]*\s*(?:TL|₺|USD|EUR|€|\$|lira|dolar|euro))|(?:%\s?\d+\s*indirim)|(?:indirim|ücretsiz\s+teklif|garanti(?:li)?|kesin(?:likle)?\s+(?:teslim|sonuç))/i;
const sales = async ({ agent, task, input, log }) => {
  if (!has(agent, 'forms')) throw Object.assign(new Error('Bu ajanın forms aracı yetkisi yok'), { fatal: true });
  const form = formInfo(input.formId);
  if (!form) throw Object.assign(new Error(`Talep #${input.formId} bulunamadı`), { fatal: true });
  if (form.kind === 'firsat') throw Object.assign(new Error('Bu kayıt zaten bir fırsat önerisi; müşteri talebi seçin'), { fatal: true });
  if (form.suspicious) log('warn', 'enjeksiyon_suphesi', `Talep #${form.id} metni talimat kalıbı içeriyor; veri olarak işlendi, çıktıya insan denetimi şart`);
  const { output, usage } = await runLlm({
    agent, task,
    sections: [
      { title: 'TALEP (kişisel veriler çıkarıldı; yalnızca aşağıdaki alanlar modele iletilir)', text: untrustedBlock(`TALEP-${form.id}`, `TÜR: ${form.kind}\nTARİH: ${form.date}\nKURUMSAL TALEP: ${form.corporate ? "evet" : "hayır"} (kurum adı iletilmez)\nKONU: ${form.subject || '—'}\nEK BİLGİ: ${JSON.stringify(form.details)}\nMESAJ: ${form.message}`) },
    ],
  });
  const flags = [];
  if (PRICE_RE.test(output.draft_reply)) { flags.push('Yanıt taslağında fiyat/indirim/garanti ifadesi bulundu — gönderilmeden önce temizlenmeli'); log('warn', 'yanit_riskli', 'Yanıt taslağında fiyat/taahhüt ifadesi'); }
  for (const w of scanRiskyClaims(output.draft_reply)) flags.push(`Yanıt taslağı: ${w}`);
  if (/https?:\/\//i.test(output.draft_reply)) { output.draft_reply = output.draft_reply.replace(/https?:\/\/\S+/gi, '[bağlantı kaldırıldı]'); flags.push('Yanıt taslağındaki dış bağlantılar kaldırıldı'); }
  if (form.suspicious) flags.push('Talep metninde talimat/enjeksiyon kalıbı var — içeriğe güvenmeyin');
  output.risk_flags = flags;
  output.form_id = form.id;
  output.sent = false; // bu sürümde hiçbir e-posta/teklif GÖNDERİLMEZ
  return { output, usage };
};

/* ------------------------------ CRM (yapılandırılmış fırsat önerisi; yazma yalnızca onaylı eylemle) ------------------------------ */
const crm = async ({ agent, task, deps }) => {
  const sl = deps.sales ?? Object.values(deps).find((d) => d?.draft_reply);
  if (!sl) throw Object.assign(new Error('CRM ajanı için Sales analizi gerekli'), { fatal: true });
  const { output, usage } = await runLlm({
    agent, task,
    sections: [{ title: 'SALES ANALİZİ (güvenilir iç çıktı)', text: JSON.stringify({ summary: sl.summary, category: sl.category, urgency: sl.urgency, missing_info: sl.missing_info, next_steps: sl.next_steps }) }],
  });
  output.tags = [...new Set([sl.category, ...(output.tags ?? [])].map((t) => String(t).trim().toLowerCase()).filter(Boolean))].slice(0, 6);
  output.form_id = sl.form_id;
  output.stage = 'yeni';
  output.urgency = sl.urgency;
  return { output, usage };
};

export const RUNNERS = { research, content, seo, qa, competitor, mep, analytics, social, design, sales, crm };
