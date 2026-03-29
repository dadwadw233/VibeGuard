import { homedir } from "os";
import { join } from "path";

export const DEFAULT_DASHBOARD_PORT = 7847;

export function getVibeGuardDir(): string {
  return process.env.VIBEGUARD_HOME_DIR ?? join(homedir(), ".vibeguard");
}

export function getInstallStatePath(): string {
  return join(getVibeGuardDir(), "install-state.json");
}

export function getUpdateStatePath(): string {
  return join(getVibeGuardDir(), "update-state.json");
}

export function getClaudeConfigDir(): string {
  return process.env.VIBEGUARD_CLAUDE_CONFIG_DIR ?? join(homedir(), ".claude");
}

export function getClaudeSettingsPath(): string {
  return join(getClaudeConfigDir(), "settings.json");
}

export function getDashboardPort(): number {
  const raw = process.env.VIBEGUARD_PORT;
  if (!raw) return DEFAULT_DASHBOARD_PORT;

  const port = Number.parseInt(raw, 10);
  return Number.isFinite(port) ? port : DEFAULT_DASHBOARD_PORT;
}

export function getDashboardUrl(): string {
  return `http://localhost:${getDashboardPort()}`;
}
