#!/usr/bin/env node

import { scanContent } from "../scanner/index.js";
import { logFindings } from "../store/index.js";
import type { UserPromptInput, UserPromptOutput } from "../scanner/types.js";

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString("utf-8");
}

async function main() {
  let input: UserPromptInput;
  try {
    const raw = await readStdin();
    input = JSON.parse(raw);
  } catch {
    process.exit(0);
  }

  const { prompt, session_id, cwd } = input;

  if (!prompt || prompt.trim().length === 0) {
    process.exit(0);
  }

  // Scan user prompt for secrets
  const result = scanContent(prompt);

  // Log findings
  if (result.findings.length > 0) {
    try {
      logFindings(result.findings, result.blocked, "UserPrompt", session_id, cwd);
    } catch {
      // Don't block if logging fails
    }
  }

  if (result.findings.length === 0) {
    process.exit(0);
  }

  const reasons = result.findings
    .map((f) => `[${f.severity.toUpperCase()}] ${f.description}`)
    .join("; ");

  if (result.blocked) {
    // Block the prompt entirely — secrets with critical/high severity
    const output: UserPromptOutput = {
      decision: "block",
      reason: `🛡️ VibeGuard BLOCKED: Your message contains sensitive information that should not be shared in chat. ${reasons}. Please remove the secret and try again.`,
    };
    process.stdout.write(JSON.stringify(output));
  } else {
    // Warn via additional context for medium/low severity
    const output = {
      additionalContext: `⚠️ VibeGuard WARNING: The user's message may contain sensitive information: ${reasons}. Remind the user to avoid sharing secrets in chat.`,
    };
    process.stdout.write(JSON.stringify(output));
  }

  process.exit(0);
}

main().catch(() => {
  process.exit(0);
});
