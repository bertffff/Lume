import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

type Tokens = Record<string, string>;

function tokenBlocks(file: string): Record<string, Tokens> {
  const css = readFileSync(new URL(file, import.meta.url), "utf8");
  const blocks: Record<string, Tokens> = {};
  for (const match of css.matchAll(/html\[data-style="(\w+)"\]\[data-theme="(dark|light)"\]\{([^}]*)\}/g)) {
    const tokens: Tokens = {};
    for (const declaration of (match[3] ?? "").split(";")) {
      const index = declaration.indexOf(":");
      if (index < 0) continue;
      tokens[declaration.slice(0, index).trim()] = declaration.slice(index + 1).trim();
    }
    blocks[`${match[1]}-${match[2]}`] = tokens;
  }
  return blocks;
}

function resolveToken(tokens: Tokens, value: string | undefined, depth = 0): string | null {
  if (!value || depth > 10) return null;
  const trimmed = value.trim();
  const reference = trimmed.match(/^var\((--[\w-]+)(?:,([^)]+))?\)$/);
  if (reference) {
    return resolveToken(tokens, tokens[reference[1] ?? ""] ?? reference[2], depth + 1);
  }
  return /^#[0-9a-f]{3,8}$/i.test(trimmed) ? trimmed : null;
}

function luminance(hex: string): number {
  const value = hex.slice(1);
  const channels = [0, 2, 4].map((offset) => Number.parseInt(value.slice(offset, offset + 2), 16) / 255);
  const [red, green, blue] = channels.map((channel) =>
    channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4,
  ) as [number, number, number];
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

function contrast(foreground: string, background: string): number {
  const first = luminance(foreground);
  const second = luminance(background);
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
}

const commonPairs: Array<[string, string]> = [
  ["text", "bg"],
  ["text", "s1"],
  ["text", "s2"],
  ["text-2", "bg"],
  ["text-2", "s1"],
  ["text-2", "s2"],
  ["text-3", "bg"],
  ["text-3", "s1"],
  ["text-3", "s2"],
];

const stylePairs: Record<string, Array<[string, string]>> = {
  cinema: [
    ["accent-text", "bg"],
    ["social-text", "bg"],
    ["ok-text", "s1"],
    ["live-text", "s1"],
    ["danger", "s1"],
    ["accent-ink", "accent"],
    ["social-ink", "social"],
  ],
  gruvbox: [
    ["orange", "bg"],
    ["green", "bg"],
    ["red", "bg"],
    ["p-lisa-ink", "p-lisa-fill"],
  ],
};

const blocks = {
  ...tokenBlocks("./cinema.css"),
  ...tokenBlocks("./gruvbox.css"),
};

describe("theme contrast (WCAG AA)", () => {
  for (const [name, tokens] of Object.entries(blocks)) {
    const style = name.split("-")[0] ?? "";
    it(`${name} keeps text and icon tokens at 4.5:1`, () => {
      const failures: string[] = [];
      for (const [foreground, background] of [...commonPairs, ...(stylePairs[style] ?? [])]) {
        const fg = resolveToken(tokens, tokens[`--${foreground}`]);
        const bg = resolveToken(tokens, tokens[`--${background}`]);
        if (!fg || !bg) {
          failures.push(`${foreground}/${background}: token missing`);
          continue;
        }
        const ratio = contrast(fg, bg);
        if (ratio < 4.5) {
          failures.push(`${foreground}/${background}: ${ratio.toFixed(2)}`);
        }
      }
      expect(failures).toEqual([]);
    });
  }
});
