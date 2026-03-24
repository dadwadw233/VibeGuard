import { mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname } from "path";
import { getClaudeSettingsPath, getDashboardUrl } from "../../paths.js";
import { mergeClaudeSettings, type ClaudeSettings } from "../claude-settings.js";
import { findExecutable, launchCommand, runCommand, shellQuote } from "../command-utils.js";
import type { InstallState } from "../install-state.js";
import type { RuntimePaths } from "../runtime.js";
import type { DoctorCheck, DoctorSummary, HostAdapter, InstallSummary } from "./types.js";

export class ClaudeAdapter implements HostAdapter {
  readonly target = "claude" as const;

  install(runtime: RuntimePaths, state: InstallState): InstallSummary {
    const settingsPath = getClaudeSettingsPath();
    const preToolCommand = `${shellQuote(runtime.nodeBinary)} ${shellQuote(runtime.preToolUseHook)}`;
    const userPromptCommand = `${shellQuote(runtime.nodeBinary)} ${shellQuote(runtime.userPromptHook)}`;

    const previous = state.targets.claude?.commands;
    const existingSettings = this.readSettings(settingsPath);
    const nextSettings = mergeClaudeSettings(existingSettings, {
      preToolUse: preToolCommand,
      userPrompt: userPromptCommand,
      previousPreToolUse: previous?.preToolUse,
      previousUserPrompt: previous?.userPrompt,
    });

    mkdirSync(dirname(settingsPath), { recursive: true });
    writeFileSync(settingsPath, `${JSON.stringify(nextSettings, null, 2)}\n`, "utf-8");

    const details = [
      `Updated Claude hooks in ${settingsPath}.`,
      `Real-time Bash/Write/Edit/Read scanning is active after launching Claude.`,
    ];
    let mcpRegistered = false;

    if (findExecutable("claude")) {
      const mcp = this.ensureMcpServer(runtime);
      mcpRegistered = mcp.ok;
      details.push(mcp.ok ? "Registered Claude MCP server 'vibeguard'." : mcp.details);
    } else {
      details.push("Claude CLI not found on PATH, so MCP registration was skipped.");
    }

    return {
      target: this.target,
      ok: true,
      headline: "Configured Claude integration.",
      details,
      state: {
        installedAt: new Date().toISOString(),
        configPath: settingsPath,
        mcpRegistered,
        commands: {
          preToolUse: preToolCommand,
          userPrompt: userPromptCommand,
          launch: "vibeguard launch claude",
        },
      },
    };
  }

  doctor(runtime: RuntimePaths, state: InstallState): DoctorSummary {
    const settingsPath = getClaudeSettingsPath();
    const settings = this.readSettings(settingsPath);
    const preToolCommand = state.targets.claude?.commands?.preToolUse;
    const userPromptCommand = state.targets.claude?.commands?.userPrompt;
    const hasPreToolHook =
      typeof preToolCommand === "string" &&
      (settings.hooks?.PreToolUse ?? []).some(
        (entry) =>
          entry.matcher === "Bash|Write|Edit|Read" &&
          entry.hooks.some((hook) => hook.command === preToolCommand)
      );
    const hasUserPromptHook =
      typeof userPromptCommand === "string" &&
      (settings.hooks?.UserPromptSubmit ?? []).some(
        (entry) =>
          entry.matcher === "" &&
          entry.hooks.some((hook) => hook.command === userPromptCommand)
      );
    const claudeBinary = findExecutable("claude");
    const mcpCheck = claudeBinary ? this.getMcpCheck() : { ok: false, details: "Claude CLI not found on PATH." };

    const checks: DoctorCheck[] = [
      {
        label: "Claude CLI",
        ok: Boolean(claudeBinary),
        details: claudeBinary ? `Found at ${claudeBinary}.` : "Install Claude CLI or add it to PATH.",
      },
      {
        label: "Claude settings",
        ok: Boolean(preToolCommand || userPromptCommand),
        details: preToolCommand || userPromptCommand
          ? `Managed install recorded for ${settingsPath}.`
          : "No managed Claude install recorded yet. Run `vibeguard install --target claude`.",
      },
      {
        label: "PreToolUse hook",
        ok: hasPreToolHook,
        details: hasPreToolHook
          ? "Hook command is present in Claude settings."
          : "PreToolUse hook is missing or no longer matches the managed install state.",
      },
      {
        label: "UserPromptSubmit hook",
        ok: hasUserPromptHook,
        details: hasUserPromptHook
          ? "Prompt scanning hook is present in Claude settings."
          : "UserPromptSubmit hook is missing or no longer matches the managed install state.",
      },
      {
        label: "Claude MCP server",
        ok: mcpCheck.ok,
        details: mcpCheck.details,
      },
      {
        label: "Dashboard",
        ok: true,
        details: `History remains available via \`vibeguard dashboard\` at ${getDashboardUrl()}.`,
      },
    ];

    return {
      target: this.target,
      ok: checks.every((check) => check.ok),
      checks,
    };
  }

  async launch(_runtime: RuntimePaths, state: InstallState, args: string[]): Promise<number> {
    const claudeBinary = findExecutable("claude");
    if (!claudeBinary) {
      console.error("VibeGuard could not find the Claude CLI on PATH.");
      return 1;
    }

    const configured = Boolean(state.targets.claude);
    console.log(this.banner(configured));
    return await launchCommand(claudeBinary, args);
  }

  private banner(configured: boolean): string {
    const status = configured ? "installed" : "not installed";
    return [
      "=== VibeGuard active for Claude ===",
      `Status: ${status}`,
      "Protections: PreToolUse blocking, prompt scanning, dashboard logging",
      `Dashboard: ${getDashboardUrl()} via \`vibeguard dashboard\``,
      "",
    ].join("\n");
  }

  private readSettings(settingsPath: string): ClaudeSettings {
    try {
      return JSON.parse(readFileSync(settingsPath, "utf-8")) as ClaudeSettings;
    } catch {
      return {};
    }
  }

  private ensureMcpServer(runtime: RuntimePaths): { ok: boolean; details: string } {
    const getResult = runCommand("claude", ["mcp", "get", "vibeguard"]);
    if (getResult.ok) {
      return { ok: true, details: "Claude MCP server 'vibeguard' is already registered." };
    }

    const addResult = runCommand("claude", [
      "mcp",
      "add",
      "vibeguard",
      "--",
      runtime.nodeBinary,
      runtime.mcpServer,
    ]);

    if (addResult.ok) {
      return { ok: true, details: "Claude MCP server 'vibeguard' registered successfully." };
    }

    return {
      ok: false,
      details: `Failed to register Claude MCP server automatically: ${addResult.stderr.trim() || addResult.stdout.trim() || "unknown error"}`,
    };
  }

  private getMcpCheck(): { ok: boolean; details: string } {
    const result = runCommand("claude", ["mcp", "get", "vibeguard"]);
    if (result.ok) {
      return { ok: true, details: "Claude MCP server 'vibeguard' is registered." };
    }

    return {
      ok: false,
      details: "Claude MCP server 'vibeguard' is not registered. Re-run `vibeguard install --target claude`.",
    };
  }
}
