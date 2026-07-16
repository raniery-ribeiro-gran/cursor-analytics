-- Corrige hierarquia: Luis Fernando Meireles Arantes reporta a Lindalberto,
-- e seus liderados passam a apontar para o e-mail dele (havia divergência
-- "Fernando" vs "Fernandes" sem leader_email resolvido).

UPDATE tech_organogram
SET
  name = 'Luis Fernando Meireles Arantes',
  tribe = CASE WHEN tribe = '' THEN 'Preparatórios' ELSE tribe END,
  leader_name = 'Lindalberto Rufino Vales Campelo Filho',
  leader_email = 'lindalberto.filho@gran.com'
WHERE email = 'luis.arantes@gran.com';

UPDATE tech_organogram
SET
  leader_name = 'Luis Fernando Meireles Arantes',
  leader_email = 'luis.arantes@gran.com'
WHERE lower(leader_name) IN (
  'luis fernando meireles arantes',
  'luis fernandes meireles arantes'
)
OR email IN (
  'allan.ribeiro@gran.com',
  'ana.rodrigues@gran.com',
  'diego.bitencourt@gran.com',
  'hygor.santos@gran.com',
  'lizis.santos@gran.com',
  'nicolas.rocha@gran.com'
);

-- Espelha correção na tabela de compatibilidade usada por auth
UPDATE organogram
SET
  name = 'Luis Fernando Meireles Arantes',
  department = 'Preparatórios',
  manager_name = 'Lindalberto Rufino Vales Campelo Filho',
  manager_email = 'lindalberto.filho@gran.com'
WHERE email = 'luis.arantes@gran.com';

UPDATE organogram
SET
  manager_name = 'Luis Fernando Meireles Arantes',
  manager_email = 'luis.arantes@gran.com'
WHERE email IN (
  'allan.ribeiro@gran.com',
  'ana.rodrigues@gran.com',
  'diego.bitencourt@gran.com',
  'hygor.santos@gran.com',
  'lizis.santos@gran.com',
  'nicolas.rocha@gran.com'
);
