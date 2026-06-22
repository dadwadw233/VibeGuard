import { describe, expect, it } from "vitest";
import { mergeCodexHooksFile, removeManagedCodexHooks } from "../codex-settings.js";

describe("Codex hooks file management", () => {
  it("adds managed hooks idempotently while preserving user hooks", () => {
    const existing = {
      hooks: {
        PreToolUse: [
          {
            matcher: "Bash",
            hooks: [
              { type: "command" as const, command: "\"/usr/bin/node\" \"/old/vibeguard/dist/hooks/codex-pre-tool-use.js\"" },
              { type: "command" as const, command: "node /custom/pre.js" },
            ],
          },
        ],
      },
    };

    const commands = {
      preToolUse: "\"/usr/bin/node\" \"/new/vibeguard/dist/hooks/codex-pre-tool-use.js\"",
      userPrompt: "\"/usr/bin/node\" \"/new/vibeguard/dist/hooks/codex-user-prompt-submit.js\"",
      previousPreToolUse: "\"/usr/bin/node\" \"/old/vibeguard/dist/hooks/codex-pre-tool-use.js\"",
    };

    const next = mergeCodexHooksFile(existing, commands);
    const rerun = mergeCodexHooksFile(next, { ...commands, previousPreToolUse: commands.preToolUse });
    const preToolCommands = rerun.hooks?.PreToolUse?.flatMap((entry) => entry.hooks.map((hook) => hook.command)) ?? [];
    const userPromptCommands = rerun.hooks?.UserPromptSubmit?.flatMap((entry) => entry.hooks.map((hook) => hook.command)) ?? [];

    expect(preToolCommands).toContain("node /custom/pre.js");
    expect(preToolCommands.filter((command) => command.includes("codex-pre-tool-use.js"))).toHaveLength(1);
    expect(userPromptCommands.filter((command) => command.includes("codex-user-prompt-submit.js"))).toHaveLength(1);
  });

  it("removes managed hooks while preserving unrelated hooks", () => {
    const existing = mergeCodexHooksFile(
      {
        hooks: {
          PostToolUse: [
            {
              matcher: "*",
              hooks: [{ type: "command" as const, command: "node /custom/post.js" }],
            },
          ],
        },
      },
      {
        preToolUse: "\"/usr/bin/node\" \"/pkg/dist/hooks/codex-pre-tool-use.js\"",
        userPrompt: "\"/usr/bin/node\" \"/pkg/dist/hooks/codex-user-prompt-submit.js\"",
      }
    );

    const next = removeManagedCodexHooks(existing, {
      preToolUse: "\"/usr/bin/node\" \"/pkg/dist/hooks/codex-pre-tool-use.js\"",
      userPrompt: "\"/usr/bin/node\" \"/pkg/dist/hooks/codex-user-prompt-submit.js\"",
    });

    expect(JSON.stringify(next)).not.toContain("codex-pre-tool-use.js");
    expect(JSON.stringify(next)).not.toContain("codex-user-prompt-submit.js");
    expect(JSON.stringify(next)).toContain("/custom/post.js");
  });
});
