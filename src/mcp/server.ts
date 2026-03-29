#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import {
  renderScanCommandResult,
  renderScanFileResult,
  renderScanTextResult,
  renderSecurityEvents,
  renderSecurityStats,
} from "./tools.js";

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
    return {
      content: [
        {
          type: "text" as const,
          text: renderScanTextResult(text, context),
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
    return {
      content: [
        {
          type: "text" as const,
          text: renderScanFileResult(file_path),
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
    return {
      content: [
        {
          type: "text" as const,
          text: renderScanCommandResult(command),
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
    return {
      content: [
        {
          type: "text" as const,
          text: renderSecurityEvents(limit, category),
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
    return {
      content: [
        {
          type: "text" as const,
          text: renderSecurityStats(),
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
