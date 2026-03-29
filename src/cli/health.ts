import type { DoctorCheck } from "./adapters/types.js";
import { runCommand, type CommandResult } from "./command-utils.js";
import type { InstallState, RuntimeInstallMetadata } from "./install-state.js";
import type { RuntimePaths } from "./runtime.js";

export type CommandRunner = (command: string, args: string[]) => CommandResult;

export function getRuntimeInstallMetadata(runtime: RuntimePaths): RuntimeInstallMetadata {
  return {
    nodeBinary: runtime.nodeBinary,
    nodeVersion: process.version,
    packageVersion: runtime.packageVersion,
  };
}

export function getRuntimeConsistencyCheck(runtime: RuntimePaths, state: InstallState): DoctorCheck {
  const installedRuntime = state.runtime;
  if (!installedRuntime) {
    return {
      label: "Runtime metadata",
      ok: true,
      details: "No runtime metadata recorded yet. Re-run `vibeguard install` to enable runtime mismatch diagnostics.",
    };
  }

  const mismatches: string[] = [];
  if (installedRuntime.nodeVersion !== process.version) {
    mismatches.push(`node version installed=${installedRuntime.nodeVersion}, current=${process.version}`);
  }
  if (installedRuntime.nodeBinary !== runtime.nodeBinary) {
    mismatches.push(`node binary installed=${installedRuntime.nodeBinary}, current=${runtime.nodeBinary}`);
  }
  if (installedRuntime.packageVersion !== runtime.packageVersion) {
    mismatches.push(`package version installed=${installedRuntime.packageVersion}, current=${runtime.packageVersion}`);
  }

  if (mismatches.length > 0) {
    return {
      label: "Runtime metadata",
      ok: false,
      details: `Runtime mismatch detected (${mismatches.join("; ")}). Re-run \`vibeguard install --target claude\` in this shell/runtime.`,
    };
  }

  return {
    label: "Runtime metadata",
    ok: true,
    details: `Node ${process.version} at ${runtime.nodeBinary}.`,
  };
}

function formatNativeFailure(result: CommandResult): string {
  const message = result.stderr.trim() || result.stdout.trim() || "unknown error";
  const normalized = message.replace(/\s+/g, " ");
  const hasAbiHint =
    normalized.includes("NODE_MODULE_VERSION") ||
    normalized.includes("was compiled against a different Node.js version") ||
    normalized.includes("better_sqlite3.node");
  const remediation = hasAbiHint
    ? "Run `npm rebuild better-sqlite3` (or reinstall the global package in this Node version)."
    : "Run `npm rebuild better-sqlite3` and retry.";

  return `Failed to load native dependency better-sqlite3: ${normalized}. ${remediation}`;
}

export function getBetterSqliteHealthCheck(
  runtime: RuntimePaths,
  run: CommandRunner = runCommand
): DoctorCheck {
  const script =
    "import('better-sqlite3').then(() => process.exit(0)).catch((err) => { console.error(err && err.message ? err.message : String(err)); process.exit(1); });";
  const probe = run(runtime.nodeBinary, ["-e", script]);

  if (probe.ok) {
    return {
      label: "Native module (better-sqlite3)",
      ok: true,
      details: "Loaded successfully.",
    };
  }

  return {
    label: "Native module (better-sqlite3)",
    ok: false,
    details: formatNativeFailure(probe),
  };
}
