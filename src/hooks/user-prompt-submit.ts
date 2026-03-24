#!/usr/bin/env node

import type { UserPromptInput } from "../scanner/types.js";
import { handleUserPromptSubmit } from "./shared.js";

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

  const output = handleUserPromptSubmit(input);
  if (!output) process.exit(0);

  process.stdout.write(JSON.stringify(output));
  process.exit(0);
}

main().catch(() => {
  process.exit(0);
});
