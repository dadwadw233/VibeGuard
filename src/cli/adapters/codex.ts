import { mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname } from "path";
import { getPolicyPresetDescription, readPolicy } from "../../config/policy.js";
import { getCodexHooksPath, getDashboardUrl } from "../../paths.js";
import { mergeCodexHooksFile, removeManagedCodexHooks, type CodexHooksFile } from "../codex-settings.js";
import { findExecutable, launchCommand, shellQuote } from "../command-utils.js";
import { getBetterSqliteHealthCheck, getRuntimeConsistencyCheck } from "../health.js";
import type { InstallState } from "../install-state.js";
import type { RuntimePaths } from "../runtime.js";
import type { DoctorCheck, DoctorSummary, HostAdapter, InstallSummary, UninstallSummary } from "./types.js";

export class CodexAdapter implements HostAdapter {
  readonly target = "codex" as const;

  install(runtime: RuntimePaths, state: InstallState): InstallSummary {
    const hooksPath = getCodexHooksPath();
    const preToolCommand = `${shellQuote(runtime.nodeBinary)} ${shellQuote(runtime.codexPreToolUseHook)}`;
    const userPromptCommand = `${shellQuote(runtime.nodeBinary)} ${shellQuote(runtime.codexUserPromptHook)}`;
    const previous = state.targets.codex?.commands;
    const nextHooks = mergeCodexHooksFile(this.readHooksFile(hooksPath), {
      preToolUse: preToolCommand,
      userPrompt: userPromptCommand,
      previousPreToolUse: previous?.preToolUse,
      previousUserPrompt: previous?.userPrompt,
    });

    mkdirSync(dirname(hooksPath), { recursive: true });
    writeFileSync(hooksPath, `${JSON.stringify(nextHooks, null, 2)}\n`, "utf-8");

    return {
      target: this.target,
      ok: true,
      headline: "Configured Codex integration.",
      details: [
        `Updated Codex hooks in ${hooksPath}.`,
        "Prompt and supported tool scanning are active when Codex runs trusted hooks.",
      ],
      state: {
        installedAt: new Date().toISOString(),
        configPath: hooksPath,
        commands: {
          preToolUse: preToolCommand,
          userPrompt: userPromptCommand,
          launch: "vibeguard launch codex",
        },
        notes: ["Codex protection uses official hooks; coverage follows Codex hook support."],
      },
    };
  }

  uninstall(runtime: RuntimePaths, state: InstallState): UninstallSummary {
    const hooksPath = getCodexHooksPath();
    const previous = state.targets.codex?.commands;
    const nextHooks = removeManagedCodexHooks(this.readHooksFile(hooksPath), {
      preToolUse: `${shellQuote(runtime.nodeBinary)} ${shellQuote(runtime.codexPreToolUseHook)}`,
      userPrompt: `${shellQuote(runtime.nodeBinary)} ${shellQuote(runtime.codexUserPromptHook)}`,
      previousPreToolUse: previous?.preToolUse,
      previousUserPrompt: previous?.userPrompt,
    });

    mkdirSync(dirname(hooksPath), { recursive: true });
    writeFileSync(hooksPath, `${JSON.stringify(nextHooks, null, 2)}\n`, "utf-8");

    return {
      target: this.target,
      ok: true,
      headline: "Removed Codex integration.",
      details: [`Removed managed Codex hooks from ${hooksPath}.`],
    };
  }

  doctor(runtime: RuntimePaths, state: InstallState): DoctorSummary {
    const hooksPath = getCodexHooksPath();
    const hooksFile = this.readHooksFile(hooksPath);
    const preToolCommand = state.targets.codex?.commands?.preToolUse;
    const userPromptCommand = state.targets.codex?.commands?.userPrompt;
    const policy = readPolicy();
    const hasPreToolHook =
      typeof preToolCommand === "string" &&
      (hooksFile.hooks?.PreToolUse ?? []).some((entry) =>
        entry.hooks.some((hook) => hook.command === preToolCommand)
      );
    const hasUserPromptHook =
      typeof userPromptCommand === "string" &&
      (hooksFile.hooks?.UserPromptSubmit ?? []).some((entry) =>
        entry.hooks.some((hook) => hook.command === userPromptCommand)
      );
    const codexBinary = findExecutable("codex");

    const checks: DoctorCheck[] = [
      {
        label: "Codex CLI",
        ok: Boolean(codexBinary),
        details: codexBinary ? `Found at ${codexBinary}.` : "Install Codex CLI or add it to PATH.",
      },
      {
        label: "Codex hooks file",
        ok: Boolean(preToolCommand || userPromptCommand),
        details: preToolCommand || userPromptCommand
          ? `Managed install recorded for ${hooksPath}.`
          : "No managed Codex install recorded yet. Run `vibeguard install --target codex`.",
      },
      getRuntimeConsistencyCheck(runtime, state),
      getBetterSqliteHealthCheck(runtime),
      {
        label: "Policy preset",
        ok: true,
        details: `${policy.preset}: ${getPolicyPresetDescription(policy.preset)}`,
      },
      {
        label: "PreToolUse hook",
        ok: hasPreToolHook,
        details: hasPreToolHook
          ? "Hook command is present in Codex hooks."
          : "PreToolUse hook is missing or no longer matches the managed install state.",
      },
      {
        label: "UserPromptSubmit hook",
        ok: hasUserPromptHook,
        details: hasUserPromptHook
          ? "Prompt scanning hook is present in Codex hooks."
          : "UserPromptSubmit hook is missing or no longer matches the managed install state.",
      },
      {
        label: "Codex hook coverage",
        ok: true,
        details: "VibeGuard protects Codex through official hooks; unsupported Codex tool paths are outside this guarantee.",
      },
      {
        label: "Codex hook trust",
        ok: true,
        details: "If Codex asks to review hooks, trust the VibeGuard entries from `/hooks` before relying on enforcement.",
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

  async launch(runtime: RuntimePaths, state: InstallState, args: string[]): Promise<number> {
    const codexBinary = findExecutable("codex");
    if (!codexBinary) {
      console.error("VibeGuard could not find the Codex CLI on PATH.");
      return 1;
    }

    const runtimeCheck = getRuntimeConsistencyCheck(runtime, state);
    if (!runtimeCheck.ok) {
      console.warn(`⚠️  ${runtimeCheck.details}`);
    }

    console.log(this.banner(Boolean(state.targets.codex)));
    return await launchCommand(codexBinary, args);
  }

  private banner(configured: boolean): string {
    const status = configured ? "installed" : "not installed";
    const policy = readPolicy();
    return [
      "=== VibeGuard active for Codex ===",
      `Status: ${status}`,
      `Policy preset: ${policy.preset}`,
      "Protections: UserPromptSubmit scanning, supported PreToolUse blocking, dashboard logging",
      "Coverage: follows Codex official hook support",
      `Dashboard: ${getDashboardUrl()} via \`vibeguard dashboard\``,
      "",
    ].join("\n");
  }

  private readHooksFile(hooksPath: string): CodexHooksFile {
    try {
      return JSON.parse(readFileSync(hooksPath, "utf-8")) as CodexHooksFile;
    } catch {
      return {};
    }
  }
}
