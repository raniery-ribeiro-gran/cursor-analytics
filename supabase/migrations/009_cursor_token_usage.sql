-- Members Token Usage (usage events do painel Cursor)

CREATE TABLE IF NOT EXISTS cursor_token_usage_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  upload_id INTEGER NOT NULL REFERENCES data_upload_logs(id) ON DELETE CASCADE,
  event_at TEXT NOT NULL,
  user_email TEXT NOT NULL,
  cloud_agent_id TEXT NOT NULL DEFAULT '',
  automation_id TEXT NOT NULL DEFAULT '',
  kind TEXT NOT NULL DEFAULT '',
  model TEXT NOT NULL DEFAULT '',
  max_mode INTEGER NOT NULL DEFAULT 0,
  input_cache_write REAL,
  input_no_cache_write REAL,
  cache_read REAL,
  output_tokens REAL,
  total_tokens REAL,
  cost REAL,
  cost_raw TEXT NOT NULL DEFAULT '',
  cost_type TEXT NOT NULL DEFAULT 'unknown'
);

CREATE INDEX IF NOT EXISTS idx_token_usage_events_upload
  ON cursor_token_usage_events (upload_id);

CREATE INDEX IF NOT EXISTS idx_token_usage_events_user
  ON cursor_token_usage_events (upload_id, user_email);

CREATE INDEX IF NOT EXISTS idx_token_usage_events_kind
  ON cursor_token_usage_events (upload_id, kind);

CREATE INDEX IF NOT EXISTS idx_token_usage_events_model
  ON cursor_token_usage_events (upload_id, model);
