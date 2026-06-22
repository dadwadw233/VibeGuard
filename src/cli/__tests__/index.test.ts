import { describe, expect, it } from "vitest";
import { parseLaunchArgs, parseTarget } from "../index.js";

describe("CLI argument validation", () => {
  it("defaults install and doctor targets to Claude", () => {
    expect(parseTarget([])).toEqual(["claude"]);
  });

  it("parses Codex and all targets", () => {
    expect(parseTarget(["--target", "codex"])).toEqual(["codex"]);
    expect(parseTarget(["--target", "all"])).toEqual(["claude", "codex"]);
  });

  it("parses Codex launch passthrough arguments", () => {
    expect(parseLaunchArgs(["codex", "--", "--help"])).toEqual({
      host: "codex",
      passthrough: ["--help"],
    });
  });

  it("parses Claude launch passthrough arguments", () => {
    expect(parseLaunchArgs(["claude", "--", "--help"])).toEqual({
      host: "claude",
      passthrough: ["--help"],
    });
  });
});
