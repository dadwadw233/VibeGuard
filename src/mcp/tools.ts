import { getRuntimeRules, type RuntimeRules } from "../config/index.js";
import { scanContent, scanCommand, scanFilePath } from "../scanner/index.js";
import { getEvents, getStats } from "../store/index.js";

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
  const events = getEvents({ limit, category });
  return events.length === 0 ? "No security events recorded." : JSON.stringify(events, null, 2);
}

export function renderSecurityStats(): string {
  return JSON.stringify(getStats(), null, 2);
}
