import { getRuntimeRules, type RuntimeRules } from "../config/index.js";
import { readPolicy, shouldBlockSeverity, type Policy } from "../config/policy.js";
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

function getCodexPreToolScanResult(input: HookInput, runtimeRules: RuntimeRules): ScanResult | null {
  const result = getPreToolScanResult(input, runtimeRules);
  if (result) return result;

  if (/apply_patch/i.test(input.tool_name)) {
    return scanContent(JSON.stringify(input.tool_input), undefined, runtimeRules.secretRules);
  }

  const content = JSON.stringify(input.tool_input);
  return content === "{}" ? null : scanContent(content, undefined, runtimeRules.secretRules);
}

function getReasons(result: ScanResult): string {
  return result.findings.map((finding) => `[${finding.severity.toUpperCase()}] ${finding.description}`).join("; ");
}

function shouldBlockFindings(result: ScanResult, policy: Policy): boolean {
  return result.findings.some((finding) => shouldBlockSeverity(finding.severity, policy));
}

export function handlePreToolUse(
  input: HookInput,
  runtimeRules: RuntimeRules = getRuntimeRules(),
  policy: Policy = readPolicy()
): HookOutput | undefined {
  const result = getPreToolScanResult(input, runtimeRules);
  if (!result) return undefined;
  const blocked = shouldBlockFindings(result, policy);

  if (result.findings.length > 0) {
    try {
      logFindings(result.findings, blocked, input.tool_name, input.session_id, input.cwd);
    } catch {
      // Do not block operations if logging fails.
    }
  }

  if (result.findings.length === 0) return undefined;

  const reasons = getReasons(result);

  return {
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: blocked ? "deny" : "ask",
      permissionDecisionReason: blocked
        ? `🛡️ VibeGuard blocked this ${input.tool_name} action. ${reasons}. Review with \`vibeguard dashboard\` if you need event history.`
        : `⚠️ VibeGuard flagged this ${input.tool_name} action. ${reasons}. Confirm only if the operation is intentional.`,
    },
  };
}

export function handleCodexPreToolUse(
  input: HookInput,
  runtimeRules: RuntimeRules = getRuntimeRules(),
  policy: Policy = readPolicy()
): HookOutput | undefined {
  const result = getCodexPreToolScanResult(input, runtimeRules);
  if (!result) return undefined;
  const blocked = shouldBlockFindings(result, policy);

  if (result.findings.length > 0) {
    try {
      logFindings(result.findings, blocked, `Codex:${input.tool_name}`, input.session_id, input.cwd);
    } catch {
      // Do not block operations if logging fails.
    }
  }

  if (result.findings.length === 0) return undefined;

  const reasons = getReasons(result);
  const message = blocked
    ? `🛡️ VibeGuard blocked this Codex ${input.tool_name} action. ${reasons}. Review with \`vibeguard dashboard\` if you need event history.`
    : `⚠️ VibeGuard flagged this Codex ${input.tool_name} action. ${reasons}. Continue only if the operation is intentional.`;

  if (blocked) {
    return {
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "deny",
        permissionDecisionReason: message,
      },
    };
  }

  return {
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "allow",
      additionalContext: message,
    },
  };
}

export function handleUserPromptSubmit(
  input: UserPromptInput,
  runtimeRules: RuntimeRules = getRuntimeRules(),
  toolName = "UserPrompt",
  policy: Policy = readPolicy()
): UserPromptOutput | { additionalContext: string } | undefined {
  if (!input.prompt || input.prompt.trim().length === 0) return undefined;

  const result = scanContent(input.prompt, undefined, runtimeRules.secretRules);
  const blocked = shouldBlockFindings(result, policy);

  if (result.findings.length > 0) {
    try {
      logFindings(result.findings, blocked, toolName, input.session_id, input.cwd);
    } catch {
      // Do not block prompts if logging fails.
    }
  }

  if (result.findings.length === 0) return undefined;

  const reasons = result.findings.map((finding) => `[${finding.severity.toUpperCase()}] ${finding.description}`).join("; ");

  if (blocked) {
    return {
      decision: "block",
      reason: `🛡️ VibeGuard blocked this message because it appears to contain sensitive information. ${reasons}. Remove the secret and send the message again.`,
    };
  }

  return {
    additionalContext: `⚠️ VibeGuard warning: the user's message may contain sensitive information. ${reasons}. Remind the user to avoid sharing secrets in chat.`,
  };
}
