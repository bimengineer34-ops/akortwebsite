// AI Orchestra uçtan uca testi (ÇALIŞAN sunucuya karşı, sahte model gerekir): ORCH_FAKE_LLM=1 ile başlatılmış sunucu
//   node scripts/admin/e2e-orchestra.mjs http://127.0.0.1:4402   (ADMIN_EMAIL / ADMIN_PASSWORD ortam değişkenleri)
// Yetki, CSRF, idempotency, onay akışı, rol bazlı görünürlük, blog taslağı ve temizlik.
const base = process.argv[2] ?? 'http://127.0.0.1:4402';
const email = process.env.ADMIN_EMAIL, password = process.env.ADMIN_PASSWORD;
if (!email || !password) { console.log('ADMIN_EMAIL/ADMIN_PASSWORD gerekli — test atlandı'); process.exit(0); }

const client = () => {
  let cookie = '', csrf = '';
  const call = async (m, p, body, { noCsrf = false } = {}) => {
    const r = await fetch(base + p, { method: m, headers: { 'Content-Type': 'application/json', Cookie: cookie, Origin: base, ...(m !== 'GET' && !noCsrf ? { 'X-CSRF-Token': csrf } : {}) }, body: body ? JSON.stringify(body) : undefined });
    const sc = r.headers.getSetCookie?.() ?? [];
    if (sc.length) cookie = sc.map((z) => z.split(';')[0]).join('; ');
    return { s: r.status, d: await r.json().catch(() => null) };
  };
  return { call, login: async (e, p) => { const r = await call('POST', '/api/admin/giris', { email: e, password: p }); csrf = (await call('GET', '/api/admin/durum')).d?.user?.csrf; return r.s; } };
};
let pass = 0, fail = 0;
const t = (n, ok, x = '') => { ok ? pass++ : fail++; console.log(`${ok ? '✓' : '✗'} ${n}${ok ? '' : ` — ${typeof x === 'string' ? x : JSON.stringify(x).slice(0, 160)}`}`); };
const O = '/api/admin/x/orkestra';
const key = () => `e2e-${Math.random().toString(36).slice(2)}-${Date.now().toString(36)}-xxxxxx`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const until = async (fn, ms = 30000) => { const t0 = Date.now(); for (;;) { const v = await fn(); if (v) return v; if (Date.now() - t0 > ms) return null; await sleep(300); } };

const admin = client();
t('yönetici girişi', (await admin.login(email, password)) === 200);
const st = await admin.call('GET', `${O}/ayarlar`);
if (!st.d?.fake) { console.log('Sunucu ORCH_FAKE_LLM=1 ile başlatılmamış — test durduruldu'); process.exit(1); }
t('sahte model modu açık (yalnızca test)', st.d.fake === true);

// kullanıcılar
const users = { editor: 'orch-editor@t.test', izleyici: 'orch-izleyici@t.test', seo: 'orch-seo@t.test', icerik: 'orch-icerik@t.test' };
for (const [role, em] of Object.entries(users)) await admin.call('POST', '/api/admin/kullanicilar', { name: role, email: em, role, password: 'Parola.Test1234' });
const cl = {};
for (const [role, em] of Object.entries(users)) { cl[role] = client(); await cl[role].login(em, 'Parola.Test1234'); }

/* ---- okuma yetkisi ---- */
t('yönetici/editör Orchestra verilerini okur', (await admin.call('GET', `${O}/ozet`)).s === 200 && (await cl.editor.call('GET', `${O}/calistirmalar`)).s === 200);
t('izleyici/SEO/içerik rolleri görevleri GÖREMEZ (403)', (await cl.izleyici.call('GET', `${O}/calistirmalar`)).s === 403 && (await cl.seo.call('GET', `${O}/onaylar`)).s === 403 && (await cl.icerik.call('GET', `${O}/olaylar`)).s === 403);
t('yetkisiz roller çalıştıramaz / plan yapamaz (403)', (await cl.seo.call('POST', `${O}/calistir`, { title: 'x', idempotencyKey: key(), steps: [] })).s === 403 && (await cl.izleyici.call('POST', `${O}/plan`, { command: 'blog yazısı hazırla lütfen' })).s === 403);
t('oturumsuz istek 401', (await client().call('GET', `${O}/ozet`)).s === 401);

