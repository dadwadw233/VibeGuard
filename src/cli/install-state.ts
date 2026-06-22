import { mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname } from "path";
import { getInstallStatePath } from "../paths.js";

export type HostTarget = "claude" | "codex";

export interface TargetInstallState {
  installedAt: string;
  configPath?: string;
  mcpRegistered?: boolean;
  notes?: string[];
  commands?: Partial<Record<"preToolUse" | "userPrompt" | "launch", string>>;
}

export interface RuntimeInstallMetadata {
  nodeBinary: string;
  nodeVersion: string;
  packageVersion: string;
}

export interface InstallState {
  version: 1;
  packageRoot: string;
  updatedAt: string;
  runtime?: RuntimeInstallMetadata;
  targets: Partial<Record<HostTarget, TargetInstallState>>;
}

export function createEmptyInstallState(packageRoot = ""): InstallState {
  return {
    version: 1,
    packageRoot,
    updatedAt: new Date(0).toISOString(),
    runtime: undefined,
    targets: {},
  };
}

function readRuntimeMetadata(parsed: unknown): RuntimeInstallMetadata | undefined {
  if (!parsed || typeof parsed !== "object") return undefined;
  const candidate = parsed as Record<string, unknown>;
  if (
    typeof candidate.nodeBinary !== "string" ||
    typeof candidate.nodeVersion !== "string" ||
    typeof candidate.packageVersion !== "string"
  ) {
    return undefined;
  }

  return {
    nodeBinary: candidate.nodeBinary,
    nodeVersion: candidate.nodeVersion,
    packageVersion: candidate.packageVersion,
  };
}

export function readInstallState(): InstallState {
  const filePath = getInstallStatePath();

  try {
    const parsed = JSON.parse(readFileSync(filePath, "utf-8")) as InstallState;
    return {
      version: 1,
      packageRoot: parsed.packageRoot ?? "",
      updatedAt: parsed.updatedAt ?? new Date(0).toISOString(),
      runtime: readRuntimeMetadata((parsed as { runtime?: unknown }).runtime),
      targets: parsed.targets ?? {},
    };
  } catch {
    return createEmptyInstallState();
  }
}

export function writeInstallState(state: InstallState): void {
  const filePath = getInstallStatePath();
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(state, null, 2)}\n`, "utf-8");
}

export function updateInstallState(
  packageRoot: string,
  mutate: (state: InstallState) => InstallState
): InstallState {
  const current = readInstallState();
  const next = mutate({
    ...current,
    version: 1,
    packageRoot,
    updatedAt: new Date().toISOString(),
  });
  writeInstallState(next);
  return next;
}
