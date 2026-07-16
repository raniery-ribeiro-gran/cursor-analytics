-- A migration 010 já pode ter sido aplicada sem preservar esta coluna.
ALTER TABLE user_roles ADD COLUMN logged_in_at TEXT;
