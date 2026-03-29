import { mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getInstallStatePath } from "../../paths.js";
import { createEmptyInstallState, readInstallState, updateInstallState } from "../install-state.js";

describe("install state", () => {
  let tempHome: string;
  let previousHome: string | undefined;

  beforeEach(() => {
    tempHome = mkdtempSync(join(tmpdir(), "vibeguard-state-"));
    previousHome = process.env.VIBEGUARD_HOME_DIR;
    process.env.VIBEGUARD_HOME_DIR = tempHome;
  });

  afterEach(() => {
    process.env.VIBEGUARD_HOME_DIR = previousHome;
    rmSync(tempHome, { recursive: true, force: true });
  });

  it("returns an empty state when no file exists", () => {
    expect(readInstallState()).toEqual(createEmptyInstallState());
  });

  it("persists updates under the managed vibeguard directory", () => {
    const result = updateInstallState("/pkg/root", (current) => ({
      ...current,
      targets: {
        ...current.targets,
        claude: {
          installedAt: "2026-03-24T00:00:00.000Z",
          configPath: "/tmp/settings.json",
          mcpRegistered: true,
        },
      },
    }));

    expect(getInstallStatePath()).toBe(join(tempHome, "install-state.json"));
    expect(result.packageRoot).toBe("/pkg/root");
    expect(readInstallState().targets.claude?.configPath).toBe("/tmp/settings.json");
  });
});
