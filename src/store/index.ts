import Database from "better-sqlite3";
import { mkdirSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import { SCHEMA_SQL } from "./schema.js";
import type { Finding } from "../scanner/types.js";

const VIBEGUARD_DIR = join(homedir(), ".vibeguard");
const DB_PATH = join(VIBEGUARD_DIR, "events.db");

let _db: Database.Database | null = null;

function getDb(): Database.Database {
  if (_db) return _db;
  mkdirSync(VIBEGUARD_DIR, { recursive: true });
  _db = new Database(DB_PATH);
  _db.pragma("journal_mode = WAL");
  _db.exec(SCHEMA_SQL);
  return _db;
}

export interface EventRecord {
  id?: number;
  timestamp?: string;
  session_id?: string;
  tool_name: string;
  category: string;
  rule_id: string;
  severity: string;
  description: string;
  blocked: boolean;
  file_path?: string;
  match_redacted?: string;
  cwd?: string;
}

export interface EventFilter {
  limit?: number;
  offset?: number;
  category?: string;
  severity?: string;
  blocked?: boolean;
}

export interface DashboardStats {
  total_events: number;
  blocked_count: number;
  by_category: Record<string, number>;
  by_severity: Record<string, number>;
  recent_daily: Array<{ date: string; count: number }>;
}

export interface ConfigOverride {
  rule_id: string;
  enabled: boolean;
  severity?: string;
}

export interface CustomPattern {
  id: string;
  category: string;
  description: string;
  regex: string;
  severity: string;
  enabled: boolean;
}

export function logEvent(event: EventRecord): void {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO events (session_id, tool_name, category, rule_id, severity, description, blocked, file_path, match_redacted, cwd)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  stmt.run(
    event.session_id ?? null,
    event.tool_name,
    event.category,
    event.rule_id,
    event.severity,
    event.description,
    event.blocked ? 1 : 0,
    event.file_path ?? null,
    event.match_redacted ?? null,
    event.cwd ?? null
  );
}

export function logFindings(
  findings: Finding[],
  blocked: boolean,
  toolName: string,
  sessionId?: string,
  cwd?: string
): void {
  for (const f of findings) {
    logEvent({
      session_id: sessionId,
      tool_name: toolName,
      category: f.category,
      rule_id: f.rule_id,
      severity: f.severity,
      description: f.description,
      blocked,
      file_path: f.location,
      match_redacted: f.match,
      cwd,
    });
  }
}

export function getEvents(filter: EventFilter = {}): EventRecord[] {
  const db = getDb();
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (filter.category) {
    conditions.push("category = ?");
    params.push(filter.category);
  }
  if (filter.severity) {
    conditions.push("severity = ?");
    params.push(filter.severity);
  }
  if (filter.blocked !== undefined) {
    conditions.push("blocked = ?");
    params.push(filter.blocked ? 1 : 0);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const limit = filter.limit ?? 100;
  const offset = filter.offset ?? 0;

  const rows = db
    .prepare(`SELECT * FROM events ${where} ORDER BY timestamp DESC LIMIT ? OFFSET ?`)
    .all(...params, limit, offset) as Array<Record<string, unknown>>;

  return rows.map((row) => ({
    ...row,
    blocked: row.blocked === 1,
  })) as EventRecord[];
}

export function getStats(): DashboardStats {
  const db = getDb();

  const total = db.prepare("SELECT COUNT(*) as count FROM events").get() as { count: number };
  const blocked = db.prepare("SELECT COUNT(*) as count FROM events WHERE blocked = 1").get() as { count: number };

  const byCategory = db
    .prepare("SELECT category, COUNT(*) as count FROM events GROUP BY category")
    .all() as Array<{ category: string; count: number }>;

  const bySeverity = db
    .prepare("SELECT severity, COUNT(*) as count FROM events GROUP BY severity")
    .all() as Array<{ severity: string; count: number }>;

  const recentDaily = db
    .prepare(
      "SELECT date(timestamp) as date, COUNT(*) as count FROM events WHERE timestamp >= datetime('now', '-30 days') GROUP BY date(timestamp) ORDER BY date DESC"
    )
    .all() as Array<{ date: string; count: number }>;

  return {
    total_events: total.count,
    blocked_count: blocked.count,
    by_category: Object.fromEntries(byCategory.map((r) => [r.category, r.count])),
    by_severity: Object.fromEntries(bySeverity.map((r) => [r.severity, r.count])),
    recent_daily: recentDaily,
  };
}

export function getConfigOverrides(): ConfigOverride[] {
  const db = getDb();
  const rows = db.prepare("SELECT * FROM config_overrides").all() as Array<Record<string, unknown>>;
  return rows.map((r) => ({
    rule_id: r.rule_id as string,
    enabled: r.enabled === 1,
    severity: r.severity as string | undefined,
  }));
}

export function setConfigOverride(ruleId: string, override: { enabled?: boolean; severity?: string }): void {
  const db = getDb();
  const existing = db.prepare("SELECT * FROM config_overrides WHERE rule_id = ?").get(ruleId);

  if (existing) {
    if (override.enabled !== undefined) {
      db.prepare("UPDATE config_overrides SET enabled = ? WHERE rule_id = ?").run(override.enabled ? 1 : 0, ruleId);
    }
    if (override.severity !== undefined) {
      db.prepare("UPDATE config_overrides SET severity = ? WHERE rule_id = ?").run(override.severity, ruleId);
    }
  } else {
    db.prepare("INSERT INTO config_overrides (rule_id, enabled, severity) VALUES (?, ?, ?)").run(
      ruleId,
      override.enabled !== undefined ? (override.enabled ? 1 : 0) : 1,
      override.severity ?? null
    );
  }
}

export function getCustomPatterns(): CustomPattern[] {
  const db = getDb();
  const rows = db.prepare("SELECT * FROM custom_patterns WHERE enabled = 1").all() as Array<Record<string, unknown>>;
  return rows.map((r) => ({
    id: r.id as string,
    category: r.category as string,
    description: r.description as string,
    regex: r.regex as string,
    severity: r.severity as string,
    enabled: r.enabled === 1,
  }));
}

export function addCustomPattern(pattern: CustomPattern): void {
  const db = getDb();
  db.prepare("INSERT OR REPLACE INTO custom_patterns (id, category, description, regex, severity, enabled) VALUES (?, ?, ?, ?, ?, ?)").run(
    pattern.id,
    pattern.category,
    pattern.description,
    pattern.regex,
    pattern.severity,
    pattern.enabled ? 1 : 0
  );
}

export function removeCustomPattern(id: string): void {
  const db = getDb();
  db.prepare("DELETE FROM custom_patterns WHERE id = ?").run(id);
}

export function closeDb(): void {
  if (_db) {
    _db.close();
    _db = null;
  }
}
