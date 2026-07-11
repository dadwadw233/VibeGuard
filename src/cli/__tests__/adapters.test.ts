import { chmodSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ClaudeAdapter } from "../adapters/claude.js";
import { CodexAdapter } from "../adapters/codex.js";
import type { InstallState } from "../install-state.js";
import type { RuntimePaths } from "../runtime.js";

function writeExecutable(path: string, content: string): void {
  writeFileSync(path, content, "utf-8");
  chmodSync(path, 0o755);
}

function createRuntime(tempDir: string): RuntimePaths {
  const distDir = join(tempDir, "dist");
  mkdirSync(join(distDir, "hooks"), { recursive: true });
  mkdirSync(join(distDir, "mcp"), { recursive: true });
  mkdirSync(join(distDir, "dashboard", "public"), { recursive: true });
  writeFileSync(join(distDir, "hooks", "pre-tool-use.js"), "", "utf-8");
  writeFileSync(join(distDir, "hooks", "user-prompt-submit.js"), "", "utf-8");
  writeFileSync(join(distDir, "hooks", "codex-pre-tool-use.js"), "", "utf-8");
  writeFileSync(join(distDir, "hooks", "codex-user-prompt-submit.js"), "", "utf-8");
  writeFileSync(join(distDir, "mcp", "server.js"), "", "utf-8");
  writeFileSync(join(distDir, "dashboard", "server.js"), "", "utf-8");

  return {
    packageRoot: process.cwd(),
    packageName: "@embodot/vibeguard",
    packageVersion: "0.1.1-test",
    distDir,
    cliEntry: join(distDir, "cli.js"),
    preToolUseHook: join(distDir, "hooks", "pre-tool-use.js"),
    userPromptHook: join(distDir, "hooks", "user-prompt-submit.js"),
    codexPreToolUseHook: join(distDir, "hooks", "codex-pre-tool-use.js"),
    codexUserPromptHook: join(distDir, "hooks", "codex-user-prompt-submit.js"),
    mcpServer: join(distDir, "mcp", "server.js"),
    dashboardServer: join(distDir, "dashboard", "server.js"),
    dashboardPublicDir: join(distDir, "dashboard", "public"),
    nodeBinary: process.execPath,
  };
}

