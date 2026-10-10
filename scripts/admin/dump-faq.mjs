// Geliştirici aracı: hizmet ve sektör kayıtlarındaki SSS sayılarını ve mevcut soruları listeler.
// Kullanım: node scripts/admin/dump-faq.mjs [çıktı.json]
import ts from 'typescript';
import fs from 'node:fs';
import vm from 'node:vm';

const files = ['muhendislik', 'bim', 'enerji', 'maliyet', 'yazilim', 'sectors'];
const out = [];
for (const f of files) {
  const src = fs.readFileSync(`src/data/serviceContent/${f}.ts`, 'utf8');
  const js = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const mod = { exports: {} };
  const req = (id) => (id.includes('overrides') ? { ov: (_k, v) => v } : {});
  vm.runInNewContext(js, { module: mod, exports: mod.exports, require: req, console });
  for (const arr of Object.values(mod.exports)) {
    if (!Array.isArray(arr)) continue;
    for (const e of arr) out.push({ file: f, slug: e.slug, title: e.title, kind: e.kind ?? 'sector', summary: e.summary, scope: e.scope ?? e.challenges?.map((c) => c.title), faq: (e.faq ?? []).map((x) => x.q) });
  }
}
const target = process.argv[2];
if (target) fs.writeFileSync(target, JSON.stringify(out, null, 1));
const short = out.filter((e) => e.faq.length < 5);
console.log(`kayıt: ${out.length} · 5'ten az SSS: ${short.length} · eksik soru toplamı: ${short.reduce((a, e) => a + (5 - e.faq.length), 0)}`);
