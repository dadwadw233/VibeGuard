import { mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { readPolicy, shouldBlockSeverity, writePolicy } from "../policy.js";

describe("policy presets", () => {
  let tempDir: string;
  let previousHome: string | undefined;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "vibeguard-policy-"));
    previousHome = process.env.VIBEGUARD_HOME_DIR;
    process.env.VIBEGUARD_HOME_DIR = tempDir;
  });

  afterEach(() => {
    process.env.VIBEGUARD_HOME_DIR = previousHome;
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("defaults to balanced", () => {
    expect(readPolicy()).toEqual({ preset: "balanced" });
  });

  it("writes and reads a preset", () => {
    writePolicy({ preset: "strict" });
    expect(readPolicy()).toEqual({ preset: "strict" });
  });

  it("maps severities to blocking decisions", () => {
    expect(shouldBlockSeverity("high", { preset: "minimal" })).toBe(false);
    expect(shouldBlockSeverity("critical", { preset: "minimal" })).toBe(true);
    expect(shouldBlockSeverity("high", { preset: "balanced" })).toBe(true);
    expect(shouldBlockSeverity("medium", { preset: "balanced" })).toBe(false);
    expect(shouldBlockSeverity("medium", { preset: "strict" })).toBe(true);
  });
});
