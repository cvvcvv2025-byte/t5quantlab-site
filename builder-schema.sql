-- T5 Quant Lab Builder D1 schema
-- The Worker also creates these tables automatically on first /api/builder/* request.

CREATE TABLE IF NOT EXISTS projects (
  project_id TEXT PRIMARY KEY,
  token_hash TEXT NOT NULL,
  filename TEXT NOT NULL,
  extension TEXT NOT NULL,
  platform TEXT NOT NULL,
  current_logic TEXT,
  change_request TEXT,
  keep_logic TEXT,
  edit_types TEXT,
  status TEXT NOT NULL,
  r2_original_key TEXT NOT NULL,
  r2_analysis_key TEXT,
  r2_modified_key TEXT,
  r2_changelog_key TEXT,
  output_filename TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS jobs (
  job_id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  job_type TEXT NOT NULL,
  status TEXT NOT NULL,
  model TEXT,
  error TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS versions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id TEXT NOT NULL,
  version TEXT NOT NULL,
  r2_source_key TEXT,
  r2_changelog_key TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS usage_daily (
  usage_key TEXT PRIMARY KEY,
  count INTEGER NOT NULL,
  updated_at TEXT NOT NULL
);

-- No visitor receives a grant automatically. A paid subscription/payment flow
-- must create an active grant before upload/analyze/modify is allowed.
CREATE TABLE IF NOT EXISTS builder_access_grants (
  grant_id TEXT PRIMARY KEY,
  token_hash TEXT UNIQUE NOT NULL,
  label TEXT,
  plan TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  analyze_remaining INTEGER NOT NULL DEFAULT 0,
  modify_remaining INTEGER NOT NULL DEFAULT 0,
  expires_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_builder_access_token_hash
  ON builder_access_grants(token_hash);
