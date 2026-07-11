import { describe, expect, it } from "vitest";
import type { RuntimeRules } from "../../config/index.js";
import type { HookInput, UserPromptInput } from "../../scanner/types.js";
import {
  handleCodexPreToolUse,
  handleCodexUserPromptSubmit,
  handlePreToolUse,
  handleUserPromptSubmit,
} from "../shared.js";

describe("handlePreToolUse", () => {
  it("denies dangerous bash commands with a CLI-visible reason", () => {
    const input: HookInput = {
      hook_event_name: "PreToolUse",
      tool_name: "Bash",
      tool_input: {
        command: "rm -rf /",
      },
    };

    const output = handlePreToolUse(input, undefined, { preset: "balanced" });
    expect(output?.hookSpecificOutput?.permissionDecision).toBe("deny");
    expect(output?.hookSpecificOutput?.permissionDecisionReason).toContain("VibeGuard blocked this Bash action");
    expect(output?.hookSpecificOutput?.permissionDecisionReason).toContain("Recursive force delete of root directory");
  });

  it("asks for confirmation on medium-severity bash commands", () => {
    const input: HookInput = {
      hook_event_name: "PreToolUse",
      tool_name: "Bash",
      tool_input: {
        command: "chmod 777 /var/www",
      },
    };

    const output = handlePreToolUse(input, undefined, { preset: "balanced" });
    expect(output?.hookSpecificOutput?.permissionDecision).toBe("ask");
    expect(output?.hookSpecificOutput?.permissionDecisionReason).toContain("Confirm only if the operation is intentional");
  });

  it("blocks reads of sensitive files", () => {
    const input: HookInput = {
      hook_event_name: "PreToolUse",
      tool_name: "Read",
      tool_input: {
        file_path: "/tmp/project/.env",
      },
    };

    const output = handlePreToolUse(input, undefined, { preset: "balanced" });
    expect(output?.hookSpecificOutput?.permissionDecision).toBe("deny");
    expect(output?.hookSpecificOutput?.permissionDecisionReason).toContain("Read action");
  });

  it("returns no output for safe operations", () => {
    const input: HookInput = {
      hook_event_name: "PreToolUse",
      tool_name: "Write",
      tool_input: {
        content: "const answer = 42;",
        file_path: "/tmp/project/src/index.ts",
      },
    };

    expect(handlePreToolUse(input)).toBeUndefined();
  });

  it("respects runtime severity overrides for command findings", () => {
    const input: HookInput = {
      hook_event_name: "PreToolUse",
      tool_name: "Bash",
      tool_input: {
        command: "rm -rf /",
      },
    };

    const runtimeRules: RuntimeRules = {
      secretRules: [],
      fileRules: [],
      commandRules: [
        {
          id: "rm-rf-root",
          description: "Recursive force delete of root directory",
          pattern: /rm\s+-rf\s+\//,
          severity: "medium",
        },
      ],
    };

    const output = handlePreToolUse(input, runtimeRules);
    expect(output?.hookSpecificOutput?.permissionDecision).toBe("ask");
  });

  it("uses minimal policy to warn on high-severity findings", () => {
    const input: HookInput = {
      hook_event_name: "PreToolUse",
      tool_name: "Bash",
      tool_input: {
        command: "git reset --hard",
      },
    };

    const output = handlePreToolUse(input, getRuntimeRulesForTests(), { preset: "minimal" });
    expect(output?.hookSpecificOutput?.permissionDecision).toBe("ask");
  });

  it("uses strict policy to block medium-severity findings", () => {
    const input: HookInput = {
      hook_event_name: "PreToolUse",
      tool_name: "Bash",
      tool_input: {
        command: "chmod 777 /var/www",
      },
    };

    const output = handlePreToolUse(input, getRuntimeRulesForTests(), { preset: "strict" });
    expect(output?.hookSpecificOutput?.permissionDecision).toBe("deny");
  });

  it("respects runtime disabled rules by allowing operations", () => {
    const input: HookInput = {
      hook_event_name: "PreToolUse",
      tool_name: "Bash",
      tool_input: {
        command: "rm -rf /",
      },
    };

    const runtimeRules: RuntimeRules = {
      secretRules: [],
      fileRules: [],
      commandRules: [],
    };

    expect(handlePreToolUse(input, runtimeRules)).toBeUndefined();
  });
});

function getRuntimeRulesForTests(): RuntimeRules {
  return {
    secretRules: [],
    fileRules: [],
    commandRules: [
      {
        id: "git-reset-hard",
        description: "Hard reset git history",
        pattern: /git\s+reset\s+--hard/,
        severity: "high",
      },
      {
        id: "chmod-777",
        description: "Set world-writable permissions",
        pattern: /chmod\s+(?:-[a-zA-Z]+\s+)*777\s/,
        severity: "medium",
      },
    ],
  };
}

