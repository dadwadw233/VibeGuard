import { chmodSync, mkdtempSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { findExecutable } from "../command-utils.js";

describe("findExecutable", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "vibeguard-command-utils-"));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("finds executables on non-Windows platforms", () => {
    const executable = join(tempDir, "claude");
    writeFileSync(executable, "#!/bin/sh\nexit 0\n", "utf-8");
    chmodSync(executable, 0o755);

    const found = findExecutable("claude", {
      platform: "darwin",
      pathValue: tempDir,
    });

    expect(found).toBe(executable);
  });

  it("resolves Windows PATHEXT candidates when command has no extension", () => {
    const executable = join(tempDir, "claude.cmd");
    writeFileSync(executable, "@echo off\r\n", "utf-8");
    chmodSync(executable, 0o755);

    const found = findExecutable("claude", {
      platform: "win32",
      pathValue: tempDir,
      pathExt: "EXE;cmd",
    });

    expect(found).toBe(executable);
  });

  it("uses the exact command name when an extension is already provided", () => {
    const executable = join(tempDir, "claude.exe");
    writeFileSync(executable, "", "utf-8");
    chmodSync(executable, 0o755);

    const found = findExecutable("claude.exe", {
      platform: "win32",
      pathValue: tempDir,
      pathExt: ".EXE;.CMD",
    });

    expect(found).toBe(executable);
  });
});
