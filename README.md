<div align="center">

# VibeGuard

**Security guard for Claude Code and Codex. Detect secrets, block dangerous operations, and keep a local audit trail.**

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

VibeGuard installs managed hooks for Claude Code and Codex. Before supported prompts, shell commands, file writes, or edits proceed, VibeGuard scans for secrets and dangerous patterns, then allows, warns, asks for confirmation, or blocks based on the active policy preset.

## What It Catches

- API keys and tokens for OpenAI, Anthropic, AWS, GitHub, GitLab, Stripe, Slack, SendGrid, NPM, PyPI, and more
- Private keys, database URLs with passwords, generic secret assignments, JWTs, and password URLs
- Sensitive files such as `.env`, SSH keys, AWS credentials, Docker/Kubernetes configs, shell history, and `.netrc`
- Dangerous commands such as `rm -rf /`, `mkfs`, `dd of=/dev/...`, fork bombs, force push to main, pipe-to-shell, and destructive SQL

## Install

```bash
npm install -g @embodot/vibeguard
vibeguard install
vibeguard doctor
```

By default, `vibeguard install` configures Claude only. Use explicit targets for Codex or both hosts:

```bash
vibeguard install --target codex
vibeguard install --target all
```

## Claude

```bash
vibeguard install --target claude
vibeguard launch claude -- --help
```

Claude integration includes `PreToolUse` hooks for `Bash|Write|Edit|Read`, `UserPromptSubmit` secret scanning, optional MCP registration, and dashboard logging.

## Codex

Codex support uses official Codex hooks. It does not use the old PTY/TUI proxy approach.

```bash
vibeguard install --target codex
vibeguard doctor --target codex
vibeguard launch codex -- --help
```

Codex integration includes `UserPromptSubmit` secret scanning, `PreToolUse` scanning for supported tool events such as `Bash`, `apply_patch`, `Edit`, and `Write`, and dashboard logging. Coverage follows the official Codex hook surface. If Codex asks you to review hooks, trust the VibeGuard entries from `/hooks` before relying on enforcement.

## Policy Presets

VibeGuard defaults to `balanced`.

```bash
vibeguard config preset
vibeguard config preset minimal
vibeguard config preset balanced
vibeguard config preset strict
```

- `minimal`: block critical findings only
- `balanced`: block critical and high findings
- `strict`: block critical, high, and medium findings

Policy is stored at `~/.vibeguard/policy.json`.

## Commands

```bash
vibeguard install [--target claude|codex|all]
vibeguard uninstall [--target claude|codex|all]
vibeguard doctor [--target claude|codex|all]
vibeguard launch claude -- <claude args...>
vibeguard launch codex -- <codex args...>
vibeguard config preset [minimal|balanced|strict]
vibeguard dashboard
vibeguard mcp
```

## Dashboard

```bash
vibeguard dashboard
```

Open [http://localhost:7847](http://localhost:7847). The dashboard shows overview statistics, daily trends, filterable event history, rule browsing, and custom pattern management.

## How It Works

1. `vibeguard install` updates `~/.claude/settings.json` idempotently.
2. `vibeguard install --target codex` updates `~/.codex/hooks.json` idempotently.
3. Claude or Codex invokes the VibeGuard hook scripts before supported operations run.
4. VibeGuard scans with built-in rules plus dashboard-managed overrides and custom patterns.
5. Findings are logged to `~/.vibeguard/events.db`.

## Auto Update

VibeGuard checks for new npm versions automatically when you run CLI commands and attempts a global update when a newer version is found.

Disable this behavior if needed:

```bash
export VIBEGUARD_DISABLE_AUTO_UPDATE=1
```

## Troubleshooting

### Native module mismatch (`better-sqlite3`)

If `vibeguard doctor` reports a native module error or `vibeguard dashboard` returns 500 errors:

```bash
npm rebuild better-sqlite3
vibeguard doctor
```

If you switched Node versions, reinstall the global package in the active Node version:

```bash
npm install -g @embodot/vibeguard
vibeguard install
vibeguard doctor
```

## Development

```bash
git clone https://github.com/dadwadw233/VibeGuard.git
cd VibeGuard
npm install
npm run build
npm test
```

Repo-local plugin loading is still available for Claude development and debugging, but it is not the recommended end-user install path.

```bash
claude --plugin-dir /path/to/VibeGuard
```

Built entrypoints:

- `dist/hooks/pre-tool-use.js`
- `dist/hooks/user-prompt-submit.js`
- `dist/hooks/codex-pre-tool-use.js`
- `dist/hooks/codex-user-prompt-submit.js`
- `dist/mcp/server.js`

## License

MIT