describe("handleCodexPreToolUse", () => {
  it("denies dangerous bash commands", () => {
    const input: HookInput = {
      hook_event_name: "PreToolUse",
      tool_name: "Bash",
      tool_input: {
        command: "rm -rf /",
      },
    };

    const output = handleCodexPreToolUse(input, undefined, { preset: "balanced" });
    expect(output?.hookSpecificOutput?.permissionDecision).toBe("deny");
    expect(output?.hookSpecificOutput?.permissionDecisionReason).toContain("VibeGuard blocked this Codex Bash action");
  });

  it("emits valid visible context instead of denying medium-severity commands", () => {
    const input: HookInput = {
      hook_event_name: "PreToolUse",
      tool_name: "Bash",
      tool_input: {
        command: "chmod 777 /var/www",
      },
    };

    const output = handleCodexPreToolUse(input, undefined, { preset: "balanced" });
    expect(output?.hookSpecificOutput).not.toHaveProperty("permissionDecision");
    expect(output).toEqual(expect.objectContaining({
      systemMessage: expect.stringContaining("VibeGuard flagged this Codex Bash action"),
    }));
    expect(output?.hookSpecificOutput?.additionalContext).toContain("VibeGuard flagged this Codex Bash action");
  });

  it("denies secrets in apply_patch payloads", () => {
    const input: HookInput = {
      hook_event_name: "PreToolUse",
      tool_name: "apply_patch",
      tool_input: {
        patch: `+const key = "${"sk-ant-" + "a".repeat(80)}";`,
      },
    };

    const output = handleCodexPreToolUse(input, undefined, { preset: "balanced" });
    expect(output?.hookSpecificOutput?.permissionDecision).toBe("deny");
    expect(output?.hookSpecificOutput?.permissionDecisionReason).toContain("Anthropic API Key");
  });
});

describe("handleUserPromptSubmit", () => {
  it("blocks critical secrets in chat prompts", () => {
    const input: UserPromptInput = {
      hook_event_name: "UserPromptSubmit",
      prompt: `Here is the key: ${"sk-ant-" + "a".repeat(80)}`,
    };

    const output = handleUserPromptSubmit(input, undefined, "UserPrompt", { preset: "balanced" });
    expect(output).toEqual(
      expect.objectContaining({
        decision: "block",
        reason: expect.stringContaining("VibeGuard blocked this message"),
      })
    );
  });

  it("warns on medium-severity generic secrets", () => {
    const input: UserPromptInput = {
      hook_event_name: "UserPromptSubmit",
      prompt: 'token = "temporary-secret-value"',
    };

    const output = handleUserPromptSubmit(input, undefined, "UserPrompt", { preset: "balanced" });
    expect(output).toEqual(
      expect.objectContaining({
        additionalContext: expect.stringContaining("VibeGuard warning"),
      })
    );
  });

  it("emits a valid Codex UserPromptSubmit warning", () => {
    const input: UserPromptInput = {
      hook_event_name: "UserPromptSubmit",
      prompt: 'token = "temporary-secret-value"',
    };

    const output = handleCodexUserPromptSubmit(input, undefined, { preset: "balanced" });
    expect(output).toEqual(expect.objectContaining({
      systemMessage: expect.stringContaining("VibeGuard warning"),
      hookSpecificOutput: {
        hookEventName: "UserPromptSubmit",
        additionalContext: expect.stringContaining("VibeGuard warning"),
      },
    }));
    expect(output).not.toHaveProperty("additionalContext");
  });

  it("returns no output for safe prompts", () => {
    const input: UserPromptInput = {
      hook_event_name: "UserPromptSubmit",
      prompt: "Please explain this function.",
    };

    expect(handleUserPromptSubmit(input)).toBeUndefined();
  });

  it("blocks prompts matched by runtime custom secret rules", () => {
    const input: UserPromptInput = {
      hook_event_name: "UserPromptSubmit",
      prompt: "INTERNAL_ABCDEF123456",
    };

    const runtimeRules: RuntimeRules = {
      secretRules: [
        {
          id: "custom-internal-secret",
          description: "Internal token",
          regex: /INTERNAL_[A-Z0-9]{12}/,
          severity: "high",
        },
      ],
      fileRules: [],
      commandRules: [],
    };

    const output = handleUserPromptSubmit(input, runtimeRules, "UserPrompt", { preset: "balanced" });
    expect(output).toEqual(
      expect.objectContaining({
        decision: "block",
        reason: expect.stringContaining("Internal token"),
      })
    );
  });
});
