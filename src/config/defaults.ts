import type { SecretRule, FileRule, CommandRule } from "../scanner/types.js";
import { SECRET_RULES } from "../scanner/secret-patterns.js";
import { SENSITIVE_FILE_RULES } from "../scanner/sensitive-files.js";
import { DANGEROUS_COMMAND_RULES } from "../scanner/dangerous-commands.js";

export function getDefaultSecretRules(): SecretRule[] {
  return SECRET_RULES;
}

export function getDefaultFileRules(): FileRule[] {
  return SENSITIVE_FILE_RULES;
}

export function getDefaultCommandRules(): CommandRule[] {
  return DANGEROUS_COMMAND_RULES;
}
