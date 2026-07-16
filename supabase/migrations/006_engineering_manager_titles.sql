-- Padroniza cargo de Engineering Managers chave

UPDATE tech_organogram
SET role_title = 'Engineering Manager'
WHERE email IN (
  'raniery.ribeiro@gran.com',
  'lindalberto.filho@gran.com',
  'leonardo.pacheco@gran.com',
  'fernando.silva@gran.com'
);
