-- Replace the historical Cloudflare Stream state with one validated YouTube reference.
-- Existing Stream UIDs are intentionally not carried forward: public playback remains
-- unavailable until a super admin explicitly saves a YouTube URL. DROP IF EXISTS makes
-- this reconciliation safe both when historical 0014 exists and when production skips it.
DROP TABLE IF EXISTS how_it_works_video;

CREATE TABLE how_it_works_video (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  youtube_video_id TEXT CHECK (
    youtube_video_id IS NULL OR (
      length(youtube_video_id) = 11 AND
      youtube_video_id NOT GLOB '*[^A-Za-z0-9_-]*'
    )
  ),
  youtube_url TEXT,
  enabled INTEGER NOT NULL DEFAULT 0 CHECK (enabled IN (0, 1)),
  updated_by TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (updated_by) REFERENCES admin_accounts(id) ON DELETE SET NULL,
  CHECK (enabled = 0 OR (youtube_video_id IS NOT NULL AND youtube_url IS NOT NULL))
);