/* ---- yapılandırma yetkisi ---- */
const ag = (await admin.call('GET', `${O}/ajanlar`)).d;
t('12 ajan listelenir, çalıştırılabilir olanlar işaretli', ag.agents.length === 12 && ag.agents.find((a) => a.key === 'research').executable && !ag.agents.find((a) => a.key === 'sales').executable);
t('editör ajan ayarını DEĞİŞTİREMEZ (yalnızca yönetici)', (await cl.editor.call('PUT', `${O}/ajanlar/qa`, { enabled: false })).s === 403 && (await cl.editor.call('PUT', `${O}/ayarlar`, { concurrency: 3 })).s === 403);
t('geçersiz ajan ayarı reddedilir', (await admin.call('PUT', `${O}/ajanlar/qa`, { tools: ['sistem_komutu'] })).s === 400);
t('CSRF belirteci olmadan yazma reddedilir', (await admin.call('POST', `${O}/plan`, { command: 'blog yazısı hazırla lütfen' }, { noCsrf: true })).s === 403);

/* ---- çalıştırma ve onay ---- */
const wf = (await admin.call('GET', `${O}/akislar`)).d.workflows.find((w) => w.builtin);
const k = key();
const body = { workflowId: wf.id, title: 'E2E blog', params: { topic: 'Çelik yapı koordinasyonu', focus: '' }, idempotencyKey: k };
const [r1, r2] = await Promise.all([admin.call('POST', `${O}/calistir`, body), admin.call('POST', `${O}/calistir`, body)]);
t('Aynı idempotencyKey ile eşzamanlı iki istek tek çalıştırma üretir', r1.d.id === r2.d.id && [r1.d.duplicate, r2.d.duplicate].filter(Boolean).length <= 1 && (await admin.call('GET', `${O}/calistirmalar`)).d.runs.filter((x) => x.title === 'E2E blog').length === 1, { a: r1.d, b: r2.d });
const runId = r1.d.id;
const waiting = await until(async () => { const d = (await admin.call('GET', `${O}/calistirmalar/${runId}`)).d; return d.run.status === 'awaiting_approval' ? d : null; });
t('Akış insan onayında bekler; blog taslağı henüz yok', !!waiting && waiting.tasks.find((x) => x.ref === 'draft').status === 'pending');
const gate = waiting.tasks.find((x) => x.ref === 'approval');
t('Onay merkezinde görünür (bağlam: içerik+SEO+QA)', (await admin.call('GET', `${O}/onaylar`)).d.approvals.some((a) => a.id === gate.id && a.context.content && a.context.seo && a.context.qa));
t('Yetkisiz rol onaylayamaz (403)', (await cl.izleyici.call('POST', `${O}/gorevler/${gate.id}/onayla`, {})).s === 403 && (await cl.seo.call('POST', `${O}/gorevler/${gate.id}/onayla`, {})).s === 403);
const [a1, a2, a3] = await Promise.all([1, 2, 3].map(() => cl.editor.call('POST', `${O}/gorevler/${gate.id}/onayla`, { note: 'e2e' })));
t('Aynı görev eşzamanlı üç kez onaylanınca yalnızca biri geçer', [a1, a2, a3].filter((x) => x.s === 200).length === 1 && [a1, a2, a3].filter((x) => x.s === 409).length === 2, [a1.s, a2.s, a3.s]);
const done = await until(async () => { const d = (await admin.call('GET', `${O}/calistirmalar/${runId}`)).d; return ['succeeded', 'failed'].includes(d.run.status) ? d : null; });
t('Çalıştırma tamamlandı', done?.run.status === 'succeeded', done?.run.error);
const slug = done?.tasks.find((x) => x.ref === 'draft')?.output?.slug;
const entry = (await admin.call('GET', `/api/admin/girdi/blog/${slug}`)).d;
t('Blog editöründe TASLAK olarak açıldı (draft: true)', entry?.data?.draft === true && entry.body.length > 300, entry?.data);
const row = (await admin.call('GET', `${O}/calistirmalar/${runId}`)).d;
t('Onaylayan kişi ve not kaydedildi', row.tasks.find((x) => x.ref === 'approval').approved_by === users.editor && row.tasks.find((x) => x.ref === 'approval').approval_note === 'e2e');
t('Token/maliyet takibi ve olay günlüğü', row.run.tokens_in > 0 && row.events.length >= 10 && !row.events.some((e) => /sk-[A-Za-z0-9]{16,}|Bearer /.test(e.message)));

