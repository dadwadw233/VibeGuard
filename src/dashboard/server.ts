#!/usr/bin/env node

import express from "express";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import {
  getEvents,
  getStats,
  getConfigOverrides,
  setConfigOverride,
  getCustomPatterns,
  addCustomPattern,
  removeCustomPattern,
} from "../store/index.js";
import { SECRET_RULES } from "../scanner/secret-patterns.js";
import { SENSITIVE_FILE_RULES } from "../scanner/sensitive-files.js";
import { DANGEROUS_COMMAND_RULES } from "../scanner/dangerous-commands.js";
import {
  getBuiltinOverride,
  getCustomOverride,
  getOverrideStorageKey,
  isBuiltinRuleId,
  toOverrideMap,
} from "../config/override-keys.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.VIBEGUARD_PORT ? parseInt(process.env.VIBEGUARD_PORT) : 7847;

app.use(express.json());
app.use(express.static(join(__dirname, "../dashboard/public")));

// --- API Routes ---

function getStorageErrorHint(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  const normalized = message.replace(/\s+/g, " ");
  if (
    normalized.includes("NODE_MODULE_VERSION") ||
    normalized.includes("better_sqlite3.node") ||
    normalized.includes("different Node.js version")
  ) {
    return `VibeGuard storage is unavailable because better-sqlite3 was built for a different Node runtime. Run \`npm rebuild better-sqlite3\` (or reinstall the package in this Node version), then restart dashboard.`;
  }

  return `VibeGuard storage is unavailable: ${normalized}`;
}

function withStoreGuard(handler: (req: express.Request, res: express.Response) => void): (req: express.Request, res: express.Response) => void {
  return (req, res) => {
    try {
      handler(req, res);
    } catch (error) {
      const hint = getStorageErrorHint(error);
      console.error("Dashboard storage error:", error);
      res.status(503).json({ error: hint });
    }
  };
}

app.get("/api/events", withStoreGuard((req, res) => {
  const limit = req.query.limit ? parseInt(req.query.limit as string) : 100;
  const offset = req.query.offset ? parseInt(req.query.offset as string) : 0;
  const category = req.query.category as string | undefined;
  const severity = req.query.severity as string | undefined;
  const blocked = req.query.blocked !== undefined ? req.query.blocked === "true" : undefined;

  const events = getEvents({ limit, offset, category, severity, blocked });
  res.json(events);
}));

app.get("/api/stats", withStoreGuard((_req, res) => {
  const stats = getStats();
  res.json(stats);
}));

app.get("/api/rules", withStoreGuard((_req, res) => {
  const overrides = getConfigOverrides();
  const overrideMap = toOverrideMap(overrides);
  const customPatterns = getCustomPatterns();

  const allRules = [
    ...SECRET_RULES.map((r) => ({
      id: r.id,
      description: r.description,
      category: "secret" as const,
      severity: getBuiltinOverride(overrideMap, r.id)?.severity ?? r.severity,
      enabled: getBuiltinOverride(overrideMap, r.id)?.enabled ?? true,
      builtin: true,
    })),
    ...SENSITIVE_FILE_RULES.map((r) => ({
      id: r.id,
      description: r.description,
      category: "sensitive-file" as const,
      severity: getBuiltinOverride(overrideMap, r.id)?.severity ?? r.severity,
      enabled: getBuiltinOverride(overrideMap, r.id)?.enabled ?? true,
      builtin: true,
    })),
    ...DANGEROUS_COMMAND_RULES.map((r) => ({
      id: r.id,
      description: r.description,
      category: "dangerous-command" as const,
      severity: getBuiltinOverride(overrideMap, r.id)?.severity ?? r.severity,
      enabled: getBuiltinOverride(overrideMap, r.id)?.enabled ?? true,
      builtin: true,
    })),
    ...customPatterns.map((r) => ({
      id: r.id,
      description: r.description,
      category: r.category,
      severity: getCustomOverride(overrideMap, r.id)?.severity ?? r.severity,
      enabled: getCustomOverride(overrideMap, r.id)?.enabled ?? r.enabled,
      builtin: false,
    })),
  ];

  res.json(allRules);
}));

app.put("/api/rules/:ruleId", withStoreGuard((req, res) => {
  const { ruleId } = req.params;
  const { enabled, severity, builtin } = req.body;
  const isBuiltin = typeof builtin === "boolean" ? builtin : isBuiltinRuleId(ruleId);

  setConfigOverride(getOverrideStorageKey(ruleId, isBuiltin), { enabled, severity });
  res.json({ ok: true });
}));

app.post("/api/rules/custom", withStoreGuard((req, res) => {
  const { id, category, description, regex, severity } = req.body;

  if (!id || !category || !description || !regex) {
    res.status(400).json({ error: "Missing required fields: id, category, description, regex" });
    return;
  }

  if (isBuiltinRuleId(id)) {
    res.status(400).json({ error: `Rule ID '${id}' is reserved for built-in rules. Choose a unique custom ID.` });
    return;
  }

  // Validate regex
  try {
    new RegExp(regex);
  } catch {
    res.status(400).json({ error: "Invalid regex pattern" });
    return;
  }

  addCustomPattern({
    id,
    category,
    description,
    regex,
    severity: severity ?? "high",
    enabled: true,
  });

  res.json({ ok: true });
}));

app.delete("/api/rules/custom/:id", withStoreGuard((req, res) => {
  removeCustomPattern(req.params.id);
  res.json({ ok: true });
}));

// Serve index.html for all other routes
app.get("*", (_req, res) => {
  res.sendFile(join(__dirname, "../dashboard/public/index.html"));
});

app.listen(PORT, () => {
  console.log(`🛡️  VibeGuard Dashboard running at http://localhost:${PORT}`);
});
