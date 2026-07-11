import { mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname } from "path";
import { getPolicyPresetDescription, readPolicy } from "../../config/policy.js";
import { getCodexHooksPath, getDashboardUrl } from "../../paths.js";
import { mergeCodexHooksFile, removeManagedCodexHooks, type CodexHooksFile } from "../codex-settings.js";
import { evaluateCodexHook, queryCodexHooks } from "../codex-hook-status.js";
import { findExecutable, launchCommand, shellQuote } from "../command-utils.js";
import { getBetterSqliteHealthCheck, getHookRuntimeHealthCheck, getRuntimeConsistencyCheck } from "../health.js";
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

  async doctor(runtime: RuntimePaths, state: InstallState): Promise<DoctorSummary> {
    const hooksPath = getCodexHooksPath();
    const preToolCommand = state.targets.codex?.commands?.preToolUse;
    const userPromptCommand = state.targets.codex?.commands?.userPrompt;
    const policy = readPolicy();
    const codexBinary = findExecutable("codex");
    const hookQuery = codexBinary
      ? await queryCodexHooks(codexBinary, process.cwd(), runtime.packageVersion)
      : { ok: false, hooks: [], details: "Codex CLI is not available, so effective hooks could not be verified." };
    const preToolStatus = typeof preToolCommand === "string" && hookQuery.ok
      ? evaluateCodexHook(hookQuery.hooks, "preToolUse", preToolCommand)
      : { ok: false, details: hookQuery.ok ? "No managed PreToolUse command is recorded." : hookQuery.details };
    const userPromptStatus = typeof userPromptCommand === "string" && hookQuery.ok
      ? evaluateCodexHook(hookQuery.hooks, "userPromptSubmit", userPromptCommand)
      : { ok: false, details: hookQuery.ok ? "No managed UserPromptSubmit command is recorded." : hookQuery.details };

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
      getHookRuntimeHealthCheck("codex"),
      {
        label: "Policy preset",
        ok: true,
        details: `${policy.preset}: ${getPolicyPresetDescription(policy.preset)}`,
      },
      {
        label: "Codex effective hook discovery",
        ok: hookQuery.ok,
        details: hookQuery.details,
      },
      {
        label: "PreToolUse hook",
        ok: preToolStatus.ok,
        details: preToolStatus.details,
      },
      {
        label: "UserPromptSubmit hook",
        ok: userPromptStatus.ok,
        details: userPromptStatus.details,
      },
      {
        label: "Codex hook coverage",
        ok: true,
        details: "VibeGuard protects Codex through official hooks; unsupported Codex tool paths are outside this guarantee.",
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
