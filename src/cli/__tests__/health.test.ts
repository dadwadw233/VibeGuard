import { describe, expect, it } from "vitest";
import { getBetterSqliteHealthCheck, getRuntimeConsistencyCheck, getRuntimeInstallMetadata } from "../health.js";
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
    const check = getBetterSqliteHealthCheck(createRuntimePaths(), () => ({
      ok: true,
      status: 0,
      stdout: "",
      stderr: "",
    }));
    expect(check.ok).toBe(true);
    expect(check.details).toContain("Loaded successfully");
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
});
