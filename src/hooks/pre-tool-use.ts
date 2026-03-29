#!/usr/bin/env node

import type { HookInput } from "../scanner/types.js";
import { handlePreToolUse } from "./shared.js";

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

  const output = handlePreToolUse(input);
  if (!output) process.exit(0);

  process.stdout.write(JSON.stringify(output));
  process.exit(0);
}

main().catch(() => {
  // On any unexpected error, allow the operation
  process.exit(0);
});
