export type Severity = "critical" | "high" | "medium" | "low";
export type Category = "secret" | "sensitive-file" | "dangerous-command";

export interface Finding {
  rule_id: string;
  category: Category;
  severity: Severity;
  description: string;
  match: string; // redacted
  location?: string;
  line?: number;
}

export interface ScanResult {
  blocked: boolean;
  findings: Finding[];
}

export interface SecretRule {
  id: string;
  description: string;
  regex: RegExp;
  keywords?: string[];
  severity: Severity;
  allowlist?: {
    regexes?: RegExp[];
    paths?: RegExp[];
  };
}

export interface FileRule {
  id: string;
  description: string;
  pattern: RegExp;
  severity: Severity;
}

export interface CommandRule {
  id: string;
  description: string;
  pattern: RegExp;
  severity: Severity;
}

export interface HookInput {
  hook_event_name: string;
  tool_name: string;
  tool_input: Record<string, unknown>;
  session_id?: string;
  cwd?: string;
}

export interface UserPromptInput {
  hook_event_name: "UserPromptSubmit";
  session_id?: string;
  cwd?: string;
  prompt: string;
}

export interface HookOutput {
  systemMessage?: string;
  hookSpecificOutput?: {
    hookEventName: string;
    permissionDecision?: "allow" | "deny" | "ask";
    permissionDecisionReason?: string;
    additionalContext?: string;
  };
}

export interface UserPromptOutput {
  decision?: "block";
  reason?: string;
  systemMessage?: string;
  hookSpecificOutput?: {
    hookEventName: "UserPromptSubmit";
    additionalContext?: string;
  };
}
