-- Rodrigo Calado: inclui no organograma de TI e concede perfil administrador.
INSERT INTO tech_organogram (
  email,
  name,
  role_title,
  leader_name,
  leader_email,
  tribe,
  legacy_manager_name
)
VALUES (
  'rodrigo.calado@gran.com',
  'Rodrigo Calado',
  'Presidência',
  '',
  '',
  'Presidência',
  ''
)
ON CONFLICT(email) DO UPDATE SET
  name = excluded.name,
  role_title = excluded.role_title,
  tribe = excluded.tribe;

-- Vincula o CTO ao e-mail do Rodrigo (antes só havia o nome do líder).
UPDATE tech_organogram
SET leader_email = 'rodrigo.calado@gran.com'
WHERE email = 'manoel.almeida@gran.com'
  AND (leader_email IS NULL OR trim(leader_email) = '');

INSERT INTO user_roles (email, role, updated_at)
VALUES ('rodrigo.calado@gran.com', 'administrador', datetime('now'))
ON CONFLICT(email) DO UPDATE SET
  role = excluded.role,
  updated_at = datetime('now');
