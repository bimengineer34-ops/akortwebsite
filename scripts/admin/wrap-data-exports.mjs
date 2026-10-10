// Tek seferlik codemod: src/data/** içindeki içerik dışa aktarımlarını ov('<anahtar>', …) ile sarar. Tekrar çalıştırılabilir (idempotent).
import ts from 'typescript'; import fs from 'node:fs'; import path from 'node:path';
const dataDir = 'src/data';
const SKIP_FILES = new Set(['images.ts', 'serviceCatalog.ts', 'serviceContent/types.ts', 'navigation.ts:isActivePath']);
const SKIP_NAMES = new Set(['blogCategories', 'sectors', 'sectorKeys', 'homeServices', 'serviceCatalog', 'sectorCatalog', 'pillarOrder', 'pillarTitles']);
const files = [];
(function walk(d) { for (const f of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, f.name); f.isDirectory() ? walk(p) : p.endsWith('.ts') && files.push(p); } })(dataDir);
let total = 0;
for (const file of files) {
  const rel = path.relative(dataDir, file).split(path.sep).join('/');
  if (SKIP_FILES.has(rel)) continue;
  let text = fs.readFileSync(file, 'utf8');
  const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
  const edits = [];
  for (const st of sf.statements) {
    if (!ts.isVariableStatement(st) || !st.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)) continue;
    for (const d of st.declarationList.declarations) {
      if (!ts.isIdentifier(d.name) || !d.initializer) continue;
      const name = d.name.text; const init = d.initializer;
      if (SKIP_NAMES.has(name) || ts.isArrowFunction(init) || ts.isFunctionExpression(init)) continue;
      if (init.getText(sf).startsWith('ov(')) continue;
      // yalnızca nesne/dizi literal'i (satisfies / as ile sarılı olabilir) — türetilmiş ifadeler (filter, map…) atlanır
      let core = init; while (ts.isSatisfiesExpression(core) || ts.isAsExpression(core) || ts.isParenthesizedExpression(core)) core = core.expression;
      if (!ts.isObjectLiteralExpression(core) && !ts.isArrayLiteralExpression(core)) continue;
      const key = `${rel.replace(/\.ts$/, '').replace(/\//g, '.')}.${name}`;
      edits.push({ start: init.getStart(sf), end: init.getEnd(), key });
    }
  }
  if (!edits.length) continue;
  for (const e of edits.sort((a, b) => b.start - a.start)) text = text.slice(0, e.start) + `ov('${e.key}', ${text.slice(e.start, e.end)})` + text.slice(e.end);
  const importLine = `import { ov } from '@/utils/overrides';\n`;
  if (!text.includes("from '@/utils/overrides'")) {
    const m = text.match(/^(import [^\n]*\n)+/m);
    text = m ? text.replace(m[0], m[0] + importLine) : importLine + text;
  }
  fs.writeFileSync(file, text); total += edits.length; console.log(rel, edits.map((e) => e.key.split('.').pop()).join(', '));
}
console.log('sarılan:', total);
