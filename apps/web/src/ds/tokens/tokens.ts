export const styleIds = ["cinema", "gruvbox", "telerave"] as const;
export const themeIds = ["dark", "light"] as const;

/** Roles every «style × theme» block must define. Components may only use these. */
export const modeRoles = [
  "bg", "surface-1", "surface-2", "surface-3", "overlay", "scrim", "stage",
  "text-primary", "text-secondary", "text-tertiary", "text-on-accent",
  "border", "border-strong", "focus",
  "accent", "accent-hover", "accent-text", "accent-soft",
  "success", "success-soft", "warn", "warn-soft", "danger", "danger-soft", "info", "info-soft",
  "shadow-1", "shadow-2", "shadow-3", "glow",
] as const;

/** Roles every style defines once for both themes. */
export const styleRoles = [
  "font-display", "font-text", "font-mono",
  "radius-control", "radius-card", "radius-sheet", "radius-chip", "radius-pill",
  "icon-stroke", "border-w", "surface-blur",
] as const;

export type ModeRole = (typeof modeRoles)[number];
export type StyleRole = (typeof styleRoles)[number];
export const dsVar = (role: ModeRole | StyleRole) => `var(--ds-${role})`;
