import { mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname } from "path";
import { getUpdateStatePath } from "../paths.js";
import { runCommand, type CommandResult } from "./command-utils.js";
import type { RuntimePaths } from "./runtime.js";

interface UpdateState {
  lastCheckedAt?: string;
  latestVersion?: string;
  currentVersionAtLastCheck?: string;
  lastAttemptedVersion?: string;
  lastAttemptAt?: string;
  lastAttemptOk?: boolean;
}

type CommandName = string | undefined;
type CommandRunner = (command: string, args: string[], options?: { timeoutMs?: number; env?: NodeJS.ProcessEnv }) => CommandResult;

const DEFAULT_CHECK_INTERVAL_MS = 12 * 60 * 60 * 1000;
const DEFAULT_ATTEMPT_COOLDOWN_MS = 24 * 60 * 60 * 1000;
const DEFAULT_VIEW_TIMEOUT_MS = 2500;
const DEFAULT_INSTALL_TIMEOUT_MS = 120000;

function readNumberEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function isTruthy(value: string | undefined): boolean {
  if (!value) return false;
  return ["1", "true", "yes", "on"].includes(value.toLowerCase());
}

function readUpdateState(): UpdateState {
  const filePath = getUpdateStatePath();

  try {
    return JSON.parse(readFileSync(filePath, "utf-8")) as UpdateState;
  } catch {
    return {};
  }
}

function writeUpdateState(state: UpdateState): void {
  const filePath = getUpdateStatePath();
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(state, null, 2)}\n`, "utf-8");
}

function parseVersion(version: string): [number, number, number] | null {
  const core = version.split("-")[0]?.trim();
  if (!core) return null;
  const [majorRaw, minorRaw, patchRaw] = core.split(".");
  const major = Number.parseInt(majorRaw ?? "", 10);
  const minor = Number.parseInt(minorRaw ?? "0", 10);
  const patch = Number.parseInt(patchRaw ?? "0", 10);

  if (!Number.isFinite(major) || !Number.isFinite(minor) || !Number.isFinite(patch)) {
    return null;
  }

  return [major, minor, patch];
}

export function compareVersions(current: string, target: string): number {
  const left = parseVersion(current);
  const right = parseVersion(target);
  if (!left || !right) return 0;

  for (let index = 0; index < 3; index += 1) {
    if (left[index] < right[index]) return -1;
    if (left[index] > right[index]) return 1;
  }

  return 0;
}

function shouldSkipForCommand(command: CommandName): boolean {
  return command === "hook" || command === "mcp";
}

function parseLatestVersion(stdout: string): string | undefined {
  const trimmed = stdout.trim();
  if (!trimmed) return undefined;

  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (typeof parsed === "string") {
      return parsed;
    }
  } catch {
    if (/^[0-9]+\.[0-9]+\.[0-9]+/.test(trimmed)) {
      return trimmed;
    }
  }

  return undefined;
}

function getLatestVersion(
  packageName: string,
  run: CommandRunner
): string | undefined {
  const result = run("npm", ["view", packageName, "version", "--json"], {
    timeoutMs: readNumberEnv("VIBEGUARD_UPDATE_CHECK_TIMEOUT_MS", DEFAULT_VIEW_TIMEOUT_MS),
  });

  if (!result.ok) return undefined;
  return parseLatestVersion(result.stdout);
}

function summarizeFailure(result: CommandResult): string {
  const message = result.stderr.trim() || result.stdout.trim() || "unknown error";
  return message.replace(/\s+/g, " ");
}

export function maybeAutoUpdate(
  runtime: RuntimePaths,
  command: CommandName,
  run: CommandRunner = runCommand
): void {
  try {
    if (isTruthy(process.env.VIBEGUARD_DISABLE_AUTO_UPDATE)) return;
    if (shouldSkipForCommand(command)) return;

    const state = readUpdateState();
    const now = Date.now();
    const checkIntervalMs = readNumberEnv("VIBEGUARD_UPDATE_CHECK_INTERVAL_MS", DEFAULT_CHECK_INTERVAL_MS);
    const attemptCooldownMs = readNumberEnv("VIBEGUARD_UPDATE_ATTEMPT_COOLDOWN_MS", DEFAULT_ATTEMPT_COOLDOWN_MS);
    const lastCheckedAt = Date.parse(state.lastCheckedAt ?? "");
    const isCheckStale = !Number.isFinite(lastCheckedAt) || now - lastCheckedAt >= checkIntervalMs;
    const packageVersionChanged = state.currentVersionAtLastCheck !== runtime.packageVersion;

    let latestVersion = state.latestVersion;
    if (!latestVersion || isCheckStale || packageVersionChanged) {
      latestVersion = getLatestVersion(runtime.packageName, run);
      state.lastCheckedAt = new Date(now).toISOString();
      state.currentVersionAtLastCheck = runtime.packageVersion;
      if (latestVersion) {
        state.latestVersion = latestVersion;
      }
      writeUpdateState(state);
    }

    if (!latestVersion) return;
    if (compareVersions(runtime.packageVersion, latestVersion) >= 0) return;

    const lastAttemptAt = Date.parse(state.lastAttemptAt ?? "");
    const attemptedRecently =
      state.lastAttemptedVersion === latestVersion &&
      Number.isFinite(lastAttemptAt) &&
      now - lastAttemptAt < attemptCooldownMs;
    if (attemptedRecently) return;

    console.warn(`VibeGuard update available: ${runtime.packageVersion} -> ${latestVersion}. Attempting automatic update...`);
    const installResult = run("npm", ["install", "-g", `${runtime.packageName}@${latestVersion}`], {
      timeoutMs: readNumberEnv("VIBEGUARD_UPDATE_INSTALL_TIMEOUT_MS", DEFAULT_INSTALL_TIMEOUT_MS),
      env: {
        ...process.env,
        VIBEGUARD_DISABLE_AUTO_UPDATE: "1",
      },
    });

    state.lastAttemptedVersion = latestVersion;
    state.lastAttemptAt = new Date(now).toISOString();
    state.lastAttemptOk = installResult.ok;
    writeUpdateState(state);

    if (installResult.ok) {
      console.warn(`VibeGuard auto-update succeeded. Re-run your command to use version ${latestVersion}.`);
      return;
    }

    console.warn(
      `VibeGuard auto-update failed: ${summarizeFailure(installResult)}. Update manually with \`npm install -g ${runtime.packageName}@latest\`.`
    );
  } catch {
    // Auto-update is best-effort and must never block normal command execution.
  }
}
