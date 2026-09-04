CREATE TABLE IF NOT EXISTS salla_oauth_states (
  nonceHash TEXT PRIMARY KEY,
  sessionId TEXT NOT NULL,
  expiresAt INTEGER NOT NULL,
  createdAt INTEGER NOT NULL,
  FOREIGN KEY(sessionId) REFERENCES sessions(sessionId)
);

CREATE INDEX IF NOT EXISTS idx_salla_oauth_states_expiresAt
  ON salla_oauth_states(expiresAt);