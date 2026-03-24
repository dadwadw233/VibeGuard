import { defineConfig } from "tsup";

export default defineConfig([
  {
    entry: {
      "hooks/pre-tool-use": "src/hooks/pre-tool-use.ts",
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
