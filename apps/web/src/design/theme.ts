import { styleIds, themeModes, type StyleId, type ThemeMode } from "@lume/contracts";

export type { StyleId, ThemeMode };
export type ModeId = ThemeMode;

export function isStyleId(value: unknown): value is StyleId {
  return styleIds.some((style) => style === value);
}

export function isThemeMode(value: unknown): value is ThemeMode {
  return themeModes.some((mode) => mode === value);
}

export function resolveMode(mode: ModeId, prefersLight: boolean): "dark" | "light" {
  return mode === "system" ? (prefersLight ? "light" : "dark") : mode;
}

export function readStoredStyle(): StyleId {
  const raw = window.localStorage.getItem("lume.style");
  return isStyleId(raw) ? raw : "cinema";
}

export function readStoredMode(): ModeId {
  const raw = window.localStorage.getItem("lume.mode");
  return isThemeMode(raw) ? raw : "dark";
}

const STYLE_EVENT = "lume:appearance";

export function currentStyle(): StyleId {
  const { style } = document.documentElement.dataset;
  return isStyleId(style) ? style : "cinema";
}

export function subscribeAppearance(listener: () => void): () => void {
  window.addEventListener(STYLE_EVENT, listener);
  return () => window.removeEventListener(STYLE_EVENT, listener);
}

/** Apply the effective palette without changing saved preferences. */
export function applyAppearance(style: StyleId, mode: ModeId, prefersLight = false): void {
  const theme = resolveMode(mode, prefersLight);
  document.documentElement.dataset.style = style;
  document.documentElement.dataset.theme = theme;
  document.documentElement.dataset.mode = mode;
  window.dispatchEvent(new Event(STYLE_EVENT));
}

const hues = ["lisa", "me", "artem", "mark", "dasha", "sonya", "nick", "katya"] as const;
export type PersonHue = (typeof hues)[number];

export function personHue(seed: string): PersonHue {
  let total = 0;
  for (let index = 0; index < seed.length; index += 1) total = (total + seed.charCodeAt(index)) % hues.length;
  return hues[total] ?? "me";
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? "?";
  const second = parts[1]?.[0] ?? "";
  return `${first}${second}`.toUpperCase();
}
