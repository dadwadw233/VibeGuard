import { getRuntimeRules, type RuntimeRules } from "../config/index.js";
import { scanContent, scanCommand, scanFilePath } from "../scanner/index.js";
import { getEvents, getStats } from "../store/index.js";

function formatStorageError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  const normalized = message.replace(/\s+/g, " ");
  if (
    normalized.includes("NODE_MODULE_VERSION") ||
    normalized.includes("better_sqlite3.node") ||
    normalized.includes("different Node.js version")
  ) {
    return "VibeGuard storage is unavailable because better-sqlite3 is built for a different Node runtime. Run `npm rebuild better-sqlite3` and restart.";
  }

  return `VibeGuard storage is unavailable: ${normalized}`;
}

export function renderScanTextResult(
  text: string,
  context?: string,
  runtimeRules: RuntimeRules = getRuntimeRules()
): string {
  const result = scanContent(text, context, runtimeRules.secretRules);
  return result.findings.length === 0
    ? "No secrets detected."
    : `Found ${result.findings.length} issue(s):\n${result.findings.map((finding) => `- [${finding.severity.toUpperCase()}] ${finding.description}: ${finding.match}`).join("\n")}`;
}

export function renderScanFileResult(filePath: string, runtimeRules: RuntimeRules = getRuntimeRules()): string {
  const result = scanFilePath(filePath, runtimeRules.fileRules);
  return result.findings.length === 0
    ? "File path appears safe."
    : `Sensitive file detected:\n${result.findings.map((finding) => `- [${finding.severity.toUpperCase()}] ${finding.description}`).join("\n")}`;
}

export function renderScanCommandResult(command: string, runtimeRules: RuntimeRules = getRuntimeRules()): string {
  const result = scanCommand(command, runtimeRules.commandRules);
  return result.findings.length === 0
    ? "Command appears safe."
    : `Dangerous command detected:\n${result.findings.map((finding) => `- [${finding.severity.toUpperCase()}] ${finding.description}`).join("\n")}`;
}

export function renderSecurityEvents(limit: number, category?: "secret" | "sensitive-file" | "dangerous-command"): string {
  try {
    const events = getEvents({ limit, category });
    return events.length === 0 ? "No security events recorded." : JSON.stringify(events, null, 2);
  } catch (error) {
    return formatStorageError(error);
  }
}

export function renderSecurityStats(): string {
  try {
    return JSON.stringify(getStats(), null, 2);
  } catch (error) {
    return formatStorageError(error);
  }
}
