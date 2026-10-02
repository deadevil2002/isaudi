ALTER TABLE ai_usage_ledger ADD COLUMN model TEXT;
ALTER TABLE ai_usage_ledger ADD COLUMN report_id TEXT;
ALTER TABLE ai_usage_ledger ADD COLUMN source_hash TEXT;
ALTER TABLE ai_usage_ledger ADD COLUMN input_tokens INTEGER;
ALTER TABLE ai_usage_ledger ADD COLUMN output_tokens INTEGER;
ALTER TABLE ai_usage_ledger ADD COLUMN total_tokens INTEGER;
ALTER TABLE ai_usage_ledger ADD COLUMN cached_input_tokens INTEGER;
ALTER TABLE ai_usage_ledger ADD COLUMN cache_write_tokens INTEGER;
