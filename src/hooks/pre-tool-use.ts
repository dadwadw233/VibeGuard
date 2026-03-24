#!/usr/bin/env node

import { scanContent, scanCommand, scanFilePath } from "../scanner/index.js";
import { logFindings } from "../store/index.js";
import type { HookInput, HookOutput, ScanResult } from "../scanner/types.js";

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString("utf-8");
}

async function main() {
  let input: HookInput;
  try {
    const raw = await readStdin();
    input = JSON.parse(raw);
  } catch {
    // If we can't parse input, allow the operation
    process.exit(0);
  }

  const { tool_name, tool_input, session_id, cwd } = input;
  let result: ScanResult;

  switch (tool_name) {
    case "Bash": {
      const command = (tool_input.command as string) ?? "";
      result = scanCommand(command);
      break;
    }
    case "Write": {
      const content = (tool_input.content as string) ?? "";
      const filePath = tool_input.file_path as string | undefined;
      result = scanContent(content, filePath);
      break;
    }
    case "Edit": {
      const newString = (tool_input.new_string as string) ?? "";
      const filePath = tool_input.file_path as string | undefined;
      result = scanContent(newString, filePath);
      break;
    }
    case "Read": {
      const filePath = (tool_input.file_path as string) ?? "";
      result = scanFilePath(filePath);
      break;
    }
    default:
      // Unknown tool, allow
      process.exit(0);
  }

  // Log findings to the event store
  if (result.findings.length > 0) {
    try {
      logFindings(result.findings, result.blocked, tool_name, session_id, cwd);
    } catch {
      // Don't block operations if logging fails
    }
  }

  if (result.findings.length === 0) {
    // No findings, allow the operation silently
    process.exit(0);
  }

  // Build the reason string
  const reasons = result.findings.map((f) => `[${f.severity.toUpperCase()}] ${f.description}`).join("; ");

  const output: HookOutput = {
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: result.blocked ? "deny" : "ask",
      permissionDecisionReason: result.blocked
        ? `🛡️ VibeGuard BLOCKED: ${reasons}`
        : `⚠️ VibeGuard WARNING: ${reasons}`,
    },
  };

  process.stdout.write(JSON.stringify(output));
  process.exit(0);
}

main().catch(() => {
  // On any unexpected error, allow the operation
  process.exit(0);
});
