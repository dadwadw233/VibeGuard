import { mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { describe, expect, it } from "vitest";
import { recordHookDegradation } from "../../health-state.js";
import {
  getBetterSqliteHealthCheck,
  getHookRuntimeHealthCheck,
  getRuntimeConsistencyCheck,
  getRuntimeInstallMetadata,
} from "../health.js";
import type { InstallState } from "../install-state.js";
import type { RuntimePaths } from "../runtime.js";

function createRuntimePaths(): RuntimePaths {
  return {
    packageRoot: "/tmp/vibeguard",
    packageName: "@embodot/vibeguard",
    packageVersion: "0.1.1",
    distDir: "/tmp/vibeguard/dist",
    cliEntry: "/tmp/vibeguard/dist/cli.js",
    preToolUseHook: "/tmp/vibeguard/dist/hooks/pre-tool-use.js",
    userPromptHook: "/tmp/vibeguard/dist/hooks/user-prompt-submit.js",
    codexPreToolUseHook: "/tmp/vibeguard/dist/hooks/codex-pre-tool-use.js",
    codexUserPromptHook: "/tmp/vibeguard/dist/hooks/codex-user-prompt-submit.js",
    mcpServer: "/tmp/vibeguard/dist/mcp/server.js",
    dashboardServer: "/tmp/vibeguard/dist/dashboard/server.js",
    dashboardPublicDir: "/tmp/vibeguard/dist/dashboard/public",
    nodeBinary: process.execPath,
  };
}

function createInstallState(runtime?: InstallState["runtime"]): InstallState {
  return {
    version: 1,
    packageRoot: "/tmp/vibeguard",
    updatedAt: new Date().toISOString(),
    runtime,
    targets: {},
  };
}

describe("cli health checks", () => {
  it("captures runtime metadata from current process and package", () => {
    const runtime = createRuntimePaths();
    expect(getRuntimeInstallMetadata(runtime)).toEqual({
      nodeBinary: process.execPath,
      nodeVersion: process.version,
      packageVersion: "0.1.1",
    });
  });

  it("treats missing runtime metadata as non-fatal", () => {
    const check = getRuntimeConsistencyCheck(createRuntimePaths(), createInstallState(undefined));
    expect(check.ok).toBe(true);
    expect(check.details).toContain("No runtime metadata recorded yet");
  });

  it("flags mismatched runtime metadata", () => {
    const runtime = createRuntimePaths();
    const state = createInstallState({
      nodeBinary: "/usr/local/bin/node",
      nodeVersion: "v20.0.0",
      packageVersion: "0.1.0",
    });
    const check = getRuntimeConsistencyCheck(runtime, state);
    expect(check.ok).toBe(false);
    expect(check.details).toContain("Runtime mismatch detected");
  });

  it("reports healthy better-sqlite3 probe results", () => {
    const calls: unknown[][] = [];
    const check = getBetterSqliteHealthCheck(createRuntimePaths(), ((...args: unknown[]) => {
      calls.push(args);
      return {
        ok: true,
        status: 0,
        stdout: "",
        stderr: "",
      };
    }) as never);
    expect(check.ok).toBe(true);
    expect(check.details).toContain("Loaded successfully");
    expect(calls[0]?.[2]).toEqual({ cwd: "/tmp/vibeguard" });
  });

  it("returns actionable remediation for ABI mismatch probe failures", () => {
    const check = getBetterSqliteHealthCheck(createRuntimePaths(), () => ({
      ok: false,
      status: 1,
      stdout: "",
      stderr: "was compiled against a different Node.js version using NODE_MODULE_VERSION 141",
    }));
    expect(check.ok).toBe(false);
    expect(check.details).toContain("npm rebuild better-sqlite3");
  });

  it("reports recorded Codex fail-open degradation", () => {
    const tempDir = mkdtempSync(join(tmpdir(), "vibeguard-doctor-health-"));
    const previousHome = process.env.VIBEGUARD_HOME_DIR;
    process.env.VIBEGUARD_HOME_DIR = tempDir;
    try {
      recordHookDegradation("codex:PreToolUse", "handler-error");
      const check = getHookRuntimeHealthCheck("codex");

      expect(check.ok).toBe(false);
      expect(check.details).toContain("PreToolUse");
      expect(check.details).toContain("fail-open");
    } finally {
      process.env.VIBEGUARD_HOME_DIR = previousHome;
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
