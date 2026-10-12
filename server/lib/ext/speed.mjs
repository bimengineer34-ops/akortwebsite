// Speed Engine — GERÇEK ölçümler: PageSpeed Insights (Google API) çalıştırmaları + derlenmiş site ağırlık analizi + güvenli bakım eylemleri.
import fs from 'node:fs';
import path from 'node:path';
import { q, audit, db, getSetting, setSetting } from '../db.mjs';
import { HttpError } from '../http.mjs';
import { config, paths } from '../config.mjs';
import { clearGzCache } from '../static.mjs';
import { getSecret } from './vault.mjs';
import { scanSite, speedReport } from './seo.mjs';
import { getStats } from '../stats.mjs';
import './schema.mjs';

db.exec(`CREATE TABLE IF NOT EXISTS psi_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT, ts TEXT NOT NULL DEFAULT (datetime('now')), url TEXT NOT NULL, strategy TEXT NOT NULL,
  perf INTEGER, lcp REAL, cls REAL, tbt REAL, fcp REAL, inp REAL, opportunities TEXT NOT NULL DEFAULT '[]', user_email TEXT
);
CREATE INDEX IF NOT EXISTS idx_psi_ts ON psi_runs (ts);`);

const PSI = 'https://www.googleapis.com/pagespeedonline/v5/runPagespeed';
const num = (x) => (typeof x === 'number' && Number.isFinite(x) ? x : null);

export const runPsi = async (url, strategy, user) => {
  if (!['mobile', 'desktop'].includes(strategy)) throw new HttpError(400, 'strategy mobile veya desktop olmalı');
  let u;
  try { u = new URL(url); } catch { throw new HttpError(400, 'Geçerli bir adres girin'); }
  if (!['http:', 'https:'].includes(u.protocol)) throw new HttpError(400, 'Yalnızca http/https');
  if (/^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|\[?::1)/i.test(u.hostname)) throw new HttpError(400, 'Google yerel adresleri test edemez; herkese açık bir adres girin (canlıya aldıktan sonra).');
  const key = getSecret('google.psi');
  const qs = new URLSearchParams({ url: u.href, strategy, category: 'performance' });
  if (key) qs.set('key', key);
  let res, data;
  try {
    res = await fetch(`${PSI}?${qs}`, { signal: AbortSignal.timeout(90_000) });
    data = await res.json();
  } catch (e) { throw new HttpError(502, `PageSpeed API erişilemedi: ${e.name === 'TimeoutError' ? 'zaman aşımı' : e.message}`); }
  if (!res.ok) {
    const msg = data?.error?.message ?? `HTTP ${res.status}`;
    throw new HttpError(res.status === 429 ? 429 : 502, `PageSpeed API: ${String(msg).slice(0, 220)}${res.status === 429 && !key ? ' — Entegrasyonlar sayfasından Google API anahtarı ekleyin.' : ''}`);
  }
  const lh = data.lighthouseResult;
  if (!lh) throw new HttpError(502, 'PageSpeed yanıtında Lighthouse sonucu yok');
  const a = lh.audits ?? {};
  const opp = Object.values(a).filter((x) => x?.details?.type === 'opportunity' && x.score !== null && x.score < 0.9).sort((p, r) => (r.details.overallSavingsMs ?? 0) - (p.details.overallSavingsMs ?? 0)).slice(0, 5).map((x) => ({ title: x.title, text: x.displayValue ?? '' }));
  const inp = data.loadingExperience?.metrics?.INTERACTION_TO_NEXT_PAINT?.percentile;
  const row = { perf: Math.round((lh.categories?.performance?.score ?? 0) * 100), lcp: num(a['largest-contentful-paint']?.numericValue), cls: num(a['cumulative-layout-shift']?.numericValue), tbt: num(a['total-blocking-time']?.numericValue), fcp: num(a['first-contentful-paint']?.numericValue), inp: num(inp) };
  q.run('INSERT INTO psi_runs (url, strategy, perf, lcp, cls, tbt, fcp, inp, opportunities, user_email) VALUES (?,?,?,?,?,?,?,?,?,?)', u.href, strategy, row.perf, row.lcp, row.cls, row.tbt, row.fcp, row.inp, JSON.stringify(opp), user.email);
  audit(user, 'hiz.psi_testi', u.href, `${strategy} ${row.perf}`);
  return { ...row, url: u.href, strategy, opportunities: opp };
};

