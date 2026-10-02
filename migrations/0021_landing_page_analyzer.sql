-- Versioned, tenant-scoped landing-page analysis snapshots.
-- Full HTML and screenshots are intentionally never stored.
CREATE TABLE landing_page_analyses (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  merchant_id TEXT NOT NULL,
  storefront_origin TEXT NOT NULL,
  final_url TEXT,
  content_hash TEXT,
  analyzer_version TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('succeeded', 'failed', 'insufficient_evidence')),
  failure_reason TEXT,
  http_status INTEGER,
  evidence_json TEXT,
  findings_json TEXT,
  finding_count INTEGER NOT NULL DEFAULT 0 CHECK (finding_count >= 0),
  fetch_duration_ms INTEGER NOT NULL DEFAULT 0 CHECK (fetch_duration_ms >= 0),
  analysis_duration_ms INTEGER NOT NULL DEFAULT 0 CHECK (analysis_duration_ms >= 0),
  browser_rendered INTEGER NOT NULL DEFAULT 0 CHECK (browser_rendered IN (0, 1)),
  ai_assisted INTEGER NOT NULL DEFAULT 0 CHECK (ai_assisted IN (0, 1)),
  cache_hits INTEGER NOT NULL DEFAULT 0 CHECK (cache_hits >= 0),
  analyzed_at INTEGER NOT NULL,
  last_accessed_at INTEGER NOT NULL,
  FOREIGN KEY(user_id) REFERENCES users(id),
  FOREIGN KEY(merchant_id) REFERENCES salla_connections(merchantId),
  UNIQUE(user_id, merchant_id, storefront_origin, content_hash, analyzer_version)
);

CREATE INDEX idx_landing_analyses_owner_store_time
  ON landing_page_analyses(user_id, merchant_id, analyzed_at DESC);
CREATE INDEX idx_landing_analyses_version_status
  ON landing_page_analyses(analyzer_version, status, analyzed_at DESC);

-- O(1), content-free Admin observability aggregate.
CREATE TABLE admin_landing_page_summary (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  analyses_count INTEGER NOT NULL DEFAULT 0,
  successful_count INTEGER NOT NULL DEFAULT 0,
  failed_count INTEGER NOT NULL DEFAULT 0,
  insufficient_count INTEGER NOT NULL DEFAULT 0,
  findings_count INTEGER NOT NULL DEFAULT 0,
  browser_renders_count INTEGER NOT NULL DEFAULT 0,
  ai_assisted_count INTEGER NOT NULL DEFAULT 0,
  cache_hits INTEGER NOT NULL DEFAULT 0,
  total_latency_ms INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL DEFAULT 0
);

INSERT INTO admin_landing_page_summary (id, updated_at)
VALUES (1, CAST(strftime('%s', 'now') AS INTEGER) * 1000)
ON CONFLICT(id) DO NOTHING;

CREATE TRIGGER admin_landing_analysis_insert
AFTER INSERT ON landing_page_analyses BEGIN
  UPDATE admin_landing_page_summary SET
    analyses_count = analyses_count + 1,
    successful_count = successful_count + CASE WHEN NEW.status = 'succeeded' THEN 1 ELSE 0 END,
    failed_count = failed_count + CASE WHEN NEW.status = 'failed' THEN 1 ELSE 0 END,
    insufficient_count = insufficient_count + CASE WHEN NEW.status = 'insufficient_evidence' THEN 1 ELSE 0 END,
    findings_count = findings_count + NEW.finding_count,
    browser_renders_count = browser_renders_count + NEW.browser_rendered,
    ai_assisted_count = ai_assisted_count + NEW.ai_assisted,
    cache_hits = cache_hits + NEW.cache_hits,
    total_latency_ms = total_latency_ms + NEW.fetch_duration_ms + NEW.analysis_duration_ms,
    updated_at = NEW.analyzed_at
  WHERE id = 1;
END;

CREATE TRIGGER admin_landing_analysis_cache_hit
AFTER UPDATE OF cache_hits ON landing_page_analyses
WHEN NEW.cache_hits > OLD.cache_hits BEGIN
  UPDATE admin_landing_page_summary SET
    cache_hits = cache_hits + (NEW.cache_hits - OLD.cache_hits),
    updated_at = NEW.last_accessed_at
  WHERE id = 1;
END;

CREATE TRIGGER admin_landing_analysis_delete
AFTER DELETE ON landing_page_analyses BEGIN
  UPDATE admin_landing_page_summary SET
    analyses_count = MAX(analyses_count - 1, 0),
    successful_count = MAX(successful_count - CASE WHEN OLD.status = 'succeeded' THEN 1 ELSE 0 END, 0),
    failed_count = MAX(failed_count - CASE WHEN OLD.status = 'failed' THEN 1 ELSE 0 END, 0),
    insufficient_count = MAX(insufficient_count - CASE WHEN OLD.status = 'insufficient_evidence' THEN 1 ELSE 0 END, 0),
    findings_count = MAX(findings_count - OLD.finding_count, 0),
    browser_renders_count = MAX(browser_renders_count - OLD.browser_rendered, 0),
    ai_assisted_count = MAX(ai_assisted_count - OLD.ai_assisted, 0),
    cache_hits = MAX(cache_hits - OLD.cache_hits, 0),
    total_latency_ms = MAX(total_latency_ms - OLD.fetch_duration_ms - OLD.analysis_duration_ms, 0),
    updated_at = CAST(strftime('%s', 'now') AS INTEGER) * 1000
  WHERE id = 1;
END;
