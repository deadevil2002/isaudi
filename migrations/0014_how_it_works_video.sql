CREATE TABLE IF NOT EXISTS how_it_works_video (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  active_uid TEXT,
  pending_uid TEXT,
  pending_status TEXT CHECK (pending_status IN ('uploading', 'processing', 'error')),
  pending_error TEXT,
  updated_by TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (updated_by) REFERENCES admin_accounts(id) ON DELETE SET NULL
);
