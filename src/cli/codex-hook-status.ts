import { spawn } from "child_process";

export interface EffectiveCodexHook {
  key?: string;
  eventName: string;
  command?: string;
  enabled: boolean;
  isManaged?: boolean;
  trustStatus?: string;
}

export interface CodexHookQueryResult {
  ok: boolean;
  hooks: EffectiveCodexHook[];
  details: string;
}

export interface EffectiveCodexHookResult {
  ok: boolean;
  details: string;
}

interface HooksListResponse {
  id?: number;
  result?: {
    data?: Array<{
      cwd?: string;
      hooks?: EffectiveCodexHook[];
      warnings?: string[];
      errors?: string[];
    }>;
  };
  error?: { message?: string };
}

export async function queryCodexHooks(
  codexBinary: string,
  cwd: string,
  clientVersion: string,
  timeoutMs = 4_000
): Promise<CodexHookQueryResult> {
  return await new Promise<CodexHookQueryResult>((resolve) => {
    const child = spawn(codexBinary, ["app-server", "--stdio"], {
      cwd,
      stdio: ["pipe", "pipe", "pipe"],
    });
    let settled = false;
    let stdoutBuffer = "";
    let stderr = "";

    const finish = (result: CodexHookQueryResult) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      child.stdin.end();
      child.kill();
      resolve(result);
    };

    const timeout = setTimeout(() => {
      finish({
        ok: false,
        hooks: [],
        details: "Codex app-server did not return hooks/list before the health-check timeout.",
      });
    }, timeoutMs);

    child.on("error", (error) => {
      finish({ ok: false, hooks: [], details: `Could not start Codex app-server: ${error.message}` });
    });

    child.on("exit", () => {
      if (settled) return;
      const details = stderr.trim().replace(/\s+/g, " ");
      finish({
        ok: false,
        hooks: [],
        details: details
          ? `Codex app-server exited before hooks/list completed: ${details}`
          : "Codex app-server exited before hooks/list completed.",
      });
    });

    child.stderr.on("data", (chunk: Buffer | string) => {
      if (stderr.length < 4_000) stderr += chunk.toString();
    });

    child.stdout.on("data", (chunk: Buffer | string) => {
      stdoutBuffer += chunk.toString();
      const lines = stdoutBuffer.split("\n");
      stdoutBuffer = lines.pop() ?? "";

      for (const line of lines) {
        if (!line.trim()) continue;
        let message: HooksListResponse;
        try {
          message = JSON.parse(line) as HooksListResponse;
        } catch {
          continue;
        }

        if (message.id === 0) {
          child.stdin.write(`${JSON.stringify({ method: "initialized", params: {} })}\n`);
          child.stdin.write(`${JSON.stringify({ method: "hooks/list", id: 1, params: { cwds: [cwd] } })}\n`);
          continue;
        }

        if (message.id !== 1) continue;
        if (message.error) {
          finish({
            ok: false,
            hooks: [],
            details: `Codex hooks/list failed: ${message.error.message ?? "unknown app-server error"}`,
          });
          return;
        }

        const entries = message.result?.data ?? [];
        const selected = entries.find((entry) => entry.cwd === cwd) ?? entries[0];
        const errors = selected?.errors ?? [];
        if (errors.length > 0) {
          finish({ ok: false, hooks: selected?.hooks ?? [], details: `Codex hooks/list reported: ${errors.join("; ")}` });
          return;
        }

        const warnings = selected?.warnings ?? [];
        finish({
          ok: true,
          hooks: selected?.hooks ?? [],
          details: warnings.length > 0
            ? `Codex hooks/list completed with warnings: ${warnings.join("; ")}`
            : "Codex hooks/list completed successfully.",
        });
        return;
      }
    });

    child.stdin.write(`${JSON.stringify({
      method: "initialize",
      id: 0,
      params: { clientInfo: { name: "vibeguard", title: "VibeGuard", version: clientVersion } },
    })}\n`);
  });
}

export function evaluateCodexHook(
  hooks: EffectiveCodexHook[],
  eventName: "preToolUse" | "userPromptSubmit",
  command: string
): EffectiveCodexHookResult {
  const matches = hooks.filter((hook) => hook.eventName === eventName && hook.command === command);
  if (matches.length === 0) {
    return { ok: false, details: "Managed hook is not present in Codex's effective hook list." };
  }

  const enabled = matches.filter((hook) => hook.enabled);
  if (enabled.length === 0) {
    return { ok: false, details: "Managed hook is configured but disabled in Codex." };
  }

  if (!enabled.some((hook) => hook.isManaged || hook.trustStatus === "trusted")) {
    return { ok: false, details: "Managed hook is enabled but not trusted by Codex." };
  }

  return { ok: true, details: "Managed hook is enabled and trusted in Codex's effective hook list." };
}
