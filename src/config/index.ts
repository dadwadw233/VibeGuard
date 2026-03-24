import type { SecretRule, Severity } from "../scanner/types.js";
import { SECRET_RULES } from "../scanner/secret-patterns.js";
import { SENSITIVE_FILE_RULES } from "../scanner/sensitive-files.js";
import { DANGEROUS_COMMAND_RULES } from "../scanner/dangerous-commands.js";

/**
 * Get effective secret rules considering config overrides and custom patterns.
 * For now, returns the built-in defaults. The store-based overrides are applied
 * by the hook handler at runtime when the store is available.
 */
export function getEffectiveSecretRules(): SecretRule[] {
  return SECRET_RULES;
}

export function getEffectiveFileRules() {
  return SENSITIVE_FILE_RULES;
}

export function getEffectiveCommandRules() {
  return DANGEROUS_COMMAND_RULES;
}

/**
 * Apply config overrides from the store to filter/modify rules.
 */
export function applyOverrides(
  rules: SecretRule[],
  overrides: Array<{ rule_id: string; enabled: boolean; severity?: string }>
): SecretRule[] {
  const overrideMap = new Map(overrides.map((o) => [o.rule_id, o]));

  return rules
    .filter((rule) => {
      const override = overrideMap.get(rule.id);
      return override ? override.enabled : true;
    })
    .map((rule) => {
      const override = overrideMap.get(rule.id);
      if (override?.severity) {
        return { ...rule, severity: override.severity as Severity };
      }
      return rule;
    });
}