const parsePage = (p) => {
  const file = path.join(config.siteDir, p === '/' ? 'index.html' : `${p.replace(/^\//, '')}.html`);
  if (!fs.existsSync(file)) return null;
  const html = fs.readFileSync(file, 'utf8');
  return { kb: Math.round(fs.statSync(file).size / 1024), imgs: (html.match(/<img\b/gi) ?? []).length, lazy: (html.match(/<img\b[^>]*loading=["']?lazy/gi) ?? []).length, scripts: (html.match(/<script\b/gi) ?? []).length, styles: (html.match(/<link\b[^>]*rel=["']?stylesheet/gi) ?? []).length };
};

export const speedOverview = (n = 30) => {
  const local = speedReport();
  const runs = q.all(`SELECT * FROM psi_runs WHERE ts >= datetime('now', ?) ORDER BY id`, `-${n} days`).map((r) => ({ ...r, opportunities: JSON.parse(r.opportunities) }));
  const all = q.all('SELECT * FROM psi_runs ORDER BY id DESC LIMIT 400').map((r) => ({ ...r, opportunities: JSON.parse(r.opportunities) }));
  const latest = (s) => all.find((r) => r.strategy === s) ?? null;
  const first = (s) => [...all].reverse().find((r) => r.strategy === s) ?? null;
  const st = getStats(n);
  const pages = st.topPages.slice(0, 8).map((p) => ({ path: p.path, views: p.views, ...(parsePage(p.path) ?? { kb: null, imgs: null, lazy: null, scripts: null, styles: null }) }));
  const lazyAll = pages.reduce((a, p) => a + (p.lazy ?? 0), 0), imgAll = pages.reduce((a, p) => a + (p.imgs ?? 0), 0);
  const recs = [];
  if (local.available) {
    const heavy = local.images.heaviest.filter((i) => i.kb > 300);
    if (heavy.length) recs.push({ n: 1, title: `${heavy.length} görsel 300 KB üstünde`, text: `En ağırı ${heavy[0].file} (${heavy[0].kb} KB); daha küçük boyut/WebP kullanın.` });
    if (local.images.count && local.images.modern / local.images.count < 0.8) recs.push({ n: recs.length + 1, title: 'Görsellerin bir kısmı modern biçimde değil', text: `${local.images.modern}/${local.images.count} görsel WebP/AVIF.` });
    if (local.js.totalKb > 400) recs.push({ n: recs.length + 1, title: 'JavaScript toplamı yüksek', text: `${local.js.totalKb} KB; kullanılmayan kodu azaltın (BIM görüntüleyici yalnızca /bim sayfasında yüklenmeli).` });
    if (local.html.avgKb > 150) recs.push({ n: recs.length + 1, title: 'HTML sayfaları büyük', text: `Ortalama ${local.html.avgKb} KB.` });
  }
  for (const o of (latest('mobile')?.opportunities ?? []).slice(0, 3)) recs.push({ n: recs.length + 1, title: o.title, text: `${o.text} (PageSpeed mobil)` });
  const last = (k) => getSetting(k, '');
  return {
    range: n, local, psi: { latest: { mobile: latest('mobile'), desktop: latest('desktop') }, first: { mobile: first('mobile'), desktop: first('desktop') }, runs, hasKey: !!getSecret('google.psi') },
    pages, lazyPct: imgAll ? Math.round((lazyAll / imgAll) * 100) : null, recs,
    caches: { lastClear: last('speed.lastCacheClear'), lastPrune: last('speed.lastPrune') },
    labels: runs.map((r) => r.ts.slice(5, 10).replace('-', '/')),
    scanScore: (() => { try { return scanSite().avgScore; } catch { return null; } })(),
  };
};

export const clearCache = (user) => {
  const freed = clearGzCache();
  setSetting('speed.lastCacheClear', new Date().toISOString());
  audit(user, 'hiz.onbellek_temizle', `${freed} giriş`);
  return { cleared: freed };
};

export const pruneDb = (user) => {
  const size = () => { try { return fs.statSync(paths.db).size; } catch { return 0; } };
  const before = size();
  const r = {
    sessions: q.run(`DELETE FROM sessions WHERE expires_at < datetime('now')`).changes,
    loginAttempts: q.run(`DELETE FROM login_attempts WHERE ts < datetime('now','-30 days')`).changes,
    jobs: q.run(`DELETE FROM jobs WHERE state IN ('tamam','olu') AND created_at < datetime('now','-30 days')`).changes,
    psi: q.run(`DELETE FROM psi_runs WHERE ts < datetime('now','-180 days')`).changes,
  };
  db.exec('PRAGMA wal_checkpoint(TRUNCATE)');
  setSetting('speed.lastPrune', new Date().toISOString());
  audit(user, 'hiz.veritabani_temizle', JSON.stringify(r));
  return { ...r, sizeBefore: before, sizeAfter: size() };
};
