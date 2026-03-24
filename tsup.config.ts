import { defineConfig } from "tsup";

export default defineConfig([
  {
    entry: {
      cli: "src/cli/index.ts",
      "hooks/pre-tool-use": "src/hooks/pre-tool-use.ts",
      "hooks/user-prompt-submit": "src/hooks/user-prompt-submit.ts",
      "mcp/server": "src/mcp/server.ts",
      "dashboard/server": "src/dashboard/server.ts",
    },
    format: ["esm"],
    target: "node22",
    platform: "node",
    splitting: true,
    sourcemap: true,
    clean: true,
    outDir: "dist",
    banner: {
      js: "import { createRequire } from 'module'; const require = createRequire(import.meta.url);",
    },
  },
]);
