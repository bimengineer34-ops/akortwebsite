// AKORT AI Orchestra — YALNIZCA EKLEMELİ şema. Mevcut tablolara dokunmaz.
// Geri alma: aşağıdaki orch_* tabloları DROP edilebilir (mevcut veri etkilenmez).
import { db } from '../../db.mjs';

db.exec(`
CREATE TABLE IF NOT EXISTS orch_agents (
  key TEXT PRIMARY KEY,
  name TEXT NOT NULL, role TEXT NOT NULL DEFAULT '',
  system_prompt TEXT NOT NULL DEFAULT '',
  provider TEXT NOT NULL DEFAULT '', model TEXT NOT NULL DEFAULT '',
  tools TEXT NOT NULL DEFAULT '[]',
  input_schema TEXT NOT NULL DEFAULT '{}', output_schema TEXT NOT NULL DEFAULT '{}',
  max_retries INTEGER NOT NULL DEFAULT 1, timeout_s INTEGER NOT NULL DEFAULT 120,
  max_tokens INTEGER NOT NULL DEFAULT 2000,
  requires_approval INTEGER NOT NULL DEFAULT 0,
  enabled INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')), updated_by TEXT
);
CREATE TABLE IF NOT EXISTS orch_workflows (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE, description TEXT NOT NULL DEFAULT '',
  steps TEXT NOT NULL DEFAULT '[]', builtin INTEGER NOT NULL DEFAULT 0,
  created_by TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS orch_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL, command TEXT NOT NULL DEFAULT '',
  workflow_id INTEGER, params TEXT NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'queued', -- queued | running | awaiting_approval | succeeded | failed | cancelled
  idempotency_key TEXT NOT NULL UNIQUE,
  token_limit INTEGER NOT NULL DEFAULT 0,
  tokens_in INTEGER NOT NULL DEFAULT 0, tokens_out INTEGER NOT NULL DEFAULT 0, cost_est REAL,
  error TEXT, result TEXT NOT NULL DEFAULT '{}',
  created_by TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')),
  started_at TEXT, finished_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_orch_runs_status ON orch_runs (status, id DESC);
CREATE TABLE IF NOT EXISTS orch_tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id INTEGER NOT NULL REFERENCES orch_runs(id) ON DELETE CASCADE,
  ref TEXT NOT NULL, kind TEXT NOT NULL DEFAULT 'agent', -- agent | approval | action
  agent TEXT NOT NULL DEFAULT '', title TEXT NOT NULL DEFAULT '',
  depends_on TEXT NOT NULL DEFAULT '[]', input TEXT NOT NULL DEFAULT '{}', output TEXT,
  status TEXT NOT NULL DEFAULT 'pending', -- pending | queued | running | awaiting_approval | succeeded | failed | cancelled | skipped
  error TEXT, attempts INTEGER NOT NULL DEFAULT 0, max_attempts INTEGER NOT NULL DEFAULT 2, next_at TEXT,
  requires_approval INTEGER NOT NULL DEFAULT 0, external INTEGER NOT NULL DEFAULT 0,
  approval_state TEXT NOT NULL DEFAULT 'none', -- none | pending | approved | rejected
  approved_by TEXT, approved_at TEXT, approval_note TEXT,
  tokens_in INTEGER NOT NULL DEFAULT 0, tokens_out INTEGER NOT NULL DEFAULT 0, model TEXT, cost_est REAL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')), started_at TEXT, finished_at TEXT,
  UNIQUE (run_id, ref)
);
CREATE INDEX IF NOT EXISTS idx_orch_tasks_run ON orch_tasks (run_id);
CREATE INDEX IF NOT EXISTS idx_orch_tasks_status ON orch_tasks (status, next_at);
CREATE TABLE IF NOT EXISTS orch_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ts TEXT NOT NULL DEFAULT (datetime('now')),
  run_id INTEGER, task_id INTEGER, agent TEXT,
  level TEXT NOT NULL DEFAULT 'info', -- info | warn | error
  event TEXT NOT NULL, message TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_orch_events_run ON orch_events (run_id, id);
`);
