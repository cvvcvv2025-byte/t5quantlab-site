-- T5 Quant Lab Builder D1 schema
-- Workers also create these tables automatically on first API request.

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
CREATE INDEX IF NOT EXISTS idx_builder_access_token_hash ON builder_access_grants(token_hash);

CREATE TABLE IF NOT EXISTS orders (
  order_id TEXT PRIMARY KEY,
  order_token_hash TEXT NOT NULL,
  builder_token_hash TEXT NOT NULL,
  customer_email TEXT,
  product_code TEXT NOT NULL,
  product_name TEXT NOT NULL,
  amount_minor INTEGER NOT NULL,
  currency TEXT NOT NULL,
  payment_provider TEXT,
  provider_trade_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  grant_id TEXT,
  created_at TEXT NOT NULL,
  paid_at TEXT,
  granted_at TEXT,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_provider_trade
  ON orders(payment_provider, provider_trade_id) WHERE provider_trade_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS payment_events (
  event_key TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  event_type TEXT NOT NULL,
  order_id TEXT,
  provider_trade_id TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_payment_events_order ON payment_events(order_id);

CREATE TABLE IF NOT EXISTS payment_intents (
  provider TEXT NOT NULL,
  provider_order_id TEXT NOT NULL,
  order_id TEXT NOT NULL,
  approval_url TEXT,
  status TEXT NOT NULL DEFAULT 'created',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY(provider, provider_order_id),
  UNIQUE(provider, order_id)
);
CREATE INDEX IF NOT EXISTS idx_payment_intents_order ON payment_intents(order_id);

-- Records the exact customer-facing refund/digital-service terms accepted before purchase.
CREATE TABLE IF NOT EXISTS order_terms (
  order_id TEXT PRIMARY KEY,
  terms_version TEXT NOT NULL,
  accepted_at TEXT NOT NULL,
  accepted_ip_hash TEXT,
  user_agent TEXT,
  created_at TEXT NOT NULL
);

-- One-time marker used to upgrade the legacy 1-analysis/1-modification grant into Builder Pass 3+2.
CREATE TABLE IF NOT EXISTS entitlement_adjustments (
  grant_id TEXT PRIMARY KEY,
  adjustment_code TEXT NOT NULL,
  created_at TEXT NOT NULL
);

-- Fulfillment ledger for source upload, paid AI actions, and artifact downloads.
CREATE TABLE IF NOT EXISTS service_events (
  event_id TEXT PRIMARY KEY,
  order_id TEXT,
  grant_id TEXT,
  project_id TEXT,
  action TEXT NOT NULL,
  status TEXT NOT NULL,
  filename TEXT,
  source_sha256 TEXT,
  source_size INTEGER,
  ip_hash TEXT,
  user_agent TEXT,
  started_at TEXT NOT NULL,
  completed_at TEXT,
  http_status INTEGER,
  error_code TEXT
);
CREATE INDEX IF NOT EXISTS idx_service_events_order ON service_events(order_id);
CREATE INDEX IF NOT EXISTS idx_service_events_project ON service_events(project_id);

-- PayPal dispute lifecycle. Open/updated disputes suspend access; resolved outcomes decide resume/revoke.
CREATE TABLE IF NOT EXISTS payment_disputes (
  dispute_id TEXT PRIMARY KEY,
  order_id TEXT,
  provider_trade_id TEXT,
  status TEXT NOT NULL,
  reason TEXT,
  life_cycle_stage TEXT,
  outcome_code TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  resolved_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_payment_disputes_order ON payment_disputes(order_id);
