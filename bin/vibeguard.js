#!/usr/bin/env node

const command = process.argv[2];

switch (command) {
  case "dashboard":
    import("../dist/dashboard/server.js");
    break;
  case "hook":
    import("../dist/hooks/pre-tool-use.js");
    break;
  case "mcp":
    import("../dist/mcp/server.js");
    break;
  default:
    console.log(`
🛡️  VibeGuard - Security Guard for AI Coding Agents

Usage:
  vibeguard dashboard    Start the security dashboard (http://localhost:7847)
  vibeguard hook         Run the hook handler (used internally by Claude Code)
  vibeguard mcp          Start the MCP server (used internally by Claude Code)

For more info: https://github.com/dadwadw233/VibeGuard
`);
}
