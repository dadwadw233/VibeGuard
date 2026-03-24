import type { ScanResult, Finding, SecretRule } from "./types.js";
import { SECRET_RULES } from "./secret-patterns.js";
import { SENSITIVE_FILE_RULES } from "./sensitive-files.js";
import { DANGEROUS_COMMAND_RULES } from "./dangerous-commands.js";

/**
 * Redact a matched secret, showing only a prefix for identification.
 */
function redact(match: string, visibleChars = 6): string {
  if (match.length <= visibleChars) return "***";
  return match.slice(0, visibleChars) + "***" + match.slice(-3);
}

/**
 * Check if a match is in the allowlist for a rule.
 */
function isAllowlisted(rule: SecretRule, match: string, filePath?: string): boolean {
  if (!rule.allowlist) return false;
  if (rule.allowlist.regexes?.some((r) => r.test(match))) return true;
  if (filePath && rule.allowlist.paths?.some((r) => r.test(filePath))) return true;
  return false;
}

/**
 * Fast keyword pre-filter: check if any keyword appears in the text.
 */
function hasKeyword(text: string, keywords?: string[]): boolean {
  if (!keywords || keywords.length === 0) return true; // No keywords = always match
  const lower = text.toLowerCase();
  return keywords.some((kw) => lower.includes(kw.toLowerCase()));
}

/**
 * Scan text content for secrets (API keys, tokens, passwords, etc.)
 */
export function scanContent(content: string, filePath?: string): ScanResult {
  const findings: Finding[] = [];

  // Skip binary or very large content
  if (content.length > 1_000_000) {
    return { blocked: false, findings: [] };
  }

  for (const rule of SECRET_RULES) {
    // Fast keyword pre-filter
    if (!hasKeyword(content, rule.keywords)) continue;

    // Run regex
    const matches = content.matchAll(new RegExp(rule.regex, "g"));
    for (const m of matches) {
      const matchStr = m[0];

      if (isAllowlisted(rule, matchStr, filePath)) continue;

      // Find line number
      let line: number | undefined;
      if (m.index !== undefined) {
        line = content.slice(0, m.index).split("\n").length;
      }

      findings.push({
        rule_id: rule.id,
        category: "secret",
        severity: rule.severity,
        description: rule.description,
        match: redact(matchStr),
        location: filePath,
        line,
      });
    }
  }

  const blocked = findings.some((f) => f.severity === "critical" || f.severity === "high");
  return { blocked, findings };
}

/**
 * Check if a file path points to a sensitive file.
 */
export function scanFilePath(filePath: string): ScanResult {
  const findings: Finding[] = [];

  // Normalize path separators
  const normalized = filePath.replace(/\\/g, "/");

  for (const rule of SENSITIVE_FILE_RULES) {
    if (rule.pattern.test(normalized)) {
      findings.push({
        rule_id: rule.id,
        category: "sensitive-file",
        severity: rule.severity,
        description: rule.description,
        match: filePath,
        location: filePath,
      });
    }
  }

  const blocked = findings.some((f) => f.severity === "critical" || f.severity === "high");
  return { blocked, findings };
}

/**
 * Check if a bash command is dangerous.
 */
export function scanCommand(command: string): ScanResult {
  const findings: Finding[] = [];

  // Skip empty commands
  if (!command.trim()) {
    return { blocked: false, findings: [] };
  }

  for (const rule of DANGEROUS_COMMAND_RULES) {
    if (rule.pattern.test(command)) {
      findings.push({
        rule_id: rule.id,
        category: "dangerous-command",
        severity: rule.severity,
        description: rule.description,
        match: redact(command, 30),
      });
    }
  }

  const blocked = findings.some((f) => f.severity === "critical" || f.severity === "high");
  return { blocked, findings };
}

export type { ScanResult, Finding, Severity, Category } from "./types.js";
export { SECRET_RULES } from "./secret-patterns.js";
export { SENSITIVE_FILE_RULES } from "./sensitive-files.js";
export { DANGEROUS_COMMAND_RULES } from "./dangerous-commands.js";
