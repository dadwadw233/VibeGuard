import type { SecretRule } from "./types.js";

export const SECRET_RULES: SecretRule[] = [
  // === Cloud Provider Keys ===
  {
    id: "aws-access-key",
    description: "AWS Access Key ID",
    regex: /(A3T[A-Z0-9]|AKIA|AGPA|AIDA|AROA|AIPA|ANPA|ANVA|ASIA)[A-Z0-9]{16}/,
    keywords: ["AKIA", "AGPA", "AIDA", "AROA", "AIPA", "ANPA", "ANVA", "ASIA", "A3T"],
    severity: "critical",
  },
  {
    id: "aws-secret-key",
    description: "AWS Secret Access Key",
    regex: /(?:aws_secret_access_key|aws_secret|secret_access_key)\s*[=:]\s*['"]?([A-Za-z0-9/+=]{40})['"]?/i,
    keywords: ["aws_secret", "secret_access_key"],
    severity: "critical",
  },

  // === AI Platform Keys ===
  {
    id: "anthropic-api-key",
    description: "Anthropic API Key",
    regex: /sk-ant-[a-zA-Z0-9_-]{80,}/,
    keywords: ["sk-ant-"],
    severity: "critical",
  },
  {
    id: "openai-api-key",
    description: "OpenAI API Key",
    regex: /sk-[a-zA-Z0-9]{20}T3BlbkFJ[a-zA-Z0-9]{20}/,
    keywords: ["sk-", "T3BlbkFJ"],
    severity: "critical",
  },
  {
    id: "openai-api-key-new",
    description: "OpenAI API Key (new format)",
    regex: /sk-(?:proj-)?[a-zA-Z0-9_-]{40,}/,
    keywords: ["sk-proj-", "sk-"],
    severity: "high",
    allowlist: {
      regexes: [/sk-ant-/], // Don't double-match Anthropic keys
    },
  },

  // === Version Control ===
  {
    id: "github-pat",
    description: "GitHub Personal Access Token",
    regex: /ghp_[0-9a-zA-Z]{36}/,
    keywords: ["ghp_"],
    severity: "critical",
  },
  {
    id: "github-oauth",
    description: "GitHub OAuth Access Token",
    regex: /gho_[0-9a-zA-Z]{36}/,
    keywords: ["gho_"],
    severity: "critical",
  },
  {
    id: "github-app-token",
    description: "GitHub App Token",
    regex: /(?:ghs|ghu)_[0-9a-zA-Z]{36}/,
    keywords: ["ghs_", "ghu_"],
    severity: "critical",
  },
  {
    id: "github-fine-grained-pat",
    description: "GitHub Fine-Grained Personal Access Token",
    regex: /github_pat_[0-9a-zA-Z_]{82}/,
    keywords: ["github_pat_"],
    severity: "critical",
  },
  {
    id: "gitlab-pat",
    description: "GitLab Personal Access Token",
    regex: /glpat-[0-9a-zA-Z_-]{20}/,
    keywords: ["glpat-"],
    severity: "critical",
  },

  // === Payment ===
  {
    id: "stripe-secret-key",
    description: "Stripe Secret Key",
    regex: /sk_live_[0-9a-zA-Z]{24,}/,
    keywords: ["sk_live_"],
    severity: "critical",
  },
  {
    id: "stripe-restricted-key",
    description: "Stripe Restricted Key",
    regex: /rk_live_[0-9a-zA-Z]{24,}/,
    keywords: ["rk_live_"],
    severity: "critical",
  },

  // === Communication ===
  {
    id: "slack-bot-token",
    description: "Slack Bot Token",
    regex: /xoxb-[0-9]{10,13}-[0-9]{10,13}-[a-zA-Z0-9]{24}/,
    keywords: ["xoxb-"],
    severity: "critical",
  },
  {
    id: "slack-user-token",
    description: "Slack User Token",
    regex: /xoxp-[0-9]{10,13}-[0-9]{10,13}-[0-9]{10,13}-[a-z0-9]{32}/,
    keywords: ["xoxp-"],
    severity: "critical",
  },
  {
    id: "slack-webhook",
    description: "Slack Webhook URL",
    regex: /https:\/\/hooks\.slack\.com\/services\/T[a-zA-Z0-9_]{8,}\/B[a-zA-Z0-9_]{8,}\/[a-zA-Z0-9_]{24}/,
    keywords: ["hooks.slack.com/services"],
    severity: "high",
  },

  // === Google ===
  {
    id: "google-api-key",
    description: "Google API Key",
    regex: /AIza[0-9A-Za-z_-]{35}/,
    keywords: ["AIza"],
    severity: "high",
  },
  {
    id: "gcp-service-account",
    description: "GCP Service Account Key",
    regex: /"type"\s*:\s*"service_account"/,
    keywords: ["service_account"],
    severity: "critical",
  },

  // === Database ===
  {
    id: "database-url-password",
    description: "Database Connection String with Password",
    regex: /(?:mongodb|postgres|postgresql|mysql|redis|amqp):\/\/[^:]+:[^@\s]{8,}@[^\s'"]+/i,
    keywords: ["mongodb://", "postgres://", "postgresql://", "mysql://", "redis://", "amqp://"],
    severity: "high",
  },

  // === Private Keys ===
  {
    id: "private-key",
    description: "Private Key",
    regex: /-----BEGIN\s+(?:RSA\s+|EC\s+|DSA\s+|OPENSSH\s+)?PRIVATE\s+KEY-----/,
    keywords: ["PRIVATE KEY"],
    severity: "critical",
  },

  // === JWT ===
  {
    id: "jwt-token",
    description: "JSON Web Token",
    regex: /eyJ[a-zA-Z0-9_-]{10,}\.eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}/,
    keywords: ["eyJ"],
    severity: "medium",
  },

  // === Generic Secrets ===
  {
    id: "generic-api-key",
    description: "Generic API Key Assignment",
    regex: /(?:api[_-]?key|apikey|api[_-]?secret)\s*[=:]\s*['"]([a-zA-Z0-9_-]{20,})['"]$/im,
    keywords: ["api_key", "api-key", "apikey", "api_secret", "api-secret"],
    severity: "medium",
  },
  {
    id: "generic-secret",
    description: "Generic Secret Assignment",
    regex: /(?:secret|password|passwd|token|auth_token|access_token)\s*[=:]\s*['"]([^\s'"]{8,})['"]$/im,
    keywords: ["secret", "password", "passwd", "token", "auth_token", "access_token"],
    severity: "medium",
    allowlist: {
      regexes: [
        /\{\{/, // Template variables
        /\$\{/, // String interpolation
        /process\.env/, // Environment variable references
        /os\.environ/, // Python env
        /ENV\[/, // Ruby env
        /<[^>]+>/, // Placeholder like <your-secret>
        /(?:example|sample|test|dummy|fake|placeholder|changeme|todo|fixme|xxx)/i,
      ],
    },
  },
  {
    id: "generic-password-url",
    description: "Password in URL",
    regex: /[a-zA-Z]+:\/\/[^:]+:([^@\s]{8,})@/,
    keywords: ["://"],
    severity: "high",
    allowlist: {
      regexes: [/localhost/, /127\.0\.0\.1/, /example\.com/],
    },
  },

  // === Cloud / SaaS ===
  {
    id: "azure-subscription-key",
    description: "Azure Subscription Key",
    regex: /[a-f0-9]{32}/,
    keywords: ["Ocp-Apim-Subscription-Key", "azure"],
    severity: "medium",
  },
  {
    id: "sendgrid-api-key",
    description: "SendGrid API Key",
    regex: /SG\.[a-zA-Z0-9_-]{22}\.[a-zA-Z0-9_-]{43}/,
    keywords: ["SG."],
    severity: "critical",
  },
  {
    id: "twilio-api-key",
    description: "Twilio API Key",
    regex: /SK[a-f0-9]{32}/,
    keywords: ["SK", "twilio"],
    severity: "high",
  },
  {
    id: "mailgun-api-key",
    description: "Mailgun API Key",
    regex: /key-[0-9a-zA-Z]{32}/,
    keywords: ["key-", "mailgun"],
    severity: "high",
  },
  {
    id: "npm-token",
    description: "NPM Access Token",
    regex: /npm_[a-zA-Z0-9]{36}/,
    keywords: ["npm_"],
    severity: "critical",
  },
  {
    id: "pypi-token",
    description: "PyPI API Token",
    regex: /pypi-[a-zA-Z0-9_-]{50,}/,
    keywords: ["pypi-"],
    severity: "critical",
  },
  {
    id: "heroku-api-key",
    description: "Heroku API Key",
    regex: /[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/,
    keywords: ["heroku", "HEROKU_API_KEY"],
    severity: "medium",
  },
];
