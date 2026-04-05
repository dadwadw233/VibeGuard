<div align="center">

# &#128737;&#65039; VibeGuard

**Security plugin for Claude Code — detects secrets, blocks dangerous commands, and logs every tool action.**

[![npm version][npm-badge]][npm-url]
[![License: MIT][license-badge]](LICENSE)
[![GitHub stars][stars-badge]][stars-url]

[npm-badge]: https://img.shields.io/npm/v/%40embodot/vibeguard?color=14b8a6&style=flat-square
[npm-url]: https://www.npmjs.com/package/%40embodot/vibeguard
[license-badge]: https://img.shields.io/badge/license-MIT-14b8a6?style=flat-square
[stars-badge]: https://img.shields.io/github/stars/dadwadw233/VibeGuard?color=f59e0b&style=flat-square
[stars-url]: https://github.com/dadwadw233/VibeGuard

</div>

---

## Overview

VibeGuard sits between Claude Code and your filesystem as a tool hook. Before any shell command runs or any file is written, VibeGuard intercepts the call, scans for secrets and dangerous patterns, and either allows, warns, or blocks the action — giving you an audit trail along the way.

## What it catches

**Secrets in file content and command arguments**

| Pattern | Example shape |
|---|---|
| OpenAI / Anthropic API keys | `sk-proj-...`, `sk-ant-...` |
| AWS access keys | `AKIA...` followed by 16 alphanumeric characters |
| Generic API key assignments | `api_key = "<value>"` |
| Passwords in connection strings | `postgres://user:hunter2&#64;db.example.com/mydb` |
| PEM private key blocks | `BEGIN PRIVATE KEY` header line and base64 body |

**Dangerous shell commands**

| Command | Why it is blocked |
|---|---|
| `rm -rf /` | Wipes the root filesystem |
| `rm -rf ~` / `rm -rf $HOME` | Wipes the home directory |
| `chmod 777 /etc` | Removes all permission boundaries |
| Recursive deletes inside home subdirectories | e.g. `rm -rf ~/projects` |
| Pipe-to-shell patterns | e.g. `curl ... \| bash` |

---

## How it works

```
You type  →  Claude calls tool  →  VibeGuard hook intercepts  →  Scan  →  Allow / Block / Warn
```

Internally:

1. Claude Code fires a `PreToolUse` hook before every tool invocation.
2. VibeGuard receives the tool name and full input payload as JSON on stdin.
3. The scanner checks content against a set of regex rules for secrets and command patterns.
4. VibeGuard writes a structured log entry, then exits `0` (allow), `2` (block), or outputs a warning to stderr.
5. Claude Code respects the exit code and either proceeds or surfaces the block reason to you.

---

## Installation

```bash
npm install -g &#64;embodot/vibeguard
```

Verify the install:

```bash
vibeguard --version
```

### Register with Claude Code

```bash
vibeguard install
```

This writes the hook entry into your Claude Code settings (`~/.claude/settings.json`). To confirm:

```bash
vibeguard status
```

---

## Commands

| Command | Description |
|---|---|
| `vibeguard install` | Register hooks in Claude Code settings |
| `vibeguard uninstall` | Remove hooks from Claude Code settings |
| `vibeguard status` | Show current hook registration and config path |
| `vibeguard logs` | Stream the live action log |
| `vibeguard logs --tail 50` | Show last 50 log entries |
| `vibeguard dashboard` | Open the terminal dashboard (requires a TTY) |
| `vibeguard audit` | Print a summary report of blocked/warned events |
| `vibeguard config` | Print resolved configuration |

---

## Dashboard

`vibeguard dashboard` renders a live terminal UI showing:

- Real-time tool call feed with allow / block / warn status
- Rolling count of events per tool type
- Last blocked command and reason

Requires a true terminal (does not work over a plain pipe). Exit with `q` or `Ctrl-C`.

---

## Configuration

VibeGuard reads configuration from the first file found in this order:

1. `VIBEGUARD_CONFIG` environment variable (path to a JSON file)
2. `.vibeguard.json` in the current working directory
3. `~/.config/vibeguard/config.json`

**Example `.vibeguard.json`**

```json
{
  "logPath": "~/.vibeguard/actions.log",
  "blockSecrets": true,
  "blockDangerousCommands": true,
  "warnOnly": false,
  "allowlist": [
    "Read",
    "ListDirectory"
  ],
  "extraSecretPatterns": [
    "MY_INTERNAL_TOKEN_[A-Z0-9]+"
  ]
}
```

| Key | Type | Default | Description |
|---|---|---|---|
| `logPath` | string | `~/.vibeguard/actions.log` | Where to write the action log |
| `blockSecrets` | boolean | `true` | Block tool calls containing secret patterns |
| `blockDangerousCommands` | boolean | `true` | Block known dangerous shell commands |
| `warnOnly` | boolean | `false` | Downgrade all blocks to warnings (still logs) |
| `allowlist` | string[] | `[]` | Tool names to skip scanning entirely |
| `extraSecretPatterns` | string[] | `[]` | Additional regex patterns to treat as secrets |

---

## Log format

Each line in the log is newline-delimited JSON:

```json
{
  "ts": "2026-04-05T10:22:01.443Z",
  "tool": "Bash",
  "action": "blocked",
  "reason": "dangerous_command: rm -rf /",
  "input": { "command": "rm -rf /" }
}
```

`action` is one of `allowed`, `warned`, or `blocked`.

---

## Troubleshooting

**Hooks are not firing**

Run `vibeguard status` and confirm the hook appears under `PreToolUse` in the output. If not, re-run `vibeguard install` and restart Claude Code.

**Claude Code shows "hook exited with code 2"**

That is VibeGuard blocking a call. Check `vibeguard logs --tail 10` for the reason.

**False positive on a legitimate secret-shaped string**

Add the tool to `allowlist` or set `warnOnly: true` while you investigate. Open an issue if the built-in rules need tuning.

**Writing documentation that contains example secret patterns**

VibeGuard scans the literal bytes being written. If you are documenting what VibeGuard detects, add `Write` to `allowlist` for that session or set `warnOnly: true` temporarily.

**Dashboard does not render correctly**

Ensure your terminal supports at least 80 columns and a 256-color profile. Prefixing with `TERM=xterm-256color` usually resolves rendering issues.

---

## Migration

### 0.x to 1.0

- The hook binary was renamed from `vg-hook` to `vibeguard`. Re-run `vibeguard install` to update the settings entry.
- `logFile` config key is now `logPath`. The old key still works but is deprecated and will be removed in 2.0.
- `dangerousPatterns` array is now `extraSecretPatterns` (scope broadened). Rename the key in your config.

---

## Development

```bash
git clone https://github.com/dadwadw233/VibeGuard.git
cd VibeGuard
npm install
npm run build
npm test
```

To test the hook locally without a global install, point Claude Code at the built binary:

```bash
node dist/hook.js
```

Or register the local build directly:

```bash
node dist/cli.js install --bin ./dist/hook.js
```

**Running the test suite**

```bash
npm test              # unit tests
npm run test:e2e      # end-to-end hook integration tests (requires Claude Code CLI)
npm run lint
```

---

## Contributing

Pull requests are welcome. For significant changes, open an issue first to discuss scope.

- Follow the existing code style (`npm run lint` must pass).
- All new detection rules must include a unit test covering both a true-positive and a true-negative case.
- Do not weaken existing block rules without a security rationale in the PR description.

---

## License

MIT. See [LICENSE](LICENSE).
