#!/usr/bin/env node

import type { HookInput } from "../scanner/types.js";
import { executeCodexHook } from "./codex-runtime.js";

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString("utf-8");
}

async function main() {
  const rawInput = await readStdin();
  const output = await executeCodexHook<HookInput>(rawInput, "codex:PreToolUse", async (input) => {
    const { handleCodexPreToolUse } = await import("./shared.js");
    return handleCodexPreToolUse(input);
  });
  if (!output) return;

  process.stdout.write(JSON.stringify(output));
}

main().catch(async () => {
  const output = await executeCodexHook("", "codex:PreToolUse", async () => undefined);
  process.stdout.write(JSON.stringify(output));
});
