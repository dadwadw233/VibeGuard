import type { FileRule } from "./types.js";

export const SENSITIVE_FILE_RULES: FileRule[] = [
  // === Environment Files ===
  {
    id: "env-file",
    description: "Environment configuration file (.env)",
    pattern: /(?:^|[/\\])\.env(?:\.[a-zA-Z]+)?$/,
    severity: "high",
  },

  // === SSH Keys ===
  {
    id: "ssh-private-key",
    description: "SSH private key file",
    pattern: /(?:^|[/\\])(?:id_rsa|id_dsa|id_ed25519|id_ecdsa)$/,
    severity: "critical",
  },
  {
    id: "ssh-directory",
    description: "SSH directory access",
    pattern: /(?:^|[/\\])\.ssh[/\\]/,
    severity: "high",
  },

  // === Cloud Credentials ===
  {
    id: "aws-credentials",
    description: "AWS credentials file",
    pattern: /(?:^|[/\\])\.aws[/\\]credentials$/,
    severity: "critical",
  },
  {
    id: "aws-config",
    description: "AWS config file",
    pattern: /(?:^|[/\\])\.aws[/\\]config$/,
    severity: "medium",
  },
  {
    id: "gcloud-credentials",
    description: "Google Cloud credentials",
    pattern: /(?:^|[/\\])\.config[/\\]gcloud[/\\]/,
    severity: "high",
  },
  {
    id: "azure-profile",
    description: "Azure profile",
    pattern: /(?:^|[/\\])\.azure[/\\]/,
    severity: "high",
  },

  // === Certificate & Key Files ===
  {
    id: "pem-file",
    description: "PEM certificate/key file",
    pattern: /\.pem$/i,
    severity: "high",
  },
  {
    id: "key-file",
    description: "Key file",
    pattern: /\.key$/i,
    severity: "high",
  },
  {
    id: "p12-file",
    description: "PKCS#12 file",
    pattern: /\.(?:p12|pfx)$/i,
    severity: "high",
  },
  {
    id: "keystore-file",
    description: "Java keystore file",
    pattern: /\.(?:jks|keystore)$/i,
    severity: "high",
  },

  // === Docker ===
  {
    id: "docker-config",
    description: "Docker config with auth",
    pattern: /(?:^|[/\\])\.docker[/\\]config\.json$/,
    severity: "high",
  },

  // === Kubernetes ===
  {
    id: "kube-config",
    description: "Kubernetes config",
    pattern: /(?:^|[/\\])\.kube[/\\]config$/,
    severity: "high",
  },

  // === Package Manager Auth ===
  {
    id: "npmrc-file",
    description: "NPM configuration (may contain tokens)",
    pattern: /(?:^|[/\\])\.npmrc$/,
    severity: "medium",
  },
  {
    id: "pypirc-file",
    description: "PyPI configuration (may contain tokens)",
    pattern: /(?:^|[/\\])\.pypirc$/,
    severity: "medium",
  },

  // === Database Files ===
  {
    id: "sqlite-file",
    description: "SQLite database file",
    pattern: /\.(?:sqlite|sqlite3|db)$/i,
    severity: "low",
  },

  // === Generic Sensitive Names ===
  {
    id: "credentials-file",
    description: "File with 'credential' in name",
    pattern: /(?:^|[/\\])[^/\\]*credential[^/\\]*$/i,
    severity: "high",
  },
  {
    id: "secrets-file",
    description: "File with 'secret' in name",
    pattern: /(?:^|[/\\])[^/\\]*secret[^/\\]*$/i,
    severity: "high",
    allowlist: undefined,
  },
  {
    id: "password-file",
    description: "File with 'password' in name",
    pattern: /(?:^|[/\\])[^/\\]*password[^/\\]*$/i,
    severity: "high",
  },

  // === History & Shell Config ===
  {
    id: "shell-history",
    description: "Shell history file",
    pattern: /(?:^|[/\\])\.(?:bash_history|zsh_history|history)$/,
    severity: "medium",
  },
  {
    id: "netrc-file",
    description: "Netrc file with credentials",
    pattern: /(?:^|[/\\])\.netrc$/,
    severity: "high",
  },

  // === GPG Keys ===
  {
    id: "gnupg-directory",
    description: "GnuPG directory",
    pattern: /(?:^|[/\\])\.gnupg[/\\]/,
    severity: "high",
  },
];
