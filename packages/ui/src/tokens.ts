import type { Theme } from "@lume/contracts";

export const space = {
  xs: "4px",
  sm: "8px",
  md: "12px",
  lg: "16px",
  xl: "24px",
  xxl: "40px",
} as const;

export const motion = {
  fast: "120ms",
  base: "220ms",
} as const;

export function themeToCssVars(theme: Theme): Record<string, string> {
  return {
    "--lume-bg": theme.colors.bg,
    "--lume-surface": theme.colors.surface,
    "--lume-panel": theme.colors.panel,
    "--lume-text": theme.colors.text,
    "--lume-muted": theme.colors.muted,
    "--lume-accent": theme.colors.accent,
    "--lume-accent-text": theme.colors.accentText,
    "--lume-line": theme.colors.line,
    "--lume-danger": theme.colors.danger,
    "--lume-ok": theme.colors.ok,
    "--lume-radius-sm": theme.radius.sm,
    "--lume-radius-md": theme.radius.md,
    "--lume-radius-lg": theme.radius.lg,
    "--lume-font-sans": theme.font.sans,
    "--lume-font-display": theme.font.display,
  };
}
