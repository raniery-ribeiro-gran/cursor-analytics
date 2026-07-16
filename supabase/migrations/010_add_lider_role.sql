-- Perfil Líder: amplia o CHECK de user_roles.
-- SQLite não permite ALTER CHECK; recria a tabela.

CREATE TABLE IF NOT EXISTS user_roles_new (
  email TEXT PRIMARY KEY,
  role TEXT NOT NULL DEFAULT 'leitor'
    CHECK (role IN ('administrador', 'priorizador', 'demandante', 'leitor', 'lider')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO user_roles_new (email, role, created_at, updated_at)
SELECT email, role, created_at, updated_at FROM user_roles;

DROP TABLE user_roles;
ALTER TABLE user_roles_new RENAME TO user_roles;

CREATE INDEX IF NOT EXISTS idx_user_roles_role ON user_roles (role);
