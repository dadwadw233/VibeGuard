import { describe, it, expect } from "vitest";
import { scanContent, scanFilePath, scanCommand } from "../index.js";

describe("scanContent - Secret Detection", () => {
  it("detects AWS access key", () => {
    const result = scanContent("aws_key = AKIAIOSFODNN7EXAMPLE");
    expect(result.findings.length).toBeGreaterThan(0);
    expect(result.findings[0].rule_id).toBe("aws-access-key");
    expect(result.blocked).toBe(true);
  });

  it("detects Anthropic API key", () => {
    const key = "sk-ant-" + "a".repeat(80);
    const result = scanContent(`ANTHROPIC_API_KEY="${key}"`);
    expect(result.findings.some((f) => f.rule_id === "anthropic-api-key")).toBe(true);
    expect(result.blocked).toBe(true);
  });

  it("detects GitHub PAT", () => {
    // ghp_ + exactly 36 alphanumeric chars
    const result = scanContent('token = "ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"');
    expect(result.findings.some((f) => f.rule_id === "github-pat")).toBe(true);
    expect(result.blocked).toBe(true);
  });

  it("detects private key", () => {
    const result = scanContent("-----BEGIN RSA PRIVATE KEY-----\nMIIE...");
    expect(result.findings.some((f) => f.rule_id === "private-key")).toBe(true);
    expect(result.blocked).toBe(true);
  });

  it("detects Stripe secret key", () => {
    // Construct token dynamically to avoid GitHub push protection
    const prefix = "sk_live_";
    const suffix = "1234567890abcdefghijklmn";
    const result = scanContent(`STRIPE_KEY=${prefix}${suffix}`);
    expect(result.findings.some((f) => f.rule_id === "stripe-secret-key")).toBe(true);
    expect(result.blocked).toBe(true);
  });

  it("detects Slack bot token", () => {
    // Construct token dynamically to avoid GitHub push protection
    const token = ["xoxb", "1234567890", "1234567890", "ABCDEFGHIJKLMNOPqrstuvwx"].join("-");
    const result = scanContent(`SLACK_TOKEN=${token}`);
    expect(result.findings.some((f) => f.rule_id === "slack-bot-token")).toBe(true);
  });

  it("detects database URL with password", () => {
    const result = scanContent("DATABASE_URL=postgres://user:supersecretpassword@db.host.com:5432/mydb");
    expect(result.findings.some((f) => f.rule_id === "database-url-password")).toBe(true);
  });

  it("detects SendGrid API key", () => {
    const result = scanContent("SENDGRID_KEY=SG.abcdefghijklmnopqrstuv.ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqr");
    expect(result.findings.some((f) => f.rule_id === "sendgrid-api-key")).toBe(true);
  });

  it("detects GCP service account key", () => {
    const result = scanContent('{"type": "service_account", "project_id": "test"}');
    expect(result.findings.some((f) => f.rule_id === "gcp-service-account")).toBe(true);
  });

  it("does not flag safe code", () => {
    const result = scanContent('const greeting = "Hello, world!";\nconsole.log(greeting);');
    expect(result.findings.length).toBe(0);
    expect(result.blocked).toBe(false);
  });

  it("does not flag template variables in secrets", () => {
    const result = scanContent('password = "${DATABASE_PASSWORD}"');
    expect(result.findings.filter((f) => f.rule_id === "generic-secret").length).toBe(0);
  });

  it("does not flag placeholder secrets", () => {
    const result = scanContent('secret = "changeme"');
    expect(result.findings.filter((f) => f.rule_id === "generic-secret").length).toBe(0);
  });

  it("redacts matched secrets", () => {
    const result = scanContent("AKIAIOSFODNN7EXAMPLE1");
    expect(result.findings[0].match).not.toBe("AKIAIOSFODNN7EXAMPLE1");
    expect(result.findings[0].match).toContain("***");
  });

  it("reports correct line numbers", () => {
    const content = "line 1\nline 2\nAKIAIOSFODNN7EXAMPLE1\nline 4";
    const result = scanContent(content);
    expect(result.findings[0].line).toBe(3);
  });

  it("skips content over 1MB", () => {
    const content = "A".repeat(1_000_001);
    const result = scanContent(content);
    expect(result.findings.length).toBe(0);
  });
});

