import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

/**
 * Guard for the design system and everything migrated onto it:
 * no !important, no inline style, no raw colours outside tokens, no raw px in spacing.
 */
const roots = ["src"];
const migratedModules = [];
const tokenDir = join("src", "ds", "tokens");
const spacing = /(?:^|[;{\s])(?:padding|margin|gap|row-gap|column-gap|inset|top|right|bottom|left)(?:-[a-z]+)?\s*:\s*[^;}]*\b[1-9]\d*px/;

function* walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(path);
    else if (/\.(css|tsx)$/.test(entry.name) && !/\.test\.tsx$/.test(entry.name)) yield path;
  }
}

function* walkModules(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) yield* walkModules(path);
    else if (entry.name.endsWith(".module.css")) yield path;
  }
}

const problems = [];
const files = [...roots.flatMap((root) => [...walk(root)]), ...migratedModules.flatMap((root) => [...walkModules(root)])];
{
  for (const file of files) {
    const source = readFileSync(file, "utf8");
    source.split("\n").forEach((line, index) => {
      const at = `${relative(".", file)}:${index + 1}`;
      if (file.endsWith(".css")) {
        const code = line.replace(/\/\*.*?\*\//g, "");
        if (/!important/.test(code)) problems.push(`${at}: !important is forbidden`);
        if (!file.startsWith(tokenDir) && /#[0-9a-f]{3,8}\b|\b(?:rgb|rgba|hsl|hsla)\(/i.test(code)) problems.push(`${at}: raw colour, use a --ds-* token`);
        if (spacing.test(code)) problems.push(`${at}: raw px in spacing, use --ds-space-*`);
      } else if (/\bstyle=\{\{/.test(line)) {
        problems.push(`${at}: inline style is forbidden`);
      }
    });
  }
}

if (problems.length > 0) {
  console.error(problems.join("\n"));
  process.exit(1);
}
console.log("design system files use tokens only");
