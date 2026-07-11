import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getHookHealthPath } from "../../paths.js";
import { readHookHealthState } from "../../health-state.js";
import { executeCodexHook } from "../codex-runtime.js";

describe("Codex hook runtime health", () => {
  let tempDir: string;
  let previousHome: string | undefined;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "vibeguard-hook-health-"));
    previousHome = process.env.VIBEGUARD_HOME_DIR;
    process.env.VIBEGUARD_HOME_DIR = tempDir;
  });

  afterEach(() => {
    process.env.VIBEGUARD_HOME_DIR = previousHome;
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("records invalid JSON without persisting raw hook input", async () => {
    const raw = "not-json sk-ant-" + "a".repeat(80);
    const output = await executeCodexHook(raw, "codex:PreToolUse", async () => undefined);

    expect(output).toEqual(expect.objectContaining({
      systemMessage: expect.stringContaining("fail-open"),
    }));
    expect(readHookHealthState().degradations["codex:PreToolUse"]?.reason).toBe("invalid-json");
    expect(readFileSync(getHookHealthPath(), "utf-8")).not.toContain("sk-ant-");
  });

  it("records handler failures and clears them after a successful invocation", async () => {
    await executeCodexHook("{}", "codex:PreToolUse", async () => {
      throw new Error("simulated failure");
    });
    expect(readHookHealthState().degradations["codex:PreToolUse"]?.reason).toBe("handler-error");

    const expected = { systemMessage: "safe" };
    const output = await executeCodexHook("{}", "codex:PreToolUse", async () => expected);

    expect(output).toEqual(expected);
    expect(readHookHealthState().degradations).not.toHaveProperty("codex:PreToolUse");
  });

  it("does not clear degradation recorded by a different hook", async () => {
    await executeCodexHook("broken", "codex:UserPromptSubmit", async () => undefined);
    await executeCodexHook("{}", "codex:PreToolUse", async () => undefined);

    expect(readHookHealthState().degradations).toHaveProperty("codex:UserPromptSubmit");
  });

  it("ignores malformed degradation entries", () => {
    writeFileSync(getHookHealthPath(), JSON.stringify({
      version: 1,
      degradations: {
        broken: { source: 42, reason: "unknown", observedAt: null },
      },
    }), "utf-8");

    expect(readHookHealthState().degradations).toEqual({});
  });
});
