// Çerezsiz, kişisel veri tutmayan ziyaret sayacı: yalnızca (gün, sayfa) ve (gün, yönlendiren alan adı) başına sayaç.
// IP, tarayıcı bilgisi, çerez veya kimlik tutulmaz → çerez onayı gerektirmez. "Do Not Track" / GPC gönderenler ve botlar sayılmaz.
import { q } from './db.mjs';

q.run('CREATE TABLE IF NOT EXISTS pageviews (day TEXT NOT NULL, path TEXT NOT NULL, views INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (day, path))');
q.run('CREATE TABLE IF NOT EXISTS referrers (day TEXT NOT NULL, host TEXT NOT NULL, views INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (day, host))');

const BOT = /bot|crawl|spider|slurp|headless|lighthouse|preview|monitor|uptime|curl|wget|python|node-fetch|axios|go-http|java\/|facebookexternalhit|bingpreview|pingdom/i;
const today = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Istanbul' });

export const recordView = (req, pathname, siteHost) => {
  try {
    const h = req.headers;
    if (req.method !== 'GET') return;
    if (h.dnt === '1' || h['sec-gpc'] === '1') return;
    if (h.purpose === 'prefetch' || h['sec-purpose']?.includes('prefetch')) return;
    if (h['sec-fetch-dest'] && h['sec-fetch-dest'] !== 'document') return;
    if (!h['user-agent'] || BOT.test(h['user-agent'])) return;
    if (String(h.cookie ?? '').includes('akort_sid=')) return; // yönetim paneline giriş yapmış kişi (siteyi önizliyor)
    const day = today();
    const path = (pathname.replace(/\/+$/, '') || '/').toLowerCase().slice(0, 200);
    q.run('INSERT INTO pageviews (day, path, views) VALUES (?,?,1) ON CONFLICT(day, path) DO UPDATE SET views = views + 1', day, path);
    if (h.referer) {
      let host = '';
      try {
        host = new URL(h.referer).host.replace(/^www\./, '');
      } catch {
        /* geçersiz referer */
      }
      if (host && host !== String(siteHost ?? '').replace(/^www\./, '')) q.run('INSERT INTO referrers (day, host, views) VALUES (?,?,1) ON CONFLICT(day, host) DO UPDATE SET views = views + 1', day, host.slice(0, 120));
    }
  } catch {
    /* sayaç hatası siteyi etkilememeli */
  }
};

export const getStats = (days = 30) => {
  const n = Math.min(Math.max(Number(days) || 30, 1), 365);
  const since = new Date(Date.now() - (n - 1) * 86_400_000).toLocaleDateString('sv-SE', { timeZone: 'Europe/Istanbul' });
  const byDay = new Map(q.all('SELECT day, SUM(views) AS v FROM pageviews WHERE day >= ? GROUP BY day', since).map((r) => [r.day, r.v]));
  const daily = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86_400_000).toLocaleDateString('sv-SE', { timeZone: 'Europe/Istanbul' });
    daily.push({ day: d, views: byDay.get(d) ?? 0 });
  }
  return {
    days: n,
    total: daily.reduce((a, d) => a + d.views, 0),
    daily,
    topPages: q.all('SELECT path, SUM(views) AS views FROM pageviews WHERE day >= ? GROUP BY path ORDER BY views DESC LIMIT 15', since),
    referrers: q.all('SELECT host, SUM(views) AS views FROM referrers WHERE day >= ? GROUP BY host ORDER BY views DESC LIMIT 10', since),
  };
};

/** 400 günden eski sayaçları temizle */
export const pruneStats = () => {
  const cutoff = new Date(Date.now() - 400 * 86_400_000).toLocaleDateString('sv-SE', { timeZone: 'Europe/Istanbul' });
  q.run('DELETE FROM pageviews WHERE day < ?', cutoff);
  q.run('DELETE FROM referrers WHERE day < ?', cutoff);
};
