// Yayın hattı: taslakları yayına al → siteyi geçici klasöre derle → başarılıysa dist ile atomik değiştir
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { q, audit } from './db.mjs';
import { ROOT, config } from './config.mjs';
import { HttpError } from './http.mjs';
import { planPublish, applyPublishToDisk, commitPublish, syncPublishedFiles } from './content.mjs';
import { isDirty, clearDirty } from './entries.mjs';
import { generate as i18nGenerate, idle as i18nIdle, startBackground as i18nBackground } from './ext/i18n.mjs';

let current = null; // { id, log:[], status }

export const buildState = () => {
  if (current) return { running: current.status === 'running', id: current.id, status: current.status, log: current.log.join('') };
  const last = q.get('SELECT * FROM builds ORDER BY id DESC LIMIT 1');
  return last ? { running: false, id: last.id, status: last.status, log: last.log, finishedAt: last.finished_at, startedAt: last.started_at } : { running: false, status: 'yok', log: '' };
};

export const listBuilds = () => q.all('SELECT id, started_at, finished_at, status, user_email, summary FROM builds ORDER BY id DESC LIMIT 30');
export const getBuildLog = (id) => q.get('SELECT * FROM builds WHERE id = ?', id);

const run = (cmd, args, env, onData) =>
  new Promise((resolve) => {
    const child = spawn(cmd, args, { cwd: ROOT, env: { ...process.env, ...env, FORCE_COLOR: '0', NO_COLOR: '1' }, windowsHide: true });
    child.stdout.on('data', (d) => onData(d.toString()));
    child.stderr.on('data', (d) => onData(d.toString()));
    child.on('close', (code) => resolve(code ?? 1));
    child.on('error', (e) => {
      onData(`\n[hata] ${e.message}\n`);
      resolve(1);
    });
  });

const swapDist = () => {
  const { siteDir, stagingDir, previousDir } = config;
  fs.rmSync(previousDir, { recursive: true, force: true });
  if (fs.existsSync(siteDir)) fs.renameSync(siteDir, previousDir);
  try {
    fs.renameSync(stagingDir, siteDir);
  } catch (e) {
    if (fs.existsSync(previousDir)) fs.renameSync(previousDir, siteDir); // geri al
    throw e;
  }
};

const MAX_LOG = 400_000;

/** Yayınla: bekleyen taslakları (varsa) uygular ve siteyi derler. `opts.rebuildOnly` taslak olmadan da derler. */
export const publish = async (user, { rebuildOnly = false } = {}) => {
  if (current?.status === 'running') throw new HttpError(409, 'Bir yayın zaten sürüyor');
  const plan = planPublish();
  const dirty = isDirty();
  if (!plan.length && !dirty && !rebuildOnly) throw new HttpError(400, 'Yayınlanacak değişiklik yok');

  const row = q.run('INSERT INTO builds (user_email, summary) VALUES (?,?)', user.email, [plan.length ? `${plan.length} belge` : '', dirty ? 'blog/proje/yasal metin' : ''].filter(Boolean).join(' + ') || 'yeniden derleme');
  const id = Number(row.lastInsertRowid);
  current = { id, log: [], status: 'running' };
  const log = (s) => {
    current.log.push(s);
    if (current.log.join('').length > MAX_LOG) current.log.splice(0, current.log.length - 200);
  };
  audit(user, 'yayin.basla', `#${id}`, plan.map((p) => p.key).join(', '));

  // Arka planda çalış; isteğe hemen yanıt dön
  (async () => {
    let restore = null;
    let status = 'basarisiz';
    try {
      log(`[${new Date().toLocaleTimeString('tr-TR')}] Yayın başladı (${plan.length} belge)\n`);
      restore = applyPublishToDisk(plan);
      fs.rmSync(config.stagingDir, { recursive: true, force: true });
      const node = process.execPath;
      const code1 = await run(node, ['scripts/copy-bim-assets.mjs'], {}, log);
      if (code1 !== 0) throw new Error('BIM varlıkları kopyalanamadı');
      const code = await run(
        node,
        [path.join('node_modules', 'astro', 'bin', 'astro.mjs'), 'build'],
        { ASTRO_OUT_DIR: path.relative(ROOT, config.stagingDir), PUBLIC_SITE_URL: config.siteUrl },
        log,
      );
      if (code !== 0) throw new Error('Derleme başarısız — canlı site değişmedi');
      if (!fs.existsSync(path.join(config.stagingDir, 'index.html'))) throw new Error('Derleme çıktısı eksik (index.html yok)');
      // İngilizce site: TM'de olan çeviriler anında uygulanır (API çağrısı yok); eksikler yayın sonrası arka planda çevrilir.
      // İngilizce hattı hata verirse Türkçe yayın ETKİLENMEZ.
      try { await i18nGenerate(config.stagingDir, { fallbackDir: config.siteDir, log }); } catch (e) { log(`[i18n] İngilizce sayfalar atlandı: ${e.message}\n`); }
      await i18nIdle();
      swapDist();
      commitPublish(plan, user);
      clearDirty();
      restore = null;
      status = 'basarili';
      log(`\n[${new Date().toLocaleTimeString('tr-TR')}] ✓ Yayın tamamlandı\n`);
      try { const r = i18nBackground(config.siteDir); if (r.started) log('[i18n] Eksik İngilizce çeviriler arka planda tamamlanıyor (İngilizce Yayın sayfasından izleyin)\n'); } catch { /* sonraki yayında denenir */ }
    } catch (e) {
      log(`\n✗ ${e.message}\n`);
      if (restore) {
        restore();
        log('Yayın dosyaları önceki hâline döndürüldü; taslaklar korundu.\n');
      }
    } finally {
      q.run(`UPDATE builds SET status = ?, finished_at = datetime('now'), log = ? WHERE id = ?`, status, current.log.join(''), id);
      audit(user, status === 'basarili' ? 'yayin.basarili' : 'yayin.basarisiz', `#${id}`);
      current.status = status;
      setTimeout(() => {
        if (current?.id === id) current = null;
      }, 60_000).unref();
    }
  })();
  return { id };
};

/** Bir önceki yayına dön (dist-previous ile dist yer değiştirir). */
export const rollback = (user) => {
  if (current?.status === 'running') throw new HttpError(409, 'Bir yayın sürüyor');
  const { siteDir, previousDir, stagingDir } = config;
  if (!fs.existsSync(previousDir)) throw new HttpError(400, 'Geri dönülecek önceki yayın yok');
  fs.rmSync(stagingDir, { recursive: true, force: true });
  fs.renameSync(siteDir, stagingDir);
  fs.renameSync(previousDir, siteDir);
  fs.renameSync(stagingDir, previousDir);
  audit(user, 'yayin.geri_al');
};

/** İlk çalıştırmada dist yoksa (veya içerik varsayılanları eksikse) başlangıç derlemesi. */
export const ensureInitialBuild = async () => {
  syncPublishedFiles();
  const hasSite = fs.existsSync(path.join(config.siteDir, 'index.html'));
  const hasDefaults = fs.existsSync(path.join(config.dataDir, 'defaults')) && fs.readdirSync(path.join(config.dataDir, 'defaults')).length > 0;
  if (hasSite && hasDefaults) return;
  console.log('[yayın] başlangıç derlemesi yapılıyor (dist veya içerik varsayılanları eksik)…');
  const code = await run(process.execPath, [path.join('node_modules', 'astro', 'bin', 'astro.mjs'), 'build'], { PUBLIC_SITE_URL: config.siteUrl }, (s) => process.stdout.write(s));
  if (code !== 0) console.error('[yayın] başlangıç derlemesi başarısız');
};
