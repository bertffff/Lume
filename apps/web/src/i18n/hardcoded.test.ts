import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const allowed = new Set([
  "src/i18n/ru.ts",
  "src/i18n/en.ts",
  "src/design/copy.ts",
  "src/design/shot-fixtures.ts",
]);
const cyrillic = /[\u0400-\u04FF]/;

function walk(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return walk(path);
    return entry.isFile() && /\.(ts|tsx)$/.test(entry.name) && !entry.name.endsWith(".test.ts") && !entry.name.endsWith(".test.tsx")
      ? [path]
      : [];
  });
}

describe("i18n coverage", () => {
  it("keeps every user-facing string in the dictionaries", () => {
    const offenders: string[] = [];
    for (const file of walk("src")) {
      const relative = file.replaceAll("\\", "/");
      if (allowed.has(relative)) continue;
      const lines = readFileSync(file, "utf8").split("\n");
      lines.forEach((line, index) => {
        const code = line.replace(/\/\/.*$/, "").replace(/\/\*.*?\*\//g, "");
        if (cyrillic.test(code)) {
          offenders.push(`${relative}:${index + 1}: ${line.trim().slice(0, 120)}`);
        }
      });
    }
    expect(offenders).toEqual([]);
  });
});
