export interface CodexHookCommand {
  type: "command";
  command: string;
}

export interface CodexHookMatcher {
  matcher: string;
  hooks: CodexHookCommand[];
}

export interface CodexHooksFile {
  hooks?: {
    PreToolUse?: CodexHookMatcher[];
    UserPromptSubmit?: CodexHookMatcher[];
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

export interface CodexManagedCommands {
  preToolUse: string;
  userPrompt: string;
  previousPreToolUse?: string;
  previousUserPrompt?: string;
}

function isManagedCommand(command: string, expectedSuffix: string, candidates: Set<string>): boolean {
  if (candidates.has(command)) return true;
  return command.includes(expectedSuffix) && /vibeguard/i.test(command);
}

function stripManagedHooks(
  entries: CodexHookMatcher[] | undefined,
  expectedSuffix: string,
  candidates: Set<string>
): CodexHookMatcher[] {
  if (!entries) return [];

  return entries
    .map((entry) => ({
      ...entry,
      hooks: entry.hooks.filter((hook) => !isManagedCommand(hook.command, expectedSuffix, candidates)),
    }))
    .filter((entry) => entry.hooks.length > 0);
}

function buildCleanHookEntries(existing: CodexHooksFile, commands: CodexManagedCommands): {
  hooks: NonNullable<CodexHooksFile["hooks"]>;
  preToolEntries: CodexHookMatcher[];
  userPromptEntries: CodexHookMatcher[];
} {
  const preToolUseCommands = new Set(
    [commands.preToolUse, commands.previousPreToolUse].filter(Boolean) as string[]
  );
  const userPromptCommands = new Set(
    [commands.userPrompt, commands.previousUserPrompt].filter(Boolean) as string[]
  );

  const hooks = existing.hooks ?? {};
  const preToolEntries = stripManagedHooks(hooks.PreToolUse, "dist/hooks/codex-pre-tool-use.js", preToolUseCommands);
  const userPromptEntries = stripManagedHooks(
    hooks.UserPromptSubmit,
    "dist/hooks/codex-user-prompt-submit.js",
    userPromptCommands
  );

  return { hooks, preToolEntries, userPromptEntries };
}

export function mergeCodexHooksFile(existing: CodexHooksFile, commands: CodexManagedCommands): CodexHooksFile {
  const { hooks, preToolEntries, userPromptEntries } = buildCleanHookEntries(existing, commands);

  preToolEntries.push({
    matcher: "Bash|apply_patch|Edit|Write",
    hooks: [{ type: "command", command: commands.preToolUse }],
  });

  userPromptEntries.push({
    matcher: "",
    hooks: [{ type: "command", command: commands.userPrompt }],
  });

  return {
    ...existing,
    hooks: {
      ...hooks,
      PreToolUse: preToolEntries,
      UserPromptSubmit: userPromptEntries,
    },
  };
}

export function removeManagedCodexHooks(
  existing: CodexHooksFile,
  commands: CodexManagedCommands
): CodexHooksFile {
  const { hooks, preToolEntries, userPromptEntries } = buildCleanHookEntries(existing, commands);
  const nextHooks: NonNullable<CodexHooksFile["hooks"]> = { ...hooks };

  if (preToolEntries.length > 0) {
    nextHooks.PreToolUse = preToolEntries;
  } else {
    delete nextHooks.PreToolUse;
  }

  if (userPromptEntries.length > 0) {
    nextHooks.UserPromptSubmit = userPromptEntries;
  } else {
    delete nextHooks.UserPromptSubmit;
  }

  if (Object.keys(nextHooks).length === 0) {
    const { hooks: _hooks, ...rest } = existing;
    return rest;
  }

  return {
    ...existing,
    hooks: nextHooks,
  };
}
