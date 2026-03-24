import { describe, expect, it } from "vitest";
import { getCodexRemovalMessage, parseLaunchArgs, parseTarget } from "../index.js";

describe("CLI argument validation", () => {
  it("defaults install and doctor targets to Claude", () => {
    expect(parseTarget([])).toEqual(["claude"]);
  });

  it("rejects removed Codex targets with migration guidance", () => {
    expect(() => parseTarget(["--target", "codex"])).toThrow(getCodexRemovalMessage());
    expect(() => parseTarget(["--target", "all"])).toThrow(getCodexRemovalMessage());
  });

  it("rejects removed Codex launch usage with migration guidance", () => {
    expect(() => parseLaunchArgs(["codex", "--", "--help"])).toThrow(getCodexRemovalMessage());
  });

  it("parses Claude launch passthrough arguments", () => {
    expect(parseLaunchArgs(["claude", "--", "--help"])).toEqual({
      host: "claude",
      passthrough: ["--help"],
    });
  });
});
