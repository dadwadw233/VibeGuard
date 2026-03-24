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

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.VIBEGUARD_PORT ? parseInt(process.env.VIBEGUARD_PORT) : 7847;

app.use(express.json());
app.use(express.static(join(__dirname, "../dashboard/public")));

// --- API Routes ---

app.get("/api/events", (req, res) => {
  const limit = req.query.limit ? parseInt(req.query.limit as string) : 100;
  const offset = req.query.offset ? parseInt(req.query.offset as string) : 0;
  const category = req.query.category as string | undefined;
  const severity = req.query.severity as string | undefined;
  const blocked = req.query.blocked !== undefined ? req.query.blocked === "true" : undefined;

  const events = getEvents({ limit, offset, category, severity, blocked });
  res.json(events);
});

app.get("/api/stats", (_req, res) => {
  const stats = getStats();
  res.json(stats);
});

app.get("/api/rules", (_req, res) => {
  const overrides = getConfigOverrides();
  const overrideMap = new Map(overrides.map((o) => [o.rule_id, o]));
  const customPatterns = getCustomPatterns();

  const allRules = [
    ...SECRET_RULES.map((r) => ({
      id: r.id,
      description: r.description,
      category: "secret" as const,
      severity: overrideMap.get(r.id)?.severity ?? r.severity,
      enabled: overrideMap.get(r.id)?.enabled ?? true,
      builtin: true,
    })),
    ...SENSITIVE_FILE_RULES.map((r) => ({
      id: r.id,
      description: r.description,
      category: "sensitive-file" as const,
      severity: r.severity,
      enabled: overrideMap.get(r.id)?.enabled ?? true,
      builtin: true,
    })),
    ...DANGEROUS_COMMAND_RULES.map((r) => ({
      id: r.id,
      description: r.description,
      category: "dangerous-command" as const,
      severity: r.severity,
      enabled: overrideMap.get(r.id)?.enabled ?? true,
      builtin: true,
    })),
    ...customPatterns.map((r) => ({
      id: r.id,
      description: r.description,
      category: r.category,
      severity: r.severity,
      enabled: r.enabled,
      builtin: false,
    })),
  ];

  res.json(allRules);
});

app.put("/api/rules/:ruleId", (req, res) => {
  const { ruleId } = req.params;
  const { enabled, severity } = req.body;

  setConfigOverride(ruleId, { enabled, severity });
  res.json({ ok: true });
});

app.post("/api/rules/custom", (req, res) => {
  const { id, category, description, regex, severity } = req.body;

  if (!id || !category || !description || !regex) {
    res.status(400).json({ error: "Missing required fields: id, category, description, regex" });
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
});

app.delete("/api/rules/custom/:id", (req, res) => {
  removeCustomPattern(req.params.id);
  res.json({ ok: true });
});

// Serve index.html for all other routes
app.get("*", (_req, res) => {
  res.sendFile(join(__dirname, "../dashboard/public/index.html"));
});

app.listen(PORT, () => {
  console.log(`🛡️  VibeGuard Dashboard running at http://localhost:${PORT}`);
});
