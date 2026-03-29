import { mkdtempSync, readFileSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getUpdateStatePath } from "../../paths.js";
import type { CommandResult } from "../command-utils.js";
import { compareVersions, maybeAutoUpdate } from "../auto-update.js";
import type { RuntimePaths } from "../runtime.js";

function createRuntime(packageVersion: string = "0.1.0"): RuntimePaths {
  return {
    packageRoot: "/tmp/vibeguard",
    packageName: "@embodot/vibeguard",
    packageVersion,
    distDir: "/tmp/vibeguard/dist",
    cliEntry: "/tmp/vibeguard/dist/cli.js",
    preToolUseHook: "/tmp/vibeguard/dist/hooks/pre-tool-use.js",
    userPromptHook: "/tmp/vibeguard/dist/hooks/user-prompt-submit.js",
    mcpServer: "/tmp/vibeguard/dist/mcp/server.js",
    dashboardServer: "/tmp/vibeguard/dist/dashboard/server.js",
    dashboardPublicDir: "/tmp/vibeguard/dist/dashboard/public",
    nodeBinary: process.execPath,
  };
}

interface RunCall {
  command: string;
  args: string[];
  options?: { timeoutMs?: number; env?: NodeJS.ProcessEnv };
}

describe("auto update", () => {
  let tempDir: string;
  let previousHome: string | undefined;
  let previousDisable: string | undefined;
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "vibeguard-auto-update-"));
    previousHome = process.env.VIBEGUARD_HOME_DIR;
    previousDisable = process.env.VIBEGUARD_DISABLE_AUTO_UPDATE;
    process.env.VIBEGUARD_HOME_DIR = tempDir;
    delete process.env.VIBEGUARD_DISABLE_AUTO_UPDATE;
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
    process.env.VIBEGUARD_HOME_DIR = previousHome;
    process.env.VIBEGUARD_DISABLE_AUTO_UPDATE = previousDisable;
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("compares semantic versions by major/minor/patch", () => {
    expect(compareVersions("0.1.0", "0.1.1")).toBe(-1);
    expect(compareVersions("1.2.0", "1.1.9")).toBe(1);
    expect(compareVersions("1.0.0", "1.0.0")).toBe(0);
  });

  it("skips internal hook and mcp commands", () => {
    const calls: RunCall[] = [];
    const run = (command: string, args: string[], options?: RunCall["options"]): CommandResult => {
      calls.push({ command, args, options });
      return { ok: true, status: 0, stdout: "", stderr: "" };
    };

    const runtime = createRuntime();
    maybeAutoUpdate(runtime, "hook", run);
    maybeAutoUpdate(runtime, "mcp", run);

    expect(calls).toHaveLength(0);
  });

  it("attempts global npm update when a newer package version exists", () => {
    const calls: RunCall[] = [];
    const run = (command: string, args: string[], options?: RunCall["options"]): CommandResult => {
      calls.push({ command, args, options });
      if (args[0] === "view") {
        return { ok: true, status: 0, stdout: "\"0.2.0\"\n", stderr: "" };
      }

      if (args[0] === "install") {
        return { ok: true, status: 0, stdout: "", stderr: "" };
      }

      return { ok: false, status: 1, stdout: "", stderr: "unexpected command" };
    };

    const runtime = createRuntime("0.1.0");
    maybeAutoUpdate(runtime, "doctor", run);

    expect(calls).toHaveLength(2);
    expect(calls[0]).toMatchObject({
      command: "npm",
      args: ["view", "@embodot/vibeguard", "version", "--json"],
    });
    expect(calls[1]).toMatchObject({
      command: "npm",
      args: ["install", "-g", "@embodot/vibeguard@0.2.0"],
    });
    expect(calls[1].options?.env?.VIBEGUARD_DISABLE_AUTO_UPDATE).toBe("1");

    const state = JSON.parse(readFileSync(getUpdateStatePath(), "utf-8")) as {
      latestVersion?: string;
      lastAttemptedVersion?: string;
      lastAttemptOk?: boolean;
    };
    expect(state.latestVersion).toBe("0.2.0");
    expect(state.lastAttemptedVersion).toBe("0.2.0");
    expect(state.lastAttemptOk).toBe(true);
  });

  it("respects cooldown and does not repeat update attempts immediately", () => {
    let installCalls = 0;
    const run = (_command: string, args: string[]): CommandResult => {
      if (args[0] === "view") {
        return { ok: true, status: 0, stdout: "\"0.2.0\"\n", stderr: "" };
      }

      if (args[0] === "install") {
        installCalls += 1;
        return { ok: true, status: 0, stdout: "", stderr: "" };
      }

      return { ok: false, status: 1, stdout: "", stderr: "unexpected command" };
    };

    const runtime = createRuntime("0.1.0");
    maybeAutoUpdate(runtime, "launch", run);
    maybeAutoUpdate(runtime, "launch", run);

    expect(installCalls).toBe(1);
  });

  it("supports disabling auto update via environment variable", () => {
    process.env.VIBEGUARD_DISABLE_AUTO_UPDATE = "1";
    const run = vi.fn<[string, string[]], CommandResult>(() => ({
      ok: true,
      status: 0,
      stdout: "",
      stderr: "",
    }));

    maybeAutoUpdate(createRuntime(), "doctor", run);
    expect(run).not.toHaveBeenCalled();
  });
});
