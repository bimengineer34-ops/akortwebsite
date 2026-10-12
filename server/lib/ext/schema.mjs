// AKORT genişletme paketi (SEO / Hız / AI / Sosyal / Pazar-Medya / Rakip / Backlink) — YALNIZCA EKLEMELİ şema.
// Mevcut tablolara dokunmaz; geri alma: bu tabloları DROP etmek yeterlidir (mevcut veri etkilenmez).
import { db, getSetting } from '../db.mjs';

db.exec(`
CREATE TABLE IF NOT EXISTS secrets (
  name TEXT PRIMARY KEY,
  enc TEXT NOT NULL,
  hint TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_by TEXT
);
CREATE TABLE IF NOT EXISTS feature_flags (
  key TEXT PRIMARY KEY,
  enabled INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS seo_focus (
  kind TEXT NOT NULL, slug TEXT NOT NULL, focus TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (kind, slug)
);
CREATE TABLE IF NOT EXISTS ai_usage (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ts TEXT NOT NULL DEFAULT (datetime('now')),
  provider TEXT NOT NULL, model TEXT NOT NULL, task TEXT NOT NULL,
  input_tokens INTEGER, output_tokens INTEGER, cost_est REAL,
  ok INTEGER NOT NULL DEFAULT 1, error TEXT, user_email TEXT, ms INTEGER
);
CREATE INDEX IF NOT EXISTS idx_ai_usage_ts ON ai_usage (ts);
CREATE TABLE IF NOT EXISTS ai_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ts TEXT NOT NULL DEFAULT (datetime('now')),
  provider TEXT NOT NULL, model TEXT NOT NULL, task TEXT NOT NULL,
  prompt TEXT NOT NULL, output TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'oneri', -- oneri | kabul | red
  user_email TEXT
);
CREATE TABLE IF NOT EXISTS social_posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  hashtags TEXT NOT NULL DEFAULT '',
  platforms TEXT NOT NULL DEFAULT '[]',
  category TEXT NOT NULL DEFAULT '',
  campaign TEXT NOT NULL DEFAULT '',
  media TEXT NOT NULL DEFAULT '',
  scheduled_at TEXT,
  status TEXT NOT NULL DEFAULT 'taslak', -- taslak | onay_bekliyor | onaylandi | planlandi | yayimlandi | hata | revizyon
  content_hash TEXT NOT NULL DEFAULT '',
  approved_hash TEXT,
  approved_by TEXT, approved_at TEXT,
  idempotency_key TEXT NOT NULL UNIQUE,
  platform_post_ids TEXT NOT NULL DEFAULT '{}',
  source_ref TEXT NOT NULL DEFAULT '',
  review_note TEXT NOT NULL DEFAULT '',
  created_by TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_social_status ON social_posts (status, scheduled_at);
CREATE TABLE IF NOT EXISTS sources (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL, kind TEXT NOT NULL DEFAULT 'rss', -- rss | manuel
  url TEXT NOT NULL UNIQUE, country TEXT NOT NULL DEFAULT 'TR', lang TEXT NOT NULL DEFAULT 'tr',
  category TEXT NOT NULL DEFAULT 'genel', license_note TEXT NOT NULL DEFAULT '',
  interval_min INTEGER NOT NULL DEFAULT 360, enabled INTEGER NOT NULL DEFAULT 1,
  etag TEXT, last_modified TEXT, last_success TEXT, last_error TEXT, last_check TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS source_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_id INTEGER NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
  canonical_url TEXT NOT NULL UNIQUE, title TEXT NOT NULL, summary TEXT NOT NULL DEFAULT '',
  published_at TEXT, fetched_at TEXT NOT NULL DEFAULT (datetime('now')),
  checksum TEXT NOT NULL, relevance INTEGER NOT NULL DEFAULT 0, tags TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'yeni', -- yeni | ilgili | elendi | fikir
  method TEXT NOT NULL DEFAULT 'rss'
);
CREATE INDEX IF NOT EXISTS idx_items_status ON source_items (status, id DESC);
CREATE INDEX IF NOT EXISTS idx_items_checksum ON source_items (checksum);
CREATE TABLE IF NOT EXISTS competitors (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL, url TEXT NOT NULL UNIQUE, sector TEXT NOT NULL DEFAULT '', note TEXT NOT NULL DEFAULT '',
  last_check TEXT, last_status INTEGER, last_title TEXT, last_hash TEXT, last_change TEXT, last_error TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS competitor_checks (
  id INTEGER PRIMARY KEY AUTOINCREMENT, competitor_id INTEGER NOT NULL REFERENCES competitors(id) ON DELETE CASCADE,
  ts TEXT NOT NULL DEFAULT (datetime('now')), status INTEGER, title TEXT, hash TEXT, words INTEGER, changed INTEGER NOT NULL DEFAULT 0, error TEXT
);
CREATE TABLE IF NOT EXISTS backlink_opps (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL, url TEXT NOT NULL, kind TEXT NOT NULL DEFAULT 'dizin', -- dizin | yayin | dernek | referans | diger
  relevance INTEGER NOT NULL DEFAULT 3, risk TEXT NOT NULL DEFAULT 'dusuk', reason TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'aday', -- aday | taslak | onay_bekliyor | gonderildi | kazanildi | reddedildi | kayip
  outreach_draft TEXT NOT NULL DEFAULT '', link_url TEXT NOT NULL DEFAULT '', verified_at TEXT,
  created_by TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS jobs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL, payload TEXT NOT NULL DEFAULT '{}',
  idempotency_key TEXT UNIQUE, state TEXT NOT NULL DEFAULT 'bekliyor', -- bekliyor | calisiyor | tamam | hata | olu
  attempts INTEGER NOT NULL DEFAULT 0, run_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_error TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')), finished_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_jobs_state ON jobs (state, run_at);
`);

try { db.exec("ALTER TABLE competitors ADD COLUMN region TEXT NOT NULL DEFAULT 'TR'"); } catch { /* sütun zaten var */ }

/** Özellik bayrağı (varsayılan: açık) — modülleri sorun çıkarsa panelden kapatmak için */
export const featureOn = (key) => {
  const r = db.prepare('SELECT enabled FROM feature_flags WHERE key = ?').get(key);
  return r ? !!r.enabled : true;
};
void getSetting;
