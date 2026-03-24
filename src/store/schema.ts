export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp TEXT NOT NULL DEFAULT (datetime('now')),
  session_id TEXT,
  tool_name TEXT NOT NULL,
  category TEXT NOT NULL,
  rule_id TEXT NOT NULL,
  severity TEXT NOT NULL,
  description TEXT NOT NULL,
  blocked INTEGER NOT NULL DEFAULT 0,
  file_path TEXT,
  match_redacted TEXT,
  cwd TEXT
);

CREATE TABLE IF NOT EXISTS config_overrides (
  rule_id TEXT PRIMARY KEY,
  enabled INTEGER NOT NULL DEFAULT 1,
  severity TEXT
);

CREATE TABLE IF NOT EXISTS custom_patterns (
  id TEXT PRIMARY KEY,
  category TEXT NOT NULL,
  description TEXT NOT NULL,
  regex TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'high',
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_events_timestamp ON events(timestamp);
CREATE INDEX IF NOT EXISTS idx_events_category ON events(category);
CREATE INDEX IF NOT EXISTS idx_events_severity ON events(severity);
`;
