import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

function applyEnvFile(filePath: string): void {
  const text = readFileSync(filePath, "utf8");
  for (const rawLine of text.split("\n")) {
    const line = rawLine.trim();
    if (line.length === 0 || line.startsWith("#")) {
      continue;
    }
    const eq = line.indexOf("=");
    if (eq <= 0) {
      continue;
    }
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

export function loadRepoEnv(): void {
  let dir = process.cwd();
  for (let hop = 0; hop < 5; hop += 1) {
    if (existsSync(resolve(dir, "pnpm-workspace.yaml"))) {
      const envPath = resolve(dir, ".env");
      if (existsSync(envPath)) {
        applyEnvFile(envPath);
      }
      return;
    }
    const parent = resolve(dir, "..");
    if (parent === dir) {
      return;
    }
    dir = parent;
  }
}
