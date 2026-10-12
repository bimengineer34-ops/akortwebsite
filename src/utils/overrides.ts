/**
 * İçerik motoru (yönetim paneli ile site arasındaki köprü).
 *
 * `src/data/*` dosyalarındaki içerik **varsayılan**dır. Her dışa aktarım `ov('<dosya>.<ad>', varsayılan)` ile sarılır:
 *  - `data/content/published/<anahtar>.json` varsa (panelden yayınlanmış) varsayılanla birleştirilerek kullanılır
 *    (nesneler anahtar anahtar birleşir, diziler tümüyle değişir → varsayılana sonradan eklenen alanlar kaybolmaz),
 *  - varsayılan değer `data/defaults/<anahtar>.json` olarak yazılır; panel formları bu yapıdan otomatik üretilir.
 *
 * Yalnızca derleme/sunucu tarafında (Node) çalışır. Tarayıcı paketine girerse sessizce varsayılanı döndürür.
 * Bkz. docs/ADMIN_PLAN.md
 */
type Fs = typeof import('node:fs');
type Path = typeof import('node:path');
type NodeProcess = { getBuiltinModule?: (id: string) => unknown; cwd: () => string; env?: Record<string, string | undefined> };

const nodeProcess = (globalThis as unknown as { process?: NodeProcess }).process;
const fs = nodeProcess?.getBuiltinModule?.('node:fs') as Fs | undefined;
const path = nodeProcess?.getBuiltinModule?.('node:path') as Path | undefined;

const root = nodeProcess && path ? nodeProcess.cwd() : '';
// Sunucu DATA_DIR ile farklı bir veri klasörü kullanıyorsa (ör. Veridyen kalıcı disk) varsayılanlar/yayımlanan içerik oradan okunur/yazılır
const dataRoot = path ? (nodeProcess?.env?.DATA_DIR ? path.resolve(root, nodeProcess.env.DATA_DIR) : path.join(root, 'data')) : '';
const publishedDir = path ? path.join(dataRoot, 'content', 'published') : '';
const defaultsDir = path ? path.join(dataRoot, 'defaults') : '';

const isPlainObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** Nesneleri anahtar anahtar birleştirir; diziler ve ilkel değerler override'dan gelir. */
export const mergeContent = <T>(base: T, override: unknown): T => {
  if (override === undefined) return base;
  if (isPlainObject(base) && isPlainObject(override)) {
    const out: Record<string, unknown> = { ...base };
    for (const [k, v] of Object.entries(override)) out[k] = mergeContent((base as Record<string, unknown>)[k], v);
    return out as T;
  }
  return override as T;
};

const safeKey = (key: string) => key.replace(/[^a-zA-Z0-9._-]/g, '_');

export const ov = <T>(key: string, defaults: T): T => {
  if (!fs || !path) return defaults;
  const file = `${safeKey(key)}.json`;
  try {
    fs.mkdirSync(defaultsDir, { recursive: true });
    const json = JSON.stringify(defaults, null, 2);
    const target = path.join(defaultsDir, file);
    if (!fs.existsSync(target) || fs.readFileSync(target, 'utf8') !== json) fs.writeFileSync(target, json);
  } catch {
    /* salt okunur ortam: varsayılan yazılamaz, site yine çalışır */
  }
  try {
    const pub = path.join(publishedDir, file);
    if (fs.existsSync(pub)) return mergeContent(defaults, JSON.parse(fs.readFileSync(pub, 'utf8')) as unknown);
  } catch (err) {
    console.warn(`[içerik] ${key} override okunamadı, varsayılan kullanılıyor:`, err);
  }
  return defaults;
};
