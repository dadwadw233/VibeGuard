import { describe, expect, it } from "vitest";
import { mergeClaudeSettings, type ClaudeSettings } from "../claude-settings.js";

describe("mergeClaudeSettings", () => {
  it("adds managed hooks to an empty settings file", () => {
    const result = mergeClaudeSettings({}, {
      preToolUse: "\"/usr/bin/node\" \"/pkg/dist/hooks/pre-tool-use.js\"",
      userPrompt: "\"/usr/bin/node\" \"/pkg/dist/hooks/user-prompt-submit.js\"",
    });

    expect(result.hooks?.PreToolUse).toHaveLength(1);
    expect(result.hooks?.PreToolUse?.[0]?.matcher).toBe("Bash|Write|Edit|Read");
    expect(result.hooks?.UserPromptSubmit).toHaveLength(1);
    expect(result.hooks?.UserPromptSubmit?.[0]?.matcher).toBe("");
  });

  it("preserves unrelated hooks while replacing the managed ones idempotently", () => {
    const existing: ClaudeSettings = {
      hooks: {
        PreToolUse: [
          {
            matcher: "Read",
            hooks: [
              {
                type: "command",
                command: "\"/usr/bin/node\" \"/old/vibeguard/dist/hooks/pre-tool-use.js\"",
                timeout: 5,
              },
              {
                type: "command",
                command: "node /custom/hook.js",
                timeout: 3,
              },
            ],
          },
        ],
        UserPromptSubmit: [
          {
            matcher: "",
            hooks: [
              {
                type: "command",
                command: "\"/usr/bin/node\" \"/old/vibeguard/dist/hooks/user-prompt-submit.js\"",
                timeout: 5,
              },
            ],
          },
        ],
      },
      theme: "dark",
    };

    const next = mergeClaudeSettings(existing, {
      preToolUse: "\"/usr/bin/node\" \"/new/vibeguard/dist/hooks/pre-tool-use.js\"",
      userPrompt: "\"/usr/bin/node\" \"/new/vibeguard/dist/hooks/user-prompt-submit.js\"",
      previousPreToolUse: "\"/usr/bin/node\" \"/old/vibeguard/dist/hooks/pre-tool-use.js\"",
      previousUserPrompt: "\"/usr/bin/node\" \"/old/vibeguard/dist/hooks/user-prompt-submit.js\"",
    });
    const rerun = mergeClaudeSettings(next, {
      preToolUse: "\"/usr/bin/node\" \"/new/vibeguard/dist/hooks/pre-tool-use.js\"",
      userPrompt: "\"/usr/bin/node\" \"/new/vibeguard/dist/hooks/user-prompt-submit.js\"",
      previousPreToolUse: "\"/usr/bin/node\" \"/new/vibeguard/dist/hooks/pre-tool-use.js\"",
      previousUserPrompt: "\"/usr/bin/node\" \"/new/vibeguard/dist/hooks/user-prompt-submit.js\"",
    });

    expect(next.theme).toBe("dark");
    expect(next.hooks?.PreToolUse?.flatMap((entry) => entry.hooks.map((hook) => hook.command))).toContain("node /custom/hook.js");
    expect(rerun.hooks?.PreToolUse?.flatMap((entry) => entry.hooks.map((hook) => hook.command)).filter((command) => command.includes("pre-tool-use.js"))).toHaveLength(1);
    expect(rerun.hooks?.UserPromptSubmit?.flatMap((entry) => entry.hooks.map((hook) => hook.command)).filter((command) => command.includes("user-prompt-submit.js"))).toHaveLength(1);
  });
});
