-- Uploads de CSVs do painel Cursor + Members Usage cycle

CREATE TABLE IF NOT EXISTS data_upload_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  dataset TEXT NOT NULL,
  filename TEXT NOT NULL,
  uploaded_at TEXT NOT NULL DEFAULT (datetime('now')),
  uploaded_by_email TEXT,
  row_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'success',
  error_message TEXT,
  source_team_id TEXT,
  cycle_date TEXT
);

CREATE INDEX IF NOT EXISTS idx_data_upload_logs_dataset_uploaded
  ON data_upload_logs (dataset, uploaded_at DESC);

CREATE TABLE IF NOT EXISTS cursor_members_usage (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  upload_id INTEGER NOT NULL REFERENCES data_upload_logs(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT '',
  seat_type TEXT NOT NULL DEFAULT '',
  included_usage REAL,
  included_usage_raw TEXT NOT NULL DEFAULT '',
  free_usage REAL,
  free_usage_raw TEXT NOT NULL DEFAULT '',
  free_usage_capped INTEGER NOT NULL DEFAULT 0,
  on_demand_usage REAL,
  on_demand_usage_raw TEXT NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_cursor_members_usage_upload
  ON cursor_members_usage (upload_id);

CREATE INDEX IF NOT EXISTS idx_cursor_members_usage_email
  ON cursor_members_usage (email);
