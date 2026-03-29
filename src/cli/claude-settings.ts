export interface ClaudeHookCommand {
  type: "command";
  command: string;
  timeout: number;
}

export interface ClaudeHookMatcher {
  matcher: string;
  hooks: ClaudeHookCommand[];
}

export interface ClaudeSettings {
  hooks?: {
    PreToolUse?: ClaudeHookMatcher[];
    UserPromptSubmit?: ClaudeHookMatcher[];
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

export interface ClaudeManagedCommands {
  preToolUse: string;
  userPrompt: string;
  previousPreToolUse?: string;
  previousUserPrompt?: string;
}

function isManagedCommand(command: string, expectedSuffix: string, candidates: Set<string>): boolean {
  if (candidates.has(command)) return true;

  if (!command.includes(expectedSuffix)) return false;
  return /vibeguard/i.test(command);
}

function stripManagedHooks(
  entries: ClaudeHookMatcher[] | undefined,
  expectedSuffix: string,
  candidates: Set<string>
): ClaudeHookMatcher[] {
  if (!entries) return [];

  return entries
    .map((entry) => ({
      ...entry,
      hooks: entry.hooks.filter((hook) => !isManagedCommand(hook.command, expectedSuffix, candidates)),
    }))
    .filter((entry) => entry.hooks.length > 0);
}

export function mergeClaudeSettings(
  existing: ClaudeSettings,
  commands: ClaudeManagedCommands
): ClaudeSettings {
  const preToolUseCommands = new Set(
    [commands.preToolUse, commands.previousPreToolUse].filter(Boolean) as string[]
  );
  const userPromptCommands = new Set(
    [commands.userPrompt, commands.previousUserPrompt].filter(Boolean) as string[]
  );

  const hooks = existing.hooks ?? {};
  const preToolEntries = stripManagedHooks(hooks.PreToolUse, "dist/hooks/pre-tool-use.js", preToolUseCommands);
  const userPromptEntries = stripManagedHooks(
    hooks.UserPromptSubmit,
    "dist/hooks/user-prompt-submit.js",
    userPromptCommands
  );

  preToolEntries.push({
    matcher: "Bash|Write|Edit|Read",
    hooks: [
      {
        type: "command",
        command: commands.preToolUse,
        timeout: 5,
      },
    ],
  });

  userPromptEntries.push({
    matcher: "",
    hooks: [
      {
        type: "command",
        command: commands.userPrompt,
        timeout: 5,
      },
    ],
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
