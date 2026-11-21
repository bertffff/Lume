import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const themeFiles = ["cinema.css", "gruvbox.css"];
const geometry = new RegExp(
  String.raw`(?:^|;)\s*(?:display|position|padding|margin|height|min-height|max-height|width|min-width|max-width|gap|row-gap|column-gap|flex|flex-[a-z]+|grid|grid-[a-z]+|top|right|bottom|left|inset|font-size|line-height|border-radius|overflow|z-index|transform|aspect-ratio|object-fit|align-items|justify-content|place-items|text-align|white-space|vertical-align)\s*:`,
  "i",
);

let failed = false;
for (const file of themeFiles) {
  const path = resolve("src/design", file);
  const css = readFileSync(path, "utf8");
  const match = geometry.exec(css);
  if (match) {
    const line = css.slice(0, match.index).split("\n").length;
    console.error(`${file}:${line}: geometry belongs in surfaces.css, found "${match[0].trim()}"`);
    failed = true;
  }
}

if (failed) {
  process.exit(1);
}
console.log("theme files contain tokens and colours only");
