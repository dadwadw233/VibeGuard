#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { scanContent, scanCommand, scanFilePath } from "../scanner/index.js";
import { getEvents, getStats } from "../store/index.js";

const server = new McpServer({
  name: "vibeguard",
  version: "0.1.0",
});

server.tool(
  "scan_text",
  "Scan text content for secrets, API keys, tokens, and passwords",
  {
    text: z.string().describe("Text content to scan for secrets"),
    context: z.string().optional().describe("File path or context description"),
  },
  async ({ text, context }) => {
    const result = scanContent(text, context);
    return {
      content: [
        {
          type: "text" as const,
          text: result.findings.length === 0
            ? "No secrets detected."
            : `Found ${result.findings.length} issue(s):\n${result.findings.map((f) => `- [${f.severity.toUpperCase()}] ${f.description}: ${f.match}`).join("\n")}`,
        },
      ],
    };
  }
);

server.tool(
  "scan_file",
  "Check if a file path points to a sensitive file (credentials, keys, etc.)",
  {
    file_path: z.string().describe("File path to check"),
  },
  async ({ file_path }) => {
    const result = scanFilePath(file_path);
    return {
      content: [
        {
          type: "text" as const,
          text: result.findings.length === 0
            ? "File path appears safe."
            : `Sensitive file detected:\n${result.findings.map((f) => `- [${f.severity.toUpperCase()}] ${f.description}`).join("\n")}`,
        },
      ],
    };
  }
);

server.tool(
  "scan_command",
  "Check if a bash command is potentially dangerous (destructive operations, etc.)",
  {
    command: z.string().describe("Bash command to analyze"),
  },
  async ({ command }) => {
    const result = scanCommand(command);
    return {
      content: [
        {
          type: "text" as const,
          text: result.findings.length === 0
            ? "Command appears safe."
            : `Dangerous command detected:\n${result.findings.map((f) => `- [${f.severity.toUpperCase()}] ${f.description}`).join("\n")}`,
        },
      ],
    };
  }
);

server.tool(
  "get_security_events",
  "Retrieve recent security events logged by VibeGuard",
  {
    limit: z.number().optional().default(20).describe("Number of events to retrieve"),
    category: z.enum(["secret", "sensitive-file", "dangerous-command"]).optional().describe("Filter by category"),
  },
  async ({ limit, category }) => {
    const events = getEvents({ limit, category });
    return {
      content: [
        {
          type: "text" as const,
          text: events.length === 0
            ? "No security events recorded."
            : JSON.stringify(events, null, 2),
        },
      ],
    };
  }
);

server.tool(
  "get_security_stats",
  "Get aggregate security statistics from VibeGuard",
  {},
  async () => {
    const stats = getStats();
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(stats, null, 2),
        },
      ],
    };
  }
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error("VibeGuard MCP server error:", err);
  process.exit(1);
});
