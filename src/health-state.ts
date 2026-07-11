import { mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "fs";
import { dirname } from "path";
import { getHookHealthPath } from "./paths.js";

export type HookHealthSource = "codex:PreToolUse" | "codex:UserPromptSubmit";
export type HookDegradationReason = "invalid-json" | "handler-error";

export interface HookDegradation {
  source: HookHealthSource;
  reason: HookDegradationReason;
  observedAt: string;
}

export interface HookHealthState {
  version: 1;
  degradations: Partial<Record<HookHealthSource, HookDegradation>>;
}

function emptyState(): HookHealthState {
  return { version: 1, degradations: {} };
}

export function readHookHealthState(): HookHealthState {
  try {
    const parsed = JSON.parse(readFileSync(getHookHealthPath(), "utf-8")) as Partial<HookHealthState>;
    if (parsed.version !== 1 || !parsed.degradations || typeof parsed.degradations !== "object") {
      return emptyState();
    }

    const degradations: HookHealthState["degradations"] = {};
    for (const entry of Object.values(parsed.degradations)) {
      if (!entry || typeof entry !== "object") continue;
      if (entry.source !== "codex:PreToolUse" && entry.source !== "codex:UserPromptSubmit") continue;
      if (entry.reason !== "invalid-json" && entry.reason !== "handler-error") continue;
      if (typeof entry.observedAt !== "string" || Number.isNaN(Date.parse(entry.observedAt))) continue;
      degradations[entry.source] = entry;
    }
    return { version: 1, degradations };
  } catch {
    return emptyState();
  }
}

function writeHookHealthState(state: HookHealthState): void {
  const healthPath = getHookHealthPath();
  if (Object.keys(state.degradations).length === 0) {
    rmSync(healthPath, { force: true });
    return;
  }

  mkdirSync(dirname(healthPath), { recursive: true });
  const tempPath = `${healthPath}.${process.pid}.tmp`;
  try {
    writeFileSync(tempPath, `${JSON.stringify(state, null, 2)}\n`, { encoding: "utf-8", mode: 0o600 });
    renameSync(tempPath, healthPath);
  } finally {
    rmSync(tempPath, { force: true });
  }
}

export function recordHookDegradation(source: HookHealthSource, reason: HookDegradationReason): void {
  try {
    const state = readHookHealthState();
    state.degradations[source] = {
      source,
      reason,
      observedAt: new Date().toISOString(),
    };
    writeHookHealthState(state);
  } catch {
    // Hook health reporting must never change the fail-open behavior.
  }
}

export function clearHookDegradation(source: HookHealthSource): void {
  try {
    const state = readHookHealthState();
    if (!state.degradations[source]) return;
    delete state.degradations[source];
    writeHookHealthState(state);
  } catch {
    // Hook health reporting must never interrupt a successful hook.
  }
}
