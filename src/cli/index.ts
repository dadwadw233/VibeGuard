#!/usr/bin/env node

import { mkdirSync } from "fs";
import { fileURLToPath } from "url";
import { getDashboardUrl, getInstallStatePath, getVibeGuardDir } from "../paths.js";
import { ClaudeAdapter } from "./adapters/claude.js";
import type { HostAdapter, InstallSummary } from "./adapters/types.js";
import { pluralize } from "./command-utils.js";
import { getRuntimeInstallMetadata } from "./health.js";
import { readInstallState, updateInstallState, type HostTarget } from "./install-state.js";
import { getMissingArtifacts, getRuntimePaths } from "./runtime.js";

const adapters: Record<HostTarget, HostAdapter> = {
  claude: new ClaudeAdapter(),
};

export function getCodexRemovalMessage(): string {
  return "Codex support has been removed from VibeGuard. Remove the old MCP registration with `codex mcp remove vibeguard` and use the Claude integration instead.";
}

function printUsage(): void {
  console.log(`
VibeGuard - Security guard for Claude Code

Usage:
  vibeguard install [--target claude]
  vibeguard doctor [--target claude]
  vibeguard launch claude -- [claude args...]
  vibeguard dashboard
  vibeguard mcp

Development:
  vibeguard hook
`);
}

export function parseTarget(args: string[]): HostTarget[] {
  const targetFlagIndex = args.findIndex((arg) => arg === "--target" || arg.startsWith("--target="));
  const rawTarget = targetFlagIndex === -1
    ? "claude"
    : args[targetFlagIndex].startsWith("--target=")
      ? args[targetFlagIndex].slice("--target=".length)
      : args[targetFlagIndex + 1];

  switch (rawTarget) {
    case "claude":
    case undefined:
      return ["claude"];
    case "codex":
    case "all":
      throw new Error(getCodexRemovalMessage());
    default:
      throw new Error(`Unsupported target '${rawTarget}'. Use claude.`);
  }
}

export function parseLaunchArgs(args: string[]): { host: HostTarget; passthrough: string[] } {
  const [host, ...rest] = args;
  if (host === "codex") {
    throw new Error(getCodexRemovalMessage());
  }

  if (host !== "claude") {
    throw new Error("Launch requires a host: `vibeguard launch claude -- <args>`.");
  }

  const separatorIndex = rest.indexOf("--");
  return {
    host,
    passthrough: separatorIndex === -1 ? rest : rest.slice(separatorIndex + 1),
  };
}

function ensureArtifacts(): ReturnType<typeof getRuntimePaths> {
  const runtime = getRuntimePaths();
  const missing = getMissingArtifacts(runtime);

  if (missing.length > 0) {
    const label = pluralize(missing.length, "artifact is", "artifacts are");
    throw new Error(
      `VibeGuard build ${label} missing:\n- ${missing.join("\n- ")}\nRun \`npm run build\` before using the CLI from source.`
    );
  }

  return runtime;
}

async function runInstall(args: string[]): Promise<number> {
  const runtime = ensureArtifacts();
  mkdirSync(getVibeGuardDir(), { recursive: true });
  const state = readInstallState();
  const targets = parseTarget(args);

  let failed = 0;
  for (const target of targets) {
    const summary = adapters[target].install(runtime, state);
    printInstallSummary(summary);

    if (summary.ok) {
      updateInstallState(runtime.packageRoot, (current) => ({
        ...current,
        runtime: getRuntimeInstallMetadata(runtime),
        targets: {
          ...current.targets,
          [target]: summary.state ?? current.targets[target],
        },
      }));
    } else {
      failed += 1;
    }
  }

  console.log(`Install state: ${getInstallStatePath()}`);
  return failed === 0 ? 0 : 1;
}

function printInstallSummary(summary: InstallSummary): void {
  const prefix = summary.ok ? "[ok]" : "[error]";
  console.log(`${prefix} ${summary.headline}`);
  for (const detail of summary.details) {
    console.log(`  - ${detail}`);
  }
}

async function runDoctor(args: string[]): Promise<number> {
  const runtime = ensureArtifacts();
  const state = readInstallState();
  const targets = parseTarget(args);

  let failed = 0;
  for (const target of targets) {
    const summary = adapters[target].doctor(runtime, state);
    console.log(`\n${target.toUpperCase()}`);
    for (const check of summary.checks) {
      console.log(`${check.ok ? "[ok]" : "[warn]"} ${check.label}: ${check.details}`);
    }

    if (!summary.ok) failed += 1;
  }

  console.log(`\nDashboard: ${getDashboardUrl()} via \`vibeguard dashboard\``);
  return failed === 0 ? 0 : 1;
}

async function runLaunch(args: string[]): Promise<number> {
  const runtime = ensureArtifacts();
  const state = readInstallState();
  const { host, passthrough } = parseLaunchArgs(args);
  return await adapters[host].launch(runtime, state, passthrough);
}

export async function main(argv = process.argv.slice(2)): Promise<void> {
  const [command, ...args] = argv;

  switch (command) {
    case "install":
      process.exit(await runInstall(args));
      return;
    case "doctor":
      process.exit(await runDoctor(args));
      return;
    case "launch":
      process.exit(await runLaunch(args));
      return;
    case "codex":
      throw new Error(getCodexRemovalMessage());
    case "dashboard":
      await import("../dashboard/server.js");
      return;
    case "hook":
      await import("../hooks/pre-tool-use.js");
      return;
    case "mcp":
      await import("../mcp/server.js");
      return;
    case undefined:
    case "help":
    case "--help":
    case "-h":
      printUsage();
      return;
    default:
      console.error(`Unknown command '${command}'.`);
      printUsage();
      process.exit(1);
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`VibeGuard error: ${message}`);
    process.exit(1);
  });
}