/* ---- iptal / red / bütçe ---- */
const rr = await admin.call('POST', `${O}/calistir`, { workflowId: wf.id, params: { topic: 'iptal', focus: '' }, idempotencyKey: key() });
await sleep(150);
const cx = await admin.call('POST', `${O}/calistirmalar/${rr.d.id}/iptal`);
t('Çalıştırma iptal edilir', cx.s === 200 && (await admin.call('GET', `${O}/calistirmalar/${rr.d.id}`)).d.run.status === 'cancelled');
t('İptal edilmiş çalıştırma yeniden iptal edilemez (409)', (await admin.call('POST', `${O}/calistirmalar/${rr.d.id}/iptal`)).s === 409);
const rj = await admin.call('POST', `${O}/calistir`, { workflowId: wf.id, params: { topic: 'red testi', focus: '' }, idempotencyKey: key() });
const w2 = await until(async () => { const d = (await admin.call('GET', `${O}/calistirmalar/${rj.d.id}`)).d; return d.run.status === 'awaiting_approval' ? d : null; });
await admin.call('POST', `${O}/gorevler/${w2.tasks.find((x) => x.ref === 'approval').id}/reddet`, { note: 'uygun değil' });
const rd = (await admin.call('GET', `${O}/calistirmalar/${rj.d.id}`)).d;
t('Reddedilen çalıştırma başarısız olur, taslak oluşmaz', rd.run.status === 'failed' && rd.tasks.find((x) => x.ref === 'draft').status === 'skipped');
const lim = await admin.call('POST', `${O}/calistir`, { workflowId: wf.id, params: { topic: 'limit', focus: '' }, idempotencyKey: key(), tokenLimit: 1 });
const ld = await until(async () => { const d = (await admin.call('GET', `${O}/calistirmalar/${lim.d.id}`)).d; return d.run.status === 'failed' ? d : null; });
t('Token limiti aşılan çalıştırma durur', !!ld && /token limiti/.test(ld.run.error), ld?.run);

/* ---- plan (Master) ---- */
const pl = await admin.call('POST', `${O}/plan`, { command: 'Bu hafta BIM koordinasyonu konusunda bir blog yazısı hazırla. Rakip içerikleri araştır. LinkedIn gönderisi oluştur ve onayıma sun.' });
t('Master Türkçe komutu doğrulanmış göreve böler (onay adımları dahil)', pl.s === 200 && pl.d.steps.length >= 8 && pl.d.steps.some((s) => s.kind === 'approval'), pl);
const bad = await admin.call('POST', `${O}/calistir`, { title: 'hack', idempotencyKey: key(), steps: [{ ref: 'e', kind: 'action', agent: 'action.blog_draft', title: 'Onaysız eylem', depends_on: [], input: {} }] });
t('Onay adımı olmayan eylem içeren plan sunucuda reddedilir (422)', bad.s === 422 && /onay/.test(JSON.stringify(bad.d)), bad);
const bad2 = await admin.call('POST', `${O}/calistir`, { title: 'x', idempotencyKey: 'kisa', steps: wf.steps });
t('Geçersiz idempotencyKey reddedilir', bad2.s === 400);

// temizlik
await admin.call('DELETE', `/api/admin/girdi/blog/${slug}`);
for (const em of Object.values(users)) { const u = (await admin.call('GET', '/api/admin/kullanicilar')).d.users.find((x) => x.email === em); if (u) await admin.call('PATCH', `/api/admin/kullanicilar/${u.id}`, { active: false }); }
t('Test taslağı temizlendi', (await admin.call('GET', `/api/admin/girdi/blog/${slug}`)).s === 404);
console.log(`\n${pass} geçti, ${fail} başarısız`);
process.exit(fail ? 1 : 0);
