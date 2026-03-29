import type { Category, CommandRule, FileRule, SecretRule, Severity } from "../scanner/types.js";
import { SECRET_RULES } from "../scanner/secret-patterns.js";
import { SENSITIVE_FILE_RULES } from "../scanner/sensitive-files.js";
import { DANGEROUS_COMMAND_RULES } from "../scanner/dangerous-commands.js";
import { getConfigOverrides, getCustomPatterns } from "../store/index.js";

export interface RuntimeRules {
  secretRules: SecretRule[];
  fileRules: FileRule[];
  commandRules: CommandRule[];
}

const VALID_SEVERITIES = new Set<Severity>(["critical", "high", "medium", "low"]);
const VALID_CATEGORIES = new Set<Category>(["secret", "sensitive-file", "dangerous-command"]);

function isSeverity(value: string | undefined): value is Severity {
  return value !== undefined && VALID_SEVERITIES.has(value as Severity);
}

function isCategory(value: string): value is Category {
  return VALID_CATEGORIES.has(value as Category);
}

function compilePattern(pattern: string): RegExp | null {
  try {
    return new RegExp(pattern);
  } catch {
    return null;
  }
}

/**
 * Apply config overrides from the store to filter/modify rules.
 */
export function applyOverrides<T extends { id: string; severity: Severity }>(
  rules: readonly T[],
  overrides: Array<{ rule_id: string; enabled: boolean; severity?: string }>
): T[] {
  const overrideMap = new Map(overrides.map((override) => [override.rule_id, override]));

  return rules.flatMap((rule) => {
    const override = overrideMap.get(rule.id);
    if (override && !override.enabled) {
      return [];
    }

    if (isSeverity(override?.severity)) {
      return [{ ...rule, severity: override.severity }];
    }

    return [rule];
  });
}

function getCustomRuntimeRules(
  customPatterns: Array<{
    id: string;
    category: string;
    description: string;
    regex: string;
    severity: string;
    enabled: boolean;
  }>,
  overrides: Map<string, { rule_id: string; enabled: boolean; severity?: string }>
): RuntimeRules {
  const secretRules: SecretRule[] = [];
  const fileRules: FileRule[] = [];
  const commandRules: CommandRule[] = [];

  for (const pattern of customPatterns) {
    if (!isCategory(pattern.category)) {
      continue;
    }

    const override = overrides.get(pattern.id);
    const enabled = override?.enabled ?? pattern.enabled;
    if (!enabled) {
      continue;
    }

    const severityCandidate = override?.severity ?? pattern.severity;
    if (!isSeverity(severityCandidate)) {
      continue;
    }

    const compiled = compilePattern(pattern.regex);
    if (!compiled) {
      continue;
    }

    if (pattern.category === "secret") {
      secretRules.push({
        id: pattern.id,
        description: pattern.description,
        regex: compiled,
        severity: severityCandidate,
      });
      continue;
    }

    if (pattern.category === "sensitive-file") {
      fileRules.push({
        id: pattern.id,
        description: pattern.description,
        pattern: compiled,
        severity: severityCandidate,
      });
      continue;
    }

    commandRules.push({
      id: pattern.id,
      description: pattern.description,
      pattern: compiled,
      severity: severityCandidate,
    });
  }

  return { secretRules, fileRules, commandRules };
}

export function getDefaultRuntimeRules(): RuntimeRules {
  return {
    secretRules: SECRET_RULES,
    fileRules: SENSITIVE_FILE_RULES,
    commandRules: DANGEROUS_COMMAND_RULES,
  };
}

export function buildRuntimeRules(
  overrides: Array<{ rule_id: string; enabled: boolean; severity?: string }>,
  customPatterns: Array<{
    id: string;
    category: string;
    description: string;
    regex: string;
    severity: string;
    enabled: boolean;
  }>
): RuntimeRules {
  const overrideMap = new Map(overrides.map((override) => [override.rule_id, override]));
  const customRules = getCustomRuntimeRules(customPatterns, overrideMap);

  return {
    secretRules: [...applyOverrides(SECRET_RULES, overrides), ...customRules.secretRules],
    fileRules: [...applyOverrides(SENSITIVE_FILE_RULES, overrides), ...customRules.fileRules],
    commandRules: [...applyOverrides(DANGEROUS_COMMAND_RULES, overrides), ...customRules.commandRules],
  };
}

export function getRuntimeRules(): RuntimeRules {
  try {
    return buildRuntimeRules(getConfigOverrides(), getCustomPatterns());
  } catch {
    return getDefaultRuntimeRules();
  }
}

/**
 * Get effective secret rules considering config overrides and custom patterns.
 */
export function getEffectiveSecretRules(): SecretRule[] {
  return getRuntimeRules().secretRules;
}

export function getEffectiveFileRules(): FileRule[] {
  return getRuntimeRules().fileRules;
}

export function getEffectiveCommandRules(): CommandRule[] {
  return getRuntimeRules().commandRules;
}
