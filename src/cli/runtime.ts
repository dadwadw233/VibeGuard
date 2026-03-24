import { existsSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

export interface RuntimePaths {
  packageRoot: string;
  distDir: string;
  cliEntry: string;
  preToolUseHook: string;
  userPromptHook: string;
  mcpServer: string;
  dashboardServer: string;
  dashboardPublicDir: string;
  nodeBinary: string;
}

export function getRuntimePaths(): RuntimePaths {
  const packageJsonPath = fileURLToPath(new URL("../package.json", import.meta.url));
  const packageRoot = dirname(packageJsonPath);
  const distDir = join(packageRoot, "dist");

  return {
    packageRoot,
    distDir,
    cliEntry: join(distDir, "cli.js"),
    preToolUseHook: join(distDir, "hooks", "pre-tool-use.js"),
    userPromptHook: join(distDir, "hooks", "user-prompt-submit.js"),
    mcpServer: join(distDir, "mcp", "server.js"),
    dashboardServer: join(distDir, "dashboard", "server.js"),
    dashboardPublicDir: join(distDir, "dashboard", "public"),
    nodeBinary: process.execPath,
  };
}

export function getMissingArtifacts(paths: RuntimePaths): string[] {
  const required = [
    paths.cliEntry,
    paths.preToolUseHook,
    paths.userPromptHook,
    paths.mcpServer,
    paths.dashboardServer,
    paths.dashboardPublicDir,
  ];

  return required.filter((artifactPath) => !existsSync(artifactPath));
}
