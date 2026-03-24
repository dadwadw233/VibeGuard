import type { CommandRule } from "./types.js";

export const DANGEROUS_COMMAND_RULES: CommandRule[] = [
  // === Destructive File Operations ===
  {
    id: "rm-rf-root",
    description: "Recursive force delete of root directory",
    pattern: /rm\s+(?:-[a-zA-Z]*[rR][a-zA-Z]*\s+(?:-[a-zA-Z]+\s+)*|(?:-[a-zA-Z]+\s+)*-[a-zA-Z]*[rR][a-zA-Z]*\s+)[/](?:\s|$)/,
    severity: "critical",
  },
  {
    id: "rm-rf-home",
    description: "Recursive force delete of home directory",
    pattern: /rm\s+(?:-[a-zA-Z]*[rR][a-zA-Z]*\s+(?:-[a-zA-Z]+\s+)*|(?:-[a-zA-Z]+\s+)*-[a-zA-Z]*[rR][a-zA-Z]*\s+)~(?:[/\s]|$)/,
    severity: "critical",
  },
  {
    id: "rm-rf-wildcard",
    description: "Recursive force delete with wildcard at dangerous path",
    pattern: /rm\s+-[a-zA-Z]*r[a-zA-Z]*f[a-zA-Z]*\s+(?:\/(?:usr|etc|var|opt|home|boot|sys|proc)|~)\//,
    severity: "critical",
  },

  // === SQL Destruction ===
  {
    id: "drop-table",
    description: "SQL DROP TABLE statement",
    pattern: /DROP\s+TABLE\s/i,
    severity: "high",
  },
  {
    id: "drop-database",
    description: "SQL DROP DATABASE statement",
    pattern: /DROP\s+DATABASE\s/i,
    severity: "critical",
  },
  {
    id: "truncate-table",
    description: "SQL TRUNCATE TABLE statement",
    pattern: /TRUNCATE\s+(?:TABLE\s+)?/i,
    severity: "high",
  },
  {
    id: "delete-without-where",
    description: "SQL DELETE without WHERE clause",
    pattern: /DELETE\s+FROM\s+\S+\s*(?:;|$)/i,
    severity: "medium",
  },

  // === Git Dangerous Operations ===
  {
    id: "git-force-push-main",
    description: "Force push to main/master branch",
    pattern: /git\s+push\s+.*(?:--force|-f)\s.*(?:main|master)|git\s+push\s+.*(?:main|master).*(?:--force|-f)/,
    severity: "critical",
  },
  {
    id: "git-reset-hard",
    description: "Hard reset git history",
    pattern: /git\s+reset\s+--hard/,
    severity: "high",
  },
  {
    id: "git-clean-force",
    description: "Force clean untracked files",
    pattern: /git\s+clean\s+-[a-zA-Z]*f/,
    severity: "medium",
  },

  // === System Destruction ===
  {
    id: "mkfs-format",
    description: "Format disk/partition",
    pattern: /mkfs(?:\.[a-z0-9]+)?\s/,
    severity: "critical",
  },
  {
    id: "dd-disk-write",
    description: "Direct disk write with dd",
    pattern: /dd\s+.*of=\/dev\//,
    severity: "critical",
  },
  {
    id: "fork-bomb",
    description: "Fork bomb",
    pattern: /:\(\)\s*\{\s*:\|:\s*&\s*\}\s*;?\s*:/,
    severity: "critical",
  },

  // === Permission Issues ===
  {
    id: "chmod-777",
    description: "Set world-writable permissions",
    pattern: /chmod\s+(?:-[a-zA-Z]+\s+)*777\s/,
    severity: "medium",
  },
  {
    id: "chmod-recursive-777",
    description: "Recursively set world-writable permissions",
    pattern: /chmod\s+-[a-zA-Z]*R[a-zA-Z]*\s+777\s/,
    severity: "high",
  },

  // === Pipe to Shell ===
  {
    id: "curl-pipe-shell",
    description: "Pipe remote content to shell execution",
    pattern: /curl\s[^|]*\|\s*(?:sudo\s+)?(?:bash|sh|zsh)/,
    severity: "high",
  },
  {
    id: "wget-pipe-shell",
    description: "Pipe remote content to shell execution",
    pattern: /wget\s[^|]*\|\s*(?:sudo\s+)?(?:bash|sh|zsh)/,
    severity: "high",
  },

  // === Environment Manipulation ===
  {
    id: "env-export-secrets",
    description: "Exporting secrets via environment variable",
    pattern: /export\s+(?:AWS_SECRET|ANTHROPIC_API_KEY|OPENAI_API_KEY|DATABASE_PASSWORD|DB_PASSWORD)\s*=/i,
    severity: "medium",
  },

  // === Kill/Shutdown ===
  {
    id: "kill-all",
    description: "Kill all processes",
    pattern: /(?:killall|pkill)\s+-9\s|kill\s+-9\s+-1/,
    severity: "high",
  },
  {
    id: "system-shutdown",
    description: "System shutdown/reboot command",
    pattern: /(?:shutdown|reboot|halt|poweroff)\s/,
    severity: "high",
  },

  // === Credential Access ===
  {
    id: "cat-sensitive-file",
    description: "Read sensitive credential files",
    pattern: /cat\s+(?:~\/)?\.(?:ssh\/id_|aws\/credentials|env|netrc|docker\/config)/,
    severity: "high",
  },
  {
    id: "base64-decode-secrets",
    description: "Decode base64 secrets to stdout",
    pattern: /base64\s+(?:-d|--decode)\s.*(?:key|secret|token|password|credential)/i,
    severity: "medium",
  },
];
