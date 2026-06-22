#!/usr/bin/env node

import type { HookInput } from "../scanner/types.js";
import { handleCodexPreToolUse } from "./shared.js";

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
    input = JSON.parse(await readStdin()) as HookInput;
  } catch {
    process.exit(0);
  }

  const output = handleCodexPreToolUse(input);
  if (!output) process.exit(0);

  process.stdout.write(JSON.stringify(output));
  process.exit(0);
}

main().catch(() => {
  process.exit(0);
});
