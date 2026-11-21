export type StyleId = "cinema" | "gruvbox";
export type ModeId = "dark" | "light" | "system";

const styles = new Set<StyleId>(["cinema", "gruvbox"]);
const modes = new Set<ModeId>(["dark", "light", "system"]);

export function resolveMode(mode: ModeId, prefersLight: boolean): "dark" | "light" {
  return mode === "system" ? (prefersLight ? "light" : "dark") : mode;
}

export function readStoredStyle(): StyleId {
  const raw = window.localStorage.getItem("lume.style");
  return styles.has(raw as StyleId) ? (raw as StyleId) : "cinema";
}

export function readStoredMode(): ModeId {
  const raw = window.localStorage.getItem("lume.mode");
  return modes.has(raw as ModeId) ? (raw as ModeId) : "dark";
}

const STYLE_EVENT = "lume:appearance";

export function currentStyle(): StyleId {
  return document.documentElement.dataset.style === "gruvbox" ? "gruvbox" : "cinema";
}

export function subscribeAppearance(listener: () => void): () => void {
  window.addEventListener(STYLE_EVENT, listener);
  return () => window.removeEventListener(STYLE_EVENT, listener);
}

export function applyAppearance(style: StyleId, mode: ModeId, prefersLight = window.matchMedia("(prefers-color-scheme: light)").matches): void {
  const theme = resolveMode(mode, prefersLight);
  document.documentElement.dataset.style = style;
  document.documentElement.dataset.theme = theme;
  document.documentElement.dataset.mode = mode;
  window.localStorage.setItem("lume.style", style);
  window.localStorage.setItem("lume.mode", mode);
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
