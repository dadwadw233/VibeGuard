import { existsSync, readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

export interface RuntimePaths {
  packageRoot: string;
  packageName: string;
  packageVersion: string;
  distDir: string;
  cliEntry: string;
  preToolUseHook: string;
  userPromptHook: string;
  codexPreToolUseHook: string;
  codexUserPromptHook: string;
  mcpServer: string;
  dashboardServer: string;
  dashboardPublicDir: string;
  nodeBinary: string;
}

export function getRuntimePaths(): RuntimePaths {
  const packageJsonPath = fileURLToPath(new URL("../package.json", import.meta.url));
  const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf-8")) as {
    name?: string;
    version?: string;
  };
  const packageRoot = dirname(packageJsonPath);
  const distDir = join(packageRoot, "dist");

  return {
    packageRoot,
    packageName: packageJson.name ?? "vibeguard",
    packageVersion: packageJson.version ?? "0.0.0",
    distDir,
    cliEntry: join(distDir, "cli.js"),
    preToolUseHook: join(distDir, "hooks", "pre-tool-use.js"),
    userPromptHook: join(distDir, "hooks", "user-prompt-submit.js"),
    codexPreToolUseHook: join(distDir, "hooks", "codex-pre-tool-use.js"),
    codexUserPromptHook: join(distDir, "hooks", "codex-user-prompt-submit.js"),
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
    paths.codexPreToolUseHook,
    paths.codexUserPromptHook,
    paths.mcpServer,
    paths.dashboardServer,
    paths.dashboardPublicDir,
  ];

  return required.filter((artifactPath) => !existsSync(artifactPath));
}
