// SQLite (node:sqlite — Node ≥ 22.5) — şema ve yardımcılar
import { DatabaseSync } from 'node:sqlite';
import { paths } from './config.mjs';

export const db = new DatabaseSync(paths.db);
db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin','editor','seo','icerik','sosyal','satis','izleyici')),
  pass_hash TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_login TEXT
);
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  csrf TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL,
  ip TEXT, ua TEXT
);
CREATE TABLE IF NOT EXISTS login_attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ts TEXT NOT NULL DEFAULT (datetime('now')),
  ip TEXT, email TEXT, ok INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_login_attempts ON login_attempts (email, ip, ts);
CREATE TABLE IF NOT EXISTS drafts (
  key TEXT PRIMARY KEY,
  json TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_by TEXT
);
CREATE TABLE IF NOT EXISTS published (
  key TEXT PRIMARY KEY,
  json TEXT NOT NULL,
  published_at TEXT NOT NULL DEFAULT (datetime('now')),
  published_by TEXT
);
CREATE TABLE IF NOT EXISTS versions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  key TEXT NOT NULL,
  json TEXT NOT NULL,
  kind TEXT NOT NULL,
  note TEXT,
  user_email TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_versions_key ON versions (key, id DESC);
CREATE TABLE IF NOT EXISTS builds (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  started_at TEXT NOT NULL DEFAULT (datetime('now')),
  finished_at TEXT,
  status TEXT NOT NULL DEFAULT 'running',
  log TEXT NOT NULL DEFAULT '',
  user_email TEXT,
  summary TEXT
);
CREATE TABLE IF NOT EXISTS forms (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kind TEXT NOT NULL DEFAULT 'iletisim',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  name TEXT, email TEXT, phone TEXT, company TEXT, subject TEXT, message TEXT,
  payload TEXT,
  consent INTEGER NOT NULL DEFAULT 0,
  ip TEXT, ua TEXT,
  status TEXT NOT NULL DEFAULT 'yeni',
  note TEXT,
  handled_by TEXT,
  updated_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_forms_status ON forms (status, id DESC);
CREATE TABLE IF NOT EXISTS subscribers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  status TEXT NOT NULL DEFAULT 'aktif',
  consent INTEGER NOT NULL DEFAULT 1,
  ip TEXT
);
CREATE TABLE IF NOT EXISTS media (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  filename TEXT NOT NULL UNIQUE,
  orig_name TEXT,
  mime TEXT NOT NULL,
  size INTEGER NOT NULL,
  width INTEGER, height INTEGER,
  alt TEXT NOT NULL DEFAULT '',
  title TEXT NOT NULL DEFAULT '',
  variants TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  user_email TEXT
);
CREATE TABLE IF NOT EXISTS audit (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ts TEXT NOT NULL DEFAULT (datetime('now')),
  user_email TEXT, action TEXT NOT NULL, target TEXT, detail TEXT, ip TEXT
);
CREATE INDEX IF NOT EXISTS idx_audit_ts ON audit (id DESC);
CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
`);

// Eski veritabanı: rol CHECK kısıtı yalnızca admin/editör ise tabloyu yeni kısıtla yeniden kur (veri korunur)
{
  const def = db.prepare("SELECT sql FROM sqlite_master WHERE name = 'users'").get()?.sql ?? '';
  if (def && !def.includes("'izleyici'")) {
    db.exec('PRAGMA foreign_keys = OFF');
    try {
      db.exec('BEGIN IMMEDIATE');
      const cols = db.prepare('PRAGMA table_info(users)').all().map((c) => c.name);
      const newDef = def.replace(/CREATE TABLE (IF NOT EXISTS )?"?users"?/i, 'CREATE TABLE users_new').replace("CHECK (role IN ('admin','editor'))", "CHECK (role IN ('admin','editor','seo','icerik','sosyal','satis','izleyici'))");
      db.exec(newDef);
      db.exec(`INSERT INTO users_new (${cols.join(',')}) SELECT ${cols.join(',')} FROM users`);
      db.exec('DROP TABLE users; ALTER TABLE users_new RENAME TO users');
      db.exec('COMMIT');
    } catch (e) { db.exec('ROLLBACK'); throw e; } finally { db.exec('PRAGMA foreign_keys = ON'); }
  }
}

export const q = {
  get: (sql, ...p) => db.prepare(sql).get(...p),
  all: (sql, ...p) => db.prepare(sql).all(...p),
  run: (sql, ...p) => db.prepare(sql).run(...p),
};

/** Birden çok işlemi tek transaction içinde çalıştırır */
export const tx = (fn) => {
  db.exec('BEGIN IMMEDIATE');
  try {
    const r = fn();
    db.exec('COMMIT');
    return r;
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
};

export const audit = (user, action, target = '', detail = '', ip = '') =>
  q.run('INSERT INTO audit (user_email, action, target, detail, ip) VALUES (?,?,?,?,?)', user?.email ?? 'sistem', action, target, detail, ip);

export const getSetting = (key, fallback = '') => q.get('SELECT value FROM settings WHERE key = ?', key)?.value ?? fallback;
export const setSetting = (key, value) =>
  q.run('INSERT INTO settings (key, value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', key, String(value));
