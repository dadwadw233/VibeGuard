import { SECRET_RULES } from "../scanner/secret-patterns.js";
import { SENSITIVE_FILE_RULES } from "../scanner/sensitive-files.js";
import { DANGEROUS_COMMAND_RULES } from "../scanner/dangerous-commands.js";

export interface RuleOverride {
  rule_id: string;
  enabled: boolean;
  severity?: string;
}

const BUILTIN_PREFIX = "builtin:";
const CUSTOM_PREFIX = "custom:";

export const BUILTIN_RULE_IDS = new Set<string>([
  ...SECRET_RULES.map((rule) => rule.id),
  ...SENSITIVE_FILE_RULES.map((rule) => rule.id),
  ...DANGEROUS_COMMAND_RULES.map((rule) => rule.id),
]);

export function isBuiltinRuleId(ruleId: string): boolean {
  return BUILTIN_RULE_IDS.has(ruleId);
}

export function getOverrideStorageKey(ruleId: string, builtin: boolean): string {
  return `${builtin ? BUILTIN_PREFIX : CUSTOM_PREFIX}${ruleId}`;
}

export function toOverrideMap(overrides: RuleOverride[]): Map<string, RuleOverride> {
  return new Map(overrides.map((override) => [override.rule_id, override]));
}

export function getBuiltinOverride(
  overrides: Map<string, RuleOverride>,
  ruleId: string
): RuleOverride | undefined {
  return overrides.get(getOverrideStorageKey(ruleId, true)) ?? overrides.get(ruleId);
}

export function getCustomOverride(
  overrides: Map<string, RuleOverride>,
  ruleId: string
): RuleOverride | undefined {
  const namespaced = overrides.get(getOverrideStorageKey(ruleId, false));
  if (namespaced) return namespaced;

  // Legacy custom overrides were stored as raw rule IDs.
  if (!isBuiltinRuleId(ruleId)) {
    return overrides.get(ruleId);
  }

  return undefined;
}
