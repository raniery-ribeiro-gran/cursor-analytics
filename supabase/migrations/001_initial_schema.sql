-- Schema inicial — Cursor Analytics (SQLite)

CREATE TABLE IF NOT EXISTS app_metadata (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS organogram (
  email         TEXT PRIMARY KEY,
  level         INTEGER NOT NULL,
  name          TEXT NOT NULL,
  department    TEXT NOT NULL,
  manager_name  TEXT NOT NULL,
  manager_email TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_organogram_name_lower
  ON organogram (lower(name));

CREATE TABLE IF NOT EXISTS login_attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL,
  token_hash TEXT NOT NULL,
  token_code TEXT,
  ip_address TEXT,
  user_agent TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  failure_reason TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL,
  verified_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_login_attempts_email_created
  ON login_attempts (email, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_login_attempts_email_pending
  ON login_attempts (email, status)
  WHERE status = 'pending';

CREATE TABLE IF NOT EXISTS user_roles (
  email TEXT PRIMARY KEY,
  role TEXT NOT NULL DEFAULT 'leitor',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  logged_in_at TEXT,
  CHECK (role IN ('administrador', 'priorizador', 'demandante', 'leitor'))
);

CREATE INDEX IF NOT EXISTS idx_user_roles_role
  ON user_roles (role);

INSERT INTO user_roles (email, role)
VALUES ('raniery.ribeiro@gran.com', 'administrador')
ON CONFLICT(email) DO UPDATE SET
  role = excluded.role,
  updated_at = datetime('now');
