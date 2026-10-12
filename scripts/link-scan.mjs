// Derlenmiş sitede (dist) iç bağlantı, görsel ve betik kaynaklarının varlığını kontrol eder: node scripts/link-scan.mjs [dist]
import fs from 'node:fs';
import path from 'node:path';

const dist = path.resolve(process.argv[2] ?? 'dist');
const files = [];
const walk = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) walk(p); else if (e.name.endsWith('.html')) files.push(p); } };
walk(dist);
const exists = (u) => {
  const clean = decodeURIComponent(u.split('#')[0].split('?')[0]);
  if (!clean || clean === '/') return true;
  const base = path.join(dist, clean);
  return [base, `${base}.html`, path.join(base, 'index.html')].some((c) => fs.existsSync(c) && fs.statSync(c).isFile());
};
const bad = new Map();
let checked = 0;
for (const f of files) {
  const html = fs.readFileSync(f, 'utf8');
  const rel = path.relative(dist, f).replace(/\\/g, '/');
  for (const m of html.matchAll(/\s(?:href|src)=["']?(\/[^"'\s>]*)/g)) {
    const u = m[1];
    if (u.startsWith('//') || /^\/(api|yonetim)(\/|$)/.test(u)) continue;
    checked++;
    if (!exists(u)) { const k = u.split('#')[0]; if (!bad.has(k)) bad.set(k, rel); }
  }
}
console.log(`${files.length} sayfa, ${checked} iç bağlantı/kaynak kontrol edildi, ${bad.size} kırık`);
for (const [u, from] of [...bad].slice(0, 30)) console.log(`  ✗ ${u}  (ilk görüldüğü: ${from})`);
process.exit(bad.size ? 1 : 0);
