// @vitest-environment node
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { modeRoles, styleIds, styleRoles, themeIds } from "./tokens.js";

type Tokens = Record<string, string>;

function parse(file: string) {
  const css = readFileSync(new URL(file, import.meta.url), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
  const blocks = new Map<string, Tokens>();
  for (const match of css.matchAll(/html\[data-style="(\w+)"\](?:\[data-theme="(dark|light)"\])?\s*\{([^}]*)\}/g)) {
    const tokens: Tokens = {};
    for (const declaration of (match[3] ?? "").split(";")) {
      const index = declaration.indexOf(":");
      if (index > 0) tokens[declaration.slice(0, index).trim().replace(/^--ds-/, "")] = declaration.slice(index + 1).trim();
    }
    blocks.set(`${match[1]}${match[2] ? `-${match[2]}` : ""}`, tokens);
  }
  return blocks;
}

const blocks = new Map<string, Tokens>();
for (const file of ["./cinema.css", "./gruvbox.css", "./telerave.css"]) for (const [key, value] of parse(file)) blocks.set(key, value);
const base = readFileSync(new URL("./base.css", import.meta.url), "utf8");

const luminance = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((index) => {
    const channel = Number.parseInt(hex.slice(index, index + 2), 16) / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a: string, b: string) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
};
const hex = (tokens: Tokens, role: string) => {
  const value = tokens[role];
  if (!value || !/^#[0-9a-f]{6}$/i.test(value)) throw new Error(`${role} must be a #rrggbb value, got ${value}`);
  return value;
};

describe("design tokens", () => {
  it.each(styleIds)("%s defines every style role", (style) => {
    const own = blocks.get(style) ?? {};
    for (const role of styleRoles) expect(own[role], `${style}: --ds-${role}`).toBeTruthy();
  });

  const combos = styleIds.flatMap((style) => themeIds.map((theme) => [style, theme] as const));

  it.each(combos)("%s/%s defines every mode role", (style, theme) => {
    const own = blocks.get(`${style}-${theme}`) ?? {};
    for (const role of modeRoles) expect(own[role], `${style}-${theme}: --ds-${role}`).toBeTruthy();
  });

  it.each(combos)("%s/%s text, accent and status colours pass WCAG AA on every surface", (style, theme) => {
    const t = blocks.get(`${style}-${theme}`) ?? {};
    const surfaces = ["bg", "surface-1", "surface-2", "surface-3"].map((role) => [role, hex(t, role)] as const);
    const readable = ["text-primary", "text-secondary", "text-tertiary", "accent-text", "success", "warn", "danger", "info"];
    for (const role of readable) {
      for (const [name, surface] of surfaces) {
        expect(contrast(hex(t, role), surface), `${style}-${theme}: ${role} on ${name}`).toBeGreaterThanOrEqual(4.5);
      }
    }
    for (const fill of ["accent", "accent-hover"]) {
      expect(contrast(hex(t, "text-on-accent"), hex(t, fill)), `${style}-${theme}: text-on-accent on ${fill}`).toBeGreaterThanOrEqual(4.5);
    }
    expect(contrast(hex(t, "focus"), hex(t, "bg")), `${style}-${theme}: focus on bg`).toBeGreaterThanOrEqual(3);
    expect(contrast(hex(t, "focus"), hex(t, "surface-1")), `${style}-${theme}: focus on surface-1`).toBeGreaterThanOrEqual(3);
  });

  it("keeps person fills legible with their ink in the shared and Gruvbox palettes", () => {
    const sources = [base, readFileSync(new URL("./gruvbox.css", import.meta.url), "utf8")];
    sources.forEach((css, index) => {
      for (let n = 1; n <= 8; n += 1) {
        const fill = css.match(new RegExp(`--ds-person-${n}:\\s*(#[0-9a-f]{6})`, "i"))?.[1];
        const ink = css.match(new RegExp(`--ds-person-${n}-ink:\\s*(#[0-9a-f]{6})`, "i"))?.[1];
        expect(fill && ink, `palette ${index} person-${n}`).toBeTruthy();
        expect(contrast(fill!, ink!), `palette ${index} person-${n}`).toBeGreaterThanOrEqual(4.5);
      }
    });
  });
});
