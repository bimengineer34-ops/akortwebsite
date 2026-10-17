// Marka şablonu dışa aktarma: PNG/JPG/SVG/PDF — node scripts/admin/test-brand-export.mjs
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'akort-brand-'));
process.env.DATA_DIR = path.join(tmp, 'data');
const { renderBrand } = await import('../../server/lib/ext/brand.mjs');

let pass = 0, fail = 0;
const t = (n, ok, x = '') => { ok ? pass++ : fail++; console.log(`${ok ? '✓' : '✗'} ${n}${ok ? '' : ' — ' + x}`); };
const base = { format: 'ig-kare', theme: 'marka', title: 'Mühendislikte uyum', subtitle: 'BIM ve koordinasyon' };

const png = await renderBrand({ ...base, out: 'png' });
t('PNG üretilir', png.mime === 'image/png' && (await sharp(png.buf).metadata()).width === 1080, png.mime);

const svg = await renderBrand({ ...base, out: 'svg' });
const doc = svg.buf.toString('utf8');
t('SVG: tür ve boyut', svg.mime === 'image/svg+xml' && /<svg[^>]+width="1080"/.test(doc) && /viewBox="0 0 1080 1080"/.test(doc));
t('SVG: metinler canlı <text> (büyük harf, Türkçe)', /<text[^>]*>MÜHENDİSLİKTE/.test(doc) && /BIM ve koordinasyon/.test(doc));
t('SVG: logo gömülü, harici bağlantı yok', /<image[^>]+href="data:image\/png;base64,/.test(doc) && !/href="https?:/.test(doc));
t('SVG: betik/olay işleyicisi yok (güvenli)', !/<script|onload=|onclick=|javascript:/i.test(doc));
t('SVG: XML olarak okunur ve sharp ile çizilir', (await sharp(svg.buf).png().toBuffer()).length > 1000);

const pdf = await renderBrand({ ...base, out: 'pdf' });
const raw = pdf.buf.toString('latin1');
t('PDF: başlık/son', pdf.mime === 'application/pdf' && raw.startsWith('%PDF-1.4') && raw.trimEnd().endsWith('%%EOF'));
// xref ofsetleri gerçekten nesne başlangıçlarını göstermeli
const xrefPos = Number(/startxref\n(\d+)/.exec(raw)[1]);
t('PDF: startxref xref tablosunu gösterir', raw.slice(xrefPos, xrefPos + 4) === 'xref');
const offs = [...raw.slice(xrefPos).matchAll(/(\d{10}) 00000 n/g)].map((m) => Number(m[1]));
t('PDF: 5 nesne ofseti doğru', offs.length === 5 && offs.every((o, i) => raw.slice(o).startsWith(`${i + 1} 0 obj`)), JSON.stringify(offs));
const len = Number(/\/Length (\d+) >>\nstream\n/.exec(raw.slice(offs[3]))[1]);
const start = raw.indexOf('stream\n', offs[3]) + 7;
t('PDF: gömülü JPEG sağlam (uzunluk eşleşir, SOI/EOI)', pdf.buf[start] === 0xff && pdf.buf[start + 1] === 0xd8 && pdf.buf[start + len - 2] === 0xff && pdf.buf[start + len - 1] === 0xd9, `len=${len}`);
t('PDF: sayfa boyutu 810×810 pt', /MediaBox \[0 0 810\.00 810\.00\]/.test(raw));
const embedded = await sharp(pdf.buf.subarray(start, start + len)).metadata();
t('PDF: gömülü görsel 1080×1080', embedded.width === 1080 && embedded.height === 1080);

console.log(`\n${pass} geçti, ${fail} başarısız`);
process.exit(fail ? 1 : 0);
