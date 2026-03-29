import { mkdtempSync, rmSync, writeFileSync } from "fs";
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
      runtime: {
        nodeBinary: "/usr/local/bin/node",
        nodeVersion: "v22.0.0",
        packageVersion: "0.1.1",
      },
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
    expect(result.runtime?.packageVersion).toBe("0.1.1");
    expect(readInstallState().targets.claude?.configPath).toBe("/tmp/settings.json");
  });

  it("reads legacy state files without runtime metadata", () => {
    writeFileSync(
      getInstallStatePath(),
      JSON.stringify({
        version: 1,
        packageRoot: "/pkg/legacy",
        updatedAt: "2026-03-01T00:00:00.000Z",
        targets: {},
      }),
      "utf-8"
    );

    const state = readInstallState();
    expect(state.packageRoot).toBe("/pkg/legacy");
    expect(state.runtime).toBeUndefined();
  });
});
