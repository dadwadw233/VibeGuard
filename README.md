# VibeGuard

Security guard for AI coding agents. Detects secrets, blocks dangerous operations, and provides a security dashboard.

## Features

- **Secret Detection** - Detects API keys, tokens, passwords, private keys in code (~30 rules covering AWS, GitHub, Anthropic, OpenAI, Stripe, Slack, Google, and more)
- **User Prompt Protection** - Scans user chat messages for secrets before they are sent to the AI, blocking accidental credential sharing
- **Sensitive File Protection** - Warns when agents read `.env`, SSH keys, cloud credentials, certificates
- **Dangerous Command Prevention** - Blocks `rm -rf /`, `DROP TABLE`, force push to main, and other destructive operations
- **Security Dashboard** - Web UI to view event history, manage rules, and add custom patterns
- **MCP Server** - On-demand scanning tools for coding agents

## Quick Start

```bash
# Install dependencies
npm install

# Build
npm run build

# Run tests
npm test
```

## Integration with Claude Code

### As a Plugin

```bash
claude --plugin-dir /path/to/VibeGuard
```

### Manual Hook Setup

Add to `~/.claude/settings.json`:

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash|Write|Edit|Read",
        "hooks": [
          {
            "type": "command",
            "command": "node /path/to/VibeGuard/dist/hooks/pre-tool-use.js",
            "timeout": 5
          }
        ]
      }
    ],
    "UserPromptSubmit": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "node /path/to/VibeGuard/dist/hooks/user-prompt-submit.js",
            "timeout": 5
          }
        ]
      }
    ]
  }
}
```

### MCP Server

Add to `.mcp.json` or Claude Code settings:

```json
{
  "mcpServers": {
    "vibeguard": {
      "command": "node",
      "args": ["/path/to/VibeGuard/dist/mcp/server.js"],
      "type": "stdio"
    }
  }
}
```

## Dashboard

```bash
npm run dashboard
# Open http://localhost:7847
```

The dashboard provides:
- **Overview** - Event statistics and daily trend charts
- **Events** - Filterable list of all security events
- **Rules** - Enable/disable rules and add custom patterns

## How It Works

VibeGuard integrates via Claude Code's hook system at two levels:

### User Prompt Protection (`UserPromptSubmit`)
When a user submits a chat message, VibeGuard scans it for secrets **before** it reaches the AI:
- **Critical/High** severity: message is **blocked** and erased from context
- **Medium/Low** severity: a warning is injected as context for the AI

### Tool Operation Protection (`PreToolUse`)
Before any Write, Edit, Read, or Bash operation executes:
1. The hook receives the operation details via stdin (JSON)
2. The scanner engine checks against detection rules
3. **Critical/High** severity findings: operation is **blocked** (denied)
4. **Medium/Low** severity findings: user is **asked** to confirm

All findings from both hooks are logged to a local SQLite database (`~/.vibeguard/events.db`).

## Detection Rules

### Secrets (~30 rules)
AWS keys, GitHub PATs, Anthropic/OpenAI API keys, Stripe keys, Slack tokens, Google API keys, SendGrid keys, NPM tokens, private keys, database connection strings, JWTs, and generic patterns.

### Sensitive Files
`.env`, `.ssh/`, `.aws/credentials`, `.docker/config.json`, `.kube/config`, `*.pem`, `*.key`, and files with `credential`/`secret`/`password` in the name.

### Dangerous Commands
`rm -rf /`, `DROP TABLE/DATABASE`, `git push --force` to main, `git reset --hard`, `curl | sh`, `chmod 777`, `dd`, `mkfs`, `shutdown`, and more.

## Custom Rules

Add custom rules via the dashboard or the MCP `scan_text` tool. Rules use regex patterns and support severity levels (critical, high, medium, low).

## License

MIT
