#!/usr/bin/env node

import type { UserPromptInput } from "../scanner/types.js";
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
  const output = await executeCodexHook<UserPromptInput>(rawInput, "codex:UserPromptSubmit", async (input) => {
    const { handleCodexUserPromptSubmit } = await import("./shared.js");
    return handleCodexUserPromptSubmit(input);
  });
  if (!output) return;

  process.stdout.write(JSON.stringify(output));
}

main().catch(async () => {
  const output = await executeCodexHook("", "codex:UserPromptSubmit", async () => undefined);
  process.stdout.write(JSON.stringify(output));
});
