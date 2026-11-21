import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const pairs = [
  ["apps/web/src", "apps/web/dist/index.html"],
  ["apps/api/src", "apps/api/dist/index.js"],
  ["apps/realtime/src", "apps/realtime/dist/index.js"],
];

function newest(directory) {
  let latest = 0;
  const visit = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) {
        visit(path);
      } else {
        latest = Math.max(latest, statSync(path).mtimeMs);
      }
    }
  };
  visit(directory);
  return latest;
}

const stale = [];
for (const [source, output] of pairs) {
  let built = 0;
  try {
    built = statSync(output).mtimeMs;
  } catch {
    stale.push(`${output} is missing`);
    continue;
  }
  if (newest(source) > built) {
    stale.push(`${source} is newer than ${output}`);
  }
}

if (stale.length > 0) {
  console.error("E2E runs against built apps. Run `pnpm build` first:");
  for (const line of stale) console.error(`- ${line}`);
  process.exit(1);
}
console.log("e2e build is fresh");
