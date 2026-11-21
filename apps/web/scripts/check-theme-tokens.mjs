import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const themeFiles = ["cinema.css", "gruvbox.css", "telerave.css"];
const geometry = new RegExp(
  String.raw`(?:^|[;{])\s*(?:display|position|padding(?:-[\w-]+)?|margin(?:-[\w-]+)?|height|min-height|max-height|width|min-width|max-width|gap|row-gap|column-gap|flex(?:-[\w-]+)?|grid(?:-[\w-]+)?|top|right|bottom|left|inset(?:-[\w-]+)?|font-size|line-height|border-radius|overflow(?:-[xy])?|z-index|transform|aspect-ratio|object-fit|align-items|justify-content|place-items|text-align|white-space|vertical-align)\s*:`,
  "i",
);

let failed = false;
for (const file of themeFiles) {
  const path = resolve("src/design", file);
  const css = readFileSync(path, "utf8");
  const match = geometry.exec(css);
  if (match) {
    const property = match[0].replace(/^[;{]/, "").trim();
    const line = css.slice(0, match.index + match[0].indexOf(property)).split("\n").length;
    console.error(`${file}:${line}: geometry belongs in layout/surface CSS, found "${property}"`);
    failed = true;
  }
}

if (failed) {
  process.exit(1);
}
console.log("theme files contain tokens and colours only");
