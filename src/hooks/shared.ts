import { getRuntimeRules, type RuntimeRules } from "../config/index.js";
import { scanContent, scanCommand, scanFilePath } from "../scanner/index.js";
import { logFindings } from "../store/index.js";
import type { HookInput, HookOutput, ScanResult, UserPromptInput, UserPromptOutput } from "../scanner/types.js";

function getPreToolScanResult(input: HookInput, runtimeRules: RuntimeRules): ScanResult | null {
  const { tool_name, tool_input } = input;

  switch (tool_name) {
    case "Bash":
      return scanCommand((tool_input.command as string) ?? "", runtimeRules.commandRules);
    case "Write":
      return scanContent(
        (tool_input.content as string) ?? "",
        tool_input.file_path as string | undefined,
        runtimeRules.secretRules
      );
    case "Edit":
      return scanContent(
        (tool_input.new_string as string) ?? "",
        tool_input.file_path as string | undefined,
        runtimeRules.secretRules
      );
    case "Read":
      return scanFilePath((tool_input.file_path as string) ?? "", runtimeRules.fileRules);
    default:
      return null;
  }
}

export function handlePreToolUse(input: HookInput, runtimeRules: RuntimeRules = getRuntimeRules()): HookOutput | undefined {
  const result = getPreToolScanResult(input, runtimeRules);
  if (!result) return undefined;

  if (result.findings.length > 0) {
    try {
      logFindings(result.findings, result.blocked, input.tool_name, input.session_id, input.cwd);
    } catch {
      // Do not block operations if logging fails.
    }
  }

  if (result.findings.length === 0) return undefined;

  const reasons = result.findings.map((finding) => `[${finding.severity.toUpperCase()}] ${finding.description}`).join("; ");

  return {
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: result.blocked ? "deny" : "ask",
      permissionDecisionReason: result.blocked
        ? `🛡️ VibeGuard blocked this ${input.tool_name} action. ${reasons}. Review with \`vibeguard dashboard\` if you need event history.`
        : `⚠️ VibeGuard flagged this ${input.tool_name} action. ${reasons}. Confirm only if the operation is intentional.`,
    },
  };
}

export function handleUserPromptSubmit(
  input: UserPromptInput,
  runtimeRules: RuntimeRules = getRuntimeRules()
): UserPromptOutput | { additionalContext: string } | undefined {
  if (!input.prompt || input.prompt.trim().length === 0) return undefined;

  const result = scanContent(input.prompt, undefined, runtimeRules.secretRules);

  if (result.findings.length > 0) {
    try {
      logFindings(result.findings, result.blocked, "UserPrompt", input.session_id, input.cwd);
    } catch {
      // Do not block prompts if logging fails.
    }
  }

  if (result.findings.length === 0) return undefined;

  const reasons = result.findings.map((finding) => `[${finding.severity.toUpperCase()}] ${finding.description}`).join("; ");

  if (result.blocked) {
    return {
      decision: "block",
      reason: `🛡️ VibeGuard blocked this message because it appears to contain sensitive information. ${reasons}. Remove the secret and send the message again.`,
    };
  }

  return {
    additionalContext: `⚠️ VibeGuard warning: the user's message may contain sensitive information. ${reasons}. Remind the user to avoid sharing secrets in chat.`,
  };
}
