import { accessSync, constants, existsSync } from "fs";
import { delimiter, join } from "path";
import { spawn, spawnSync } from "child_process";

export interface CommandStatus {
  ok: boolean;
  details: string;
}

export interface CommandResult {
  ok: boolean;
  status: number | null;
  stdout: string;
  stderr: string;
}

export interface LaunchOptions {
  stdin?: string;
}

export function shellQuote(value: string): string {
  return `"${value.replace(/(["\\$`])/g, "\\$1")}"`;
}

export function findExecutable(command: string): string | null {
  const pathValue = process.env.PATH ?? "";

  for (const dir of pathValue.split(delimiter)) {
    if (!dir) continue;

    const fullPath = join(dir, command);
    if (!existsSync(fullPath)) continue;

    try {
      accessSync(fullPath, constants.X_OK);
      return fullPath;
    } catch {
      // Keep searching.
    }
  }

  return null;
}

export function runCommand(command: string, args: string[]): CommandResult {
  const result = spawnSync(command, args, {
    encoding: "utf-8",
    stdio: ["ignore", "pipe", "pipe"],
  });

  return {
    ok: result.status === 0 && !result.error,
    status: result.status,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? result.error?.message ?? "",
  };
}

export async function launchCommand(command: string, args: string[], options: LaunchOptions = {}): Promise<number> {
  const child = spawn(command, args, {
    stdio: [options.stdin !== undefined ? "pipe" : "inherit", "inherit", "inherit"],
  });

  if (options.stdin !== undefined) {
    child.stdin?.write(options.stdin);
    child.stdin?.end();
  }

  return await new Promise<number>((resolve, reject) => {
    child.on("error", reject);
    child.on("exit", (code, signal) => {
      if (signal) {
        resolve(1);
        return;
      }

      resolve(code ?? 0);
    });
  });
}

export function pluralize(count: number, singular: string, plural: string): string {
  return count === 1 ? singular : plural;
}
