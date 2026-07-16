-- Metadados para uploads incrementais e histórico de ciclos.
ALTER TABLE data_upload_logs ADD COLUMN parsed_row_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE data_upload_logs ADD COLUMN ignored_row_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE data_upload_logs ADD COLUMN usage_cycle_id INTEGER;

UPDATE data_upload_logs
SET parsed_row_count = row_count
WHERE parsed_row_count = 0;

-- Os uploads anteriores formam o ciclo histórico inicial. A seleção da
-- consulta usa o último snapshot bem-sucedido dentro de cada ciclo.
UPDATE data_upload_logs
SET usage_cycle_id = 1
WHERE dataset = 'members_usage'
  AND status = 'success'
  AND usage_cycle_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_upload_logs_members_cycle
  ON data_upload_logs (dataset, usage_cycle_id, uploaded_at DESC, id DESC);
