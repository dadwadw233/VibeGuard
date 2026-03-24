#!/usr/bin/env node

import("../dist/cli.js")
  .then(({ main }) => main())
  .catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`VibeGuard error: ${message}`);
    process.exit(1);
  });
