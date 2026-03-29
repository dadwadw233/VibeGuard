# VibeGuard

Security guard for Claude Code. VibeGuard detects secrets, flags dangerous operations, records security events locally, and exposes a dashboard plus MCP tools for Claude workflows.

## Highlights

- Secret detection for common API keys, tokens, passwords, private keys, and connection strings
- Claude real-time protection for `Bash`, `Write`, `Edit`, `Read`, and `UserPromptSubmit`
- Local SQLite event log with a lightweight dashboard
- Managed installation flow that does not require cloning the repo

## Install

Preferred install path:

```bash
npm install -g @embodot/vibeguard
vibeguard install
vibeguard doctor
```

If npm publish is not available yet in your environment, use Git install:

```bash
npm install -g git+ssh://git@github.com/dadwadw233/VibeGuard.git#main
vibeguard install
vibeguard doctor
```

### From a local checkout

```bash
git clone git@github.com:dadwadw233/VibeGuard.git
cd VibeGuard
npm install
npm run build
npm install -g .
vibeguard install
vibeguard doctor
```

`install` configures Claude using the installed package location.

### Claude

```bash
vibeguard install --target claude
vibeguard launch claude -- --help
```

Claude integration includes:

- `PreToolUse` hooks for `Bash|Write|Edit|Read`
- `UserPromptSubmit` secret scanning
- optional MCP registration when the `claude` CLI is available

To remove managed Claude integration:

```bash
vibeguard uninstall --target claude
```

## Commands

```bash
vibeguard install [--target claude]
vibeguard uninstall [--target claude]
vibeguard doctor [--target claude]
vibeguard launch claude -- <claude args...>
vibeguard dashboard
vibeguard mcp
```

## Troubleshooting

### Native module mismatch (`better-sqlite3`)

If `vibeguard doctor` reports a native module error or `vibeguard dashboard` returns 500 errors:

```bash
npm rebuild better-sqlite3
vibeguard doctor
```

If you switched Node versions (for example via `nvm`), reinstall the global package in the active Node version:

```bash
npm install -g @embodot/vibeguard
vibeguard install
vibeguard doctor
```

## Dashboard

```bash
vibeguard dashboard
```

Open [http://localhost:7847](http://localhost:7847).

The dashboard provides:

- overview statistics and daily trends
- filterable event history
- rule browsing and custom pattern management

## How It Works

1. `vibeguard install` updates `~/.claude/settings.json` idempotently.
2. Claude invokes the VibeGuard hook scripts before matching operations run.
3. High-severity findings are blocked. Medium and low findings request confirmation or inject warnings.
4. Findings are recorded in `~/.vibeguard/events.db`.

## Migration Note

Codex support has been removed from VibeGuard. If you previously registered the MCP server with Codex, remove it with:

```bash
codex mcp remove vibeguard
```

## Development

```bash
npm install
npm run build
npm test
```

### Repo-local plugin workflow

Repo-local plugin loading is still available for development and debugging, but it is no longer the recommended end-user install path.

```bash
claude --plugin-dir /path/to/VibeGuard
```

You can also wire the built hook scripts manually by pointing Claude settings at:

- `dist/hooks/pre-tool-use.js`
- `dist/hooks/user-prompt-submit.js`
- `dist/mcp/server.js`

## Event Storage

All findings are logged to a local SQLite database at `~/.vibeguard/events.db`.

Managed installation metadata is stored at `~/.vibeguard/install-state.json`.

## License

MIT
