import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../store/index.js", () => ({
  getConfigOverrides: vi.fn(),
  getCustomPatterns: vi.fn(),
}));

import { getConfigOverrides, getCustomPatterns } from "../../store/index.js";
import { buildRuntimeRules, getDefaultRuntimeRules, getRuntimeRules } from "../index.js";

const mockedGetConfigOverrides = vi.mocked(getConfigOverrides);
const mockedGetCustomPatterns = vi.mocked(getCustomPatterns);

describe("runtime rule resolution", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("applies overrides and custom patterns across scanner categories", () => {
    const rules = buildRuntimeRules(
      [
        { rule_id: "aws-access-key", enabled: false },
        { rule_id: "git-reset-hard", enabled: true, severity: "critical" },
        { rule_id: "custom-secret", enabled: true, severity: "medium" },
      ],
      [
        {
          id: "custom-secret",
          category: "secret",
          description: "Internal token",
          regex: "INTERNAL_[A-Z0-9]{12}",
          severity: "high",
          enabled: true,
        },
        {
          id: "custom-sensitive-file",
          category: "sensitive-file",
          description: "Internal credential file",
          regex: "\\.corp-secrets$",
          severity: "high",
          enabled: true,
        },
        {
          id: "custom-dangerous-command",
          category: "dangerous-command",
          description: "Terraform destroy",
          regex: "terraform\\s+destroy",
          severity: "high",
          enabled: true,
        },
      ]
    );

    expect(rules.secretRules.some((rule) => rule.id === "aws-access-key")).toBe(false);
    expect(rules.commandRules.find((rule) => rule.id === "git-reset-hard")?.severity).toBe("critical");
    expect(rules.secretRules.find((rule) => rule.id === "custom-secret")?.severity).toBe("medium");
    expect(rules.fileRules.some((rule) => rule.id === "custom-sensitive-file")).toBe(true);
    expect(rules.commandRules.some((rule) => rule.id === "custom-dangerous-command")).toBe(true);
  });

  it("falls back to default rules when store access fails", () => {
    mockedGetConfigOverrides.mockImplementation(() => {
      throw new Error("db unavailable");
    });

    const runtimeRules = getRuntimeRules();
    const defaults = getDefaultRuntimeRules();

    expect(runtimeRules.secretRules).toBe(defaults.secretRules);
    expect(runtimeRules.fileRules).toBe(defaults.fileRules);
    expect(runtimeRules.commandRules).toBe(defaults.commandRules);
  });

  it("ignores invalid custom patterns from store and keeps valid entries", () => {
    mockedGetConfigOverrides.mockReturnValue([]);
    mockedGetCustomPatterns.mockReturnValue([
      {
        id: "invalid-regex",
        category: "secret",
        description: "Broken pattern",
        regex: "(unclosed",
        severity: "high",
        enabled: true,
      },
      {
        id: "invalid-severity",
        category: "secret",
        description: "Invalid severity",
        regex: "INTERNAL_[A-Z0-9]{6}",
        severity: "urgent",
        enabled: true,
      },
      {
        id: "valid-custom-rule",
        category: "secret",
        description: "Valid custom pattern",
        regex: "INTERNAL_[A-Z0-9]{6}",
        severity: "high",
        enabled: true,
      },
    ]);

    const runtimeRules = getRuntimeRules();

    expect(runtimeRules.secretRules.some((rule) => rule.id === "invalid-regex")).toBe(false);
    expect(runtimeRules.secretRules.some((rule) => rule.id === "invalid-severity")).toBe(false);
    expect(runtimeRules.secretRules.some((rule) => rule.id === "valid-custom-rule")).toBe(true);
  });
});
