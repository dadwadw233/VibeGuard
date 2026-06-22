import { mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname } from "path";
import { getPolicyPath } from "../paths.js";
import type { Severity } from "../scanner/types.js";

export type PolicyPreset = "minimal" | "balanced" | "strict";

export interface Policy {
  preset: PolicyPreset;
}

const DEFAULT_POLICY: Policy = { preset: "balanced" };
const BLOCK_SEVERITIES: Record<PolicyPreset, ReadonlySet<Severity>> = {
  minimal: new Set(["critical"]),
  balanced: new Set(["critical", "high"]),
  strict: new Set(["critical", "high", "medium"]),
};

export function isPolicyPreset(value: string | undefined): value is PolicyPreset {
  return value === "minimal" || value === "balanced" || value === "strict";
}

export function getPolicyPresetDescription(preset: PolicyPreset): string {
  switch (preset) {
    case "minimal":
      return "Block critical findings only.";
    case "strict":
      return "Block critical, high, and medium findings.";
    case "balanced":
      return "Block critical and high findings.";
  }
}

export function readPolicy(): Policy {
  try {
    const parsed = JSON.parse(readFileSync(getPolicyPath(), "utf-8")) as { preset?: string };
    return { preset: isPolicyPreset(parsed.preset) ? parsed.preset : DEFAULT_POLICY.preset };
  } catch {
    return DEFAULT_POLICY;
  }
}

export function writePolicy(policy: Policy): void {
  const filePath = getPolicyPath();
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(policy, null, 2)}\n`, "utf-8");
}

export function shouldBlockSeverity(severity: Severity, policy: Policy = readPolicy()): boolean {
  return BLOCK_SEVERITIES[policy.preset].has(severity);
}
