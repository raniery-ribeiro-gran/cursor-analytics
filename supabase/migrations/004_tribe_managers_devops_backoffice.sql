-- Roger Pereira = gerente da tribo DevOps
-- Leonardo Pacheco = gerente da tribo Backoffice

UPDATE tech_organogram
SET
  tribe = 'DevOps',
  role_title = CASE
    WHEN role_title = '' OR role_title = 'Não informado no diretório'
      THEN 'GERENTE DEVOPS'
    ELSE role_title
  END
WHERE email = 'roger.pereira@gran.com';

UPDATE tech_organogram
SET
  tribe = 'Backoffice',
  role_title = CASE
    WHEN role_title = '' OR role_title = 'Não informado no diretório'
      THEN 'GERENTE BACKOFFICE'
    ELSE role_title
  END
WHERE email = 'leonardo.pacheco@gran.com';

UPDATE organogram
SET department = 'DevOps'
WHERE email = 'roger.pereira@gran.com';

UPDATE organogram
SET department = 'Backoffice'
WHERE email = 'leonardo.pacheco@gran.com';