describe("host adapters", () => {
  let tempDir: string;
  let binDir: string;
  let previousPath: string | undefined;
  let previousHome: string | undefined;
  let previousClaudeDir: string | undefined;
  let previousCodexDir: string | undefined;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "vibeguard-adapter-"));
    binDir = join(tempDir, "bin");
    mkdirSync(binDir, { recursive: true });
    previousPath = process.env.PATH;
    previousHome = process.env.VIBEGUARD_HOME_DIR;
    previousClaudeDir = process.env.VIBEGUARD_CLAUDE_CONFIG_DIR;
    previousCodexDir = process.env.VIBEGUARD_CODEX_CONFIG_DIR;
    process.env.PATH = `${binDir}:${previousPath ?? ""}`;
    process.env.VIBEGUARD_HOME_DIR = join(tempDir, "vibeguard-home");
    process.env.VIBEGUARD_CLAUDE_CONFIG_DIR = join(tempDir, "claude-home");
    process.env.VIBEGUARD_CODEX_CONFIG_DIR = join(tempDir, "codex-home");
  });

  afterEach(() => {
    process.env.PATH = previousPath;
    process.env.VIBEGUARD_HOME_DIR = previousHome;
    process.env.VIBEGUARD_CLAUDE_CONFIG_DIR = previousClaudeDir;
    process.env.VIBEGUARD_CODEX_CONFIG_DIR = previousCodexDir;
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("installs and diagnoses Claude integration using managed hooks and MCP registration", () => {
    const claudeLog = join(tempDir, "claude-mcp.log");
    writeExecutable(join(binDir, "claude"), `#!/bin/sh
STATE="${claudeLog}"
if [ "$1" = "mcp" ] && [ "$2" = "get" ] && [ "$3" = "vibeguard" ]; then
  [ -f "$STATE" ] && exit 0
  exit 1
fi
if [ "$1" = "mcp" ] && [ "$2" = "add" ]; then
  printf '%s\\n' "$@" > "$STATE"
  exit 0
fi
if [ "$1" = "mcp" ] && [ "$2" = "remove" ]; then
  rm -f "$STATE"
  exit 0
fi
exit 0
`);

    const adapter = new ClaudeAdapter();
    const runtime = createRuntime(tempDir);
    const summary = adapter.install(runtime, { version: 1, packageRoot: "", updatedAt: "", targets: {} });

    expect(summary.ok).toBe(true);
    expect(summary.state?.commands?.preToolUse).toContain("pre-tool-use.js");
    expect(readFileSync(join(tempDir, "claude-home", "settings.json"), "utf-8")).toContain("Bash|Write|Edit|Read");
    const mcpArgs = readFileSync(claudeLog, "utf-8");
    expect(mcpArgs).toContain("--scope");
    expect(mcpArgs).toContain("user");

    const doctor = adapter.doctor(runtime, {
      version: 1,
      packageRoot: tempDir,
      updatedAt: "",
      targets: { claude: summary.state },
    } as InstallState);

    expect(doctor.ok).toBe(true);
    expect(mcpArgs).toContain("vibeguard");
  });

  it("uninstalls Claude integration by removing managed hooks and MCP registration", () => {
    const claudeLog = join(tempDir, "claude-mcp.log");
    writeExecutable(join(binDir, "claude"), `#!/bin/sh
STATE="${claudeLog}"
if [ "$1" = "mcp" ] && [ "$2" = "get" ] && [ "$3" = "vibeguard" ]; then
  [ -f "$STATE" ] && exit 0
  exit 1
fi
if [ "$1" = "mcp" ] && [ "$2" = "add" ]; then
  printf '%s\\n' "$@" > "$STATE"
  exit 0
fi
if [ "$1" = "mcp" ] && [ "$2" = "remove" ] && [ "$3" = "vibeguard" ]; then
  rm -f "$STATE"
  exit 0
fi
exit 0
`);

    const adapter = new ClaudeAdapter();
    const runtime = createRuntime(tempDir);
    const state = {
      version: 1 as const,
      packageRoot: tempDir,
      updatedAt: "",
      targets: {},
    } as InstallState;

    const installSummary = adapter.install(runtime, state);
    expect(installSummary.ok).toBe(true);
    expect(readFileSync(claudeLog, "utf-8")).toContain("vibeguard");

    const uninstallSummary = adapter.uninstall(runtime, {
      ...state,
      targets: { claude: installSummary.state },
    });

    expect(uninstallSummary.ok).toBe(true);
    const settings = readFileSync(join(tempDir, "claude-home", "settings.json"), "utf-8");
    expect(settings).not.toContain("pre-tool-use.js");
    expect(settings).not.toContain("user-prompt-submit.js");
    expect(() => readFileSync(claudeLog, "utf-8")).toThrow();
  });

  it("installs, effectively diagnoses, and uninstalls Codex hooks without removing user hooks", async () => {
    const hooksPath = join(tempDir, "codex-home", "hooks.json");
    mkdirSync(join(tempDir, "codex-home"), { recursive: true });
    writeFileSync(hooksPath, JSON.stringify({
      hooks: {
        PostToolUse: [
          {
            matcher: "*",
            hooks: [{ type: "command", command: "node /custom/hook.js" }],
          },
        ],
      },
    }), "utf-8");

    const adapter = new CodexAdapter();
    const runtime = createRuntime(tempDir);
    const state = {
      version: 1 as const,
      packageRoot: tempDir,
      updatedAt: "",
      targets: {},
    } as InstallState;

    const installSummary = adapter.install(runtime, state);
    expect(installSummary.ok).toBe(true);
    expect(installSummary.state?.commands?.preToolUse).toContain("codex-pre-tool-use.js");
    expect(installSummary.state?.commands?.userPrompt).toContain("codex-user-prompt-submit.js");

    const installedHooks = readFileSync(hooksPath, "utf-8");
    expect(installedHooks).toContain("codex-pre-tool-use.js");
    expect(installedHooks).toContain("codex-user-prompt-submit.js");
    expect(installedHooks).toContain("/custom/hook.js");

    const effectiveHooks = [
      {
        eventName: "preToolUse",
        command: installSummary.state?.commands?.preToolUse,
        enabled: true,
        isManaged: false,
        trustStatus: "trusted",
      },
      {
        eventName: "userPromptSubmit",
        command: installSummary.state?.commands?.userPrompt,
        enabled: true,
        isManaged: false,
        trustStatus: "trusted",
      },
    ];
    writeExecutable(join(binDir, "codex"), `#!${process.execPath}
import readline from "node:readline";
const lines = readline.createInterface({ input: process.stdin });
lines.on("line", (line) => {
  const request = JSON.parse(line);
  if (request.id === 0) process.stdout.write(JSON.stringify({ id: 0, result: {} }) + "\\n");
  if (request.id === 1) process.stdout.write(JSON.stringify({ id: 1, result: { data: [{ hooks: ${JSON.stringify(effectiveHooks)}, warnings: [], errors: [] }] } }) + "\\n");
});
`);

    const doctor = await adapter.doctor(runtime, {
      ...state,
      targets: { codex: installSummary.state },
    });
    expect(doctor.ok).toBe(true);
    expect(doctor.checks.find((check) => check.label === "PreToolUse hook")?.details).toContain(
      "enabled and trusted"
    );

    const uninstallSummary = adapter.uninstall(runtime, {
      ...state,
      targets: { codex: installSummary.state },
    });
    expect(uninstallSummary.ok).toBe(true);
    const uninstalledHooks = readFileSync(hooksPath, "utf-8");
    expect(uninstalledHooks).not.toContain("codex-pre-tool-use.js");
    expect(uninstalledHooks).not.toContain("codex-user-prompt-submit.js");
    expect(uninstalledHooks).toContain("/custom/hook.js");
  });
});
