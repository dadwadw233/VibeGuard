import { chmodSync, mkdtempSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { afterEach, describe, expect, it } from "vitest";
import { evaluateCodexHook, queryCodexHooks } from "../codex-hook-status.js";

describe("Codex effective hook status", () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    for (const dir of tempDirs.splice(0)) {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("queries hooks/list after the app-server initialize handshake", async () => {
    const tempDir = mkdtempSync(join(tmpdir(), "vibeguard-codex-app-server-"));
    tempDirs.push(tempDir);
    const executable = join(tempDir, "fake-codex");
    const hook = createHook({ command: "node /managed/pre-tool.js" });
    writeFileSync(executable, `#!${process.execPath}
import readline from "node:readline";
const lines = readline.createInterface({ input: process.stdin });
lines.on("line", (line) => {
  const request = JSON.parse(line);
  if (request.id === 0) {
    process.stdout.write(JSON.stringify({ id: 0, result: { userAgent: "fake" } }) + "\\n");
  }
  if (request.id === 1) {
    process.stdout.write(JSON.stringify({ id: 1, result: { data: [{ cwd: ${JSON.stringify(tempDir)}, hooks: [${JSON.stringify(hook)}], warnings: [], errors: [] }] } }) + "\\n");
  }
});
`, "utf-8");
    chmodSync(executable, 0o755);

    const result = await queryCodexHooks(executable, tempDir, "0.2.1", 2_000);

    expect(result.ok).toBe(true);
    expect(result.hooks).toEqual([hook]);
  });

  it("requires hooks to be enabled and trusted", () => {
    const command = "node /managed/pre-tool.js";
    expect(evaluateCodexHook([createHook({ command })], "preToolUse", command).ok).toBe(true);
    expect(evaluateCodexHook([createHook({ command, enabled: false })], "preToolUse", command)).toEqual(
      expect.objectContaining({ ok: false, details: expect.stringContaining("disabled") })
    );
    expect(evaluateCodexHook([createHook({ command, trustStatus: "untrusted" })], "preToolUse", command)).toEqual(
      expect.objectContaining({ ok: false, details: expect.stringContaining("not trusted") })
    );
  });

  it("accepts managed hooks without user trust state", () => {
    const command = "node /managed/prompt.js";
    const result = evaluateCodexHook(
      [createHook({ eventName: "userPromptSubmit", command, isManaged: true, trustStatus: "unknown" })],
      "userPromptSubmit",
      command
    );

    expect(result.ok).toBe(true);
  });
});

function createHook(overrides: Record<string, unknown> = {}) {
  return {
    key: "test-hook",
    eventName: "preToolUse",
    handlerType: "command",
    command: "node /managed/pre-tool.js",
    enabled: true,
    isManaged: false,
    trustStatus: "trusted",
    ...overrides,
  };
}