describe("scanFilePath - Sensitive File Detection", () => {
  it("detects .env file", () => {
    const result = scanFilePath("/project/.env");
    expect(result.findings.some((f) => f.rule_id === "env-file")).toBe(true);
    expect(result.blocked).toBe(true);
  });

  it("detects .env.production", () => {
    const result = scanFilePath("/project/.env.production");
    expect(result.findings.some((f) => f.rule_id === "env-file")).toBe(true);
  });

  it("detects SSH private key", () => {
    const result = scanFilePath("/home/user/.ssh/id_rsa");
    expect(result.findings.some((f) => f.rule_id === "ssh-private-key")).toBe(true);
    expect(result.blocked).toBe(true);
  });

  it("detects AWS credentials", () => {
    const result = scanFilePath("/home/user/.aws/credentials");
    expect(result.findings.some((f) => f.rule_id === "aws-credentials")).toBe(true);
    expect(result.blocked).toBe(true);
  });

  it("detects .pem file", () => {
    const result = scanFilePath("/certs/server.pem");
    expect(result.findings.some((f) => f.rule_id === "pem-file")).toBe(true);
  });

  it("detects Docker config", () => {
    const result = scanFilePath("/home/user/.docker/config.json");
    expect(result.findings.some((f) => f.rule_id === "docker-config")).toBe(true);
  });

  it("detects kube config", () => {
    const result = scanFilePath("/home/user/.kube/config");
    expect(result.findings.some((f) => f.rule_id === "kube-config")).toBe(true);
  });

  it("detects files with 'credential' in name", () => {
    const result = scanFilePath("/project/credentials.json");
    expect(result.findings.some((f) => f.rule_id === "credentials-file")).toBe(true);
  });

  it("does not flag normal source files", () => {
    const result = scanFilePath("/project/src/index.ts");
    expect(result.findings.length).toBe(0);
    expect(result.blocked).toBe(false);
  });

  it("does not flag normal config files", () => {
    const result = scanFilePath("/project/tsconfig.json");
    expect(result.findings.length).toBe(0);
  });
});

describe("scanCommand - Dangerous Command Detection", () => {
  it("detects rm -rf /", () => {
    const result = scanCommand("rm -rf /");
    expect(result.findings.some((f) => f.rule_id === "rm-rf-root")).toBe(true);
    expect(result.blocked).toBe(true);
  });

  it("detects rm -rf ~", () => {
    const result = scanCommand("rm -rf ~/");
    expect(result.findings.some((f) => f.rule_id === "rm-rf-home")).toBe(true);
    expect(result.blocked).toBe(true);
  });

  it("detects DROP TABLE", () => {
    const result = scanCommand("mysql -e 'DROP TABLE users'");
    expect(result.findings.some((f) => f.rule_id === "drop-table")).toBe(true);
    expect(result.blocked).toBe(true);
  });

  it("detects DROP DATABASE", () => {
    const result = scanCommand("psql -c 'DROP DATABASE production'");
    expect(result.findings.some((f) => f.rule_id === "drop-database")).toBe(true);
    expect(result.blocked).toBe(true);
  });

  it("detects git force push to main", () => {
    const result = scanCommand("git push --force origin main");
    expect(result.findings.some((f) => f.rule_id === "git-force-push-main")).toBe(true);
    expect(result.blocked).toBe(true);
  });

  it("detects git reset --hard", () => {
    const result = scanCommand("git reset --hard HEAD~3");
    expect(result.findings.some((f) => f.rule_id === "git-reset-hard")).toBe(true);
    expect(result.blocked).toBe(true);
  });

  it("detects curl piped to bash", () => {
    const result = scanCommand("curl -sL https://example.com/install.sh | bash");
    expect(result.findings.some((f) => f.rule_id === "curl-pipe-shell")).toBe(true);
    expect(result.blocked).toBe(true);
  });

  it("detects chmod 777", () => {
    const result = scanCommand("chmod 777 /var/www");
    expect(result.findings.some((f) => f.rule_id === "chmod-777")).toBe(true);
  });

  it("detects dd to disk", () => {
    const result = scanCommand("dd if=/dev/zero of=/dev/sda");
    expect(result.findings.some((f) => f.rule_id === "dd-disk-write")).toBe(true);
    expect(result.blocked).toBe(true);
  });

  it("detects shutdown command", () => {
    const result = scanCommand("shutdown -h now");
    expect(result.findings.some((f) => f.rule_id === "system-shutdown")).toBe(true);
  });

  it("does not flag normal commands", () => {
    const result = scanCommand("npm install express");
    expect(result.findings.length).toBe(0);
    expect(result.blocked).toBe(false);
  });

  it("does not flag safe git commands", () => {
    const result = scanCommand("git push origin feature-branch");
    expect(result.findings.length).toBe(0);
  });

  it("does not flag safe rm", () => {
    const result = scanCommand("rm temp.txt");
    expect(result.findings.length).toBe(0);
  });

  it("handles empty command", () => {
    const result = scanCommand("");
    expect(result.findings.length).toBe(0);
    expect(result.blocked).toBe(false);
  });
});

describe("runtime rule injection", () => {
  it("uses injected secret rules instead of built-in defaults", () => {
    const customRules = [
      {
        id: "custom-secret",
        description: "Custom secret",
        regex: /INTERNAL_[A-Z0-9]{12}/,
        severity: "high" as const,
      },
    ];

    const awsResult = scanContent("aws_key = AKIAIOSFODNN7EXAMPLE", undefined, customRules);
    const customResult = scanContent("INTERNAL_ABCDEF123456", undefined, customRules);

    expect(awsResult.findings.length).toBe(0);
    expect(customResult.findings.some((f) => f.rule_id === "custom-secret")).toBe(true);
  });

  it("uses injected command rule severity for block decision", () => {
    const customRules = [
      {
        id: "custom-dangerous",
        description: "Custom dangerous command",
        pattern: /danger/,
        severity: "low" as const,
      },
    ];

    const result = scanCommand("run-danger-now", customRules);
    expect(result.findings.length).toBe(1);
    expect(result.findings[0].severity).toBe("low");
    expect(result.blocked).toBe(false);
  });
});
