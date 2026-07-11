import {
  clearHookDegradation,
  recordHookDegradation,
  type HookHealthSource,
} from "../health-state.js";

type CodexHookHandler<T> = (input: T) => unknown | Promise<unknown>;

function degradationOutput(source: HookHealthSource, reason: "invalid-json" | "handler-error") {
  const hookName = source.split(":")[1];
  const cause = reason === "invalid-json" ? "received invalid hook input" : "encountered an internal error";
  return {
    systemMessage: `VibeGuard ${hookName} protection degraded: ${cause}; this operation was allowed (fail-open). Run \`vibeguard doctor --target codex\`.`,
  };
}

export async function executeCodexHook<T>(
  rawInput: string,
  source: HookHealthSource,
  handler: CodexHookHandler<T>
): Promise<unknown> {
  let input: T;
  try {
    input = JSON.parse(rawInput) as T;
  } catch {
    recordHookDegradation(source, "invalid-json");
    return degradationOutput(source, "invalid-json");
  }

  try {
    const output = await handler(input);
    clearHookDegradation(source);
    return output;
  } catch {
    recordHookDegradation(source, "handler-error");
    return degradationOutput(source, "handler-error");
  }
}
