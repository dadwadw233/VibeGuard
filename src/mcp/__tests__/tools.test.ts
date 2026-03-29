import { describe, expect, it } from "vitest";
import {
  renderScanCommandResult,
  renderScanFileResult,
  renderScanTextResult,
} from "../tools.js";

describe("MCP tool renderers", () => {
  it("renders detected secrets with redaction", () => {
    const output = renderScanTextResult("OPENAI_API_KEY=sk-proj-" + "a".repeat(48));
    expect(output).toContain("Found 1 issue");
    expect(output).toContain("OpenAI API Key");
    expect(output).toContain("***");
  });

  it("renders sensitive file findings", () => {
    const output = renderScanFileResult("/home/user/.ssh/id_rsa");
    expect(output).toContain("Sensitive file detected");
    expect(output).toContain("SSH private key file");
  });

  it("renders dangerous command findings", () => {
    const output = renderScanCommandResult("git reset --hard HEAD~1");
    expect(output).toContain("Dangerous command detected");
    expect(output).toContain("Hard reset git history");
  });

  it("renders safe results cleanly", () => {
    expect(renderScanTextResult("const ok = true;")).toBe("No secrets detected.");
    expect(renderScanFileResult("/tmp/project/src/index.ts")).toBe("File path appears safe.");
    expect(renderScanCommandResult("npm install express")).toBe("Command appears safe.");
  });
});
