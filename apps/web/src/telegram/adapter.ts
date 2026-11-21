import type { TelegramThemeParams, TelegramWebApp } from "./types.js";

export const previewThemeParams: TelegramThemeParams = {
  bg_color: "#17212b",
  secondary_bg_color: "#232e3c",
  text_color: "#f5f5f5",
  hint_color: "#8aa0b3",
  button_color: "#5288c1",
  button_text_color: "#ffffff",
};

export function themeParamsToCssVars(params: TelegramThemeParams): Record<string, string> {
  const vars: Record<string, string> = {};
  if (params.bg_color) {
    vars["--lume-bg"] = params.bg_color;
    vars["--bg"] = params.bg_color;
  }
  if (params.secondary_bg_color) {
    vars["--lume-surface"] = params.secondary_bg_color;
    vars["--lume-panel"] = params.secondary_bg_color;
    vars["--s1"] = params.secondary_bg_color;
    vars["--s2"] = params.secondary_bg_color;
    vars["--s3"] = params.secondary_bg_color;
  }
  if (params.text_color) {
    vars["--lume-text"] = params.text_color;
    vars["--text"] = params.text_color;
    vars["--line"] = `color-mix(in srgb, ${params.text_color} 16%, transparent)`;
    vars["--line-2"] = `color-mix(in srgb, ${params.text_color} 30%, transparent)`;
  }
  if (params.hint_color) {
    vars["--lume-muted"] = params.hint_color;
    vars["--text-2"] = params.hint_color;
    vars["--text-3"] = params.hint_color;
  }
  if (params.button_color) {
    vars["--lume-accent"] = params.button_color;
    vars["--accent"] = params.button_color;
    vars["--accent-text"] = params.button_color;
    vars["--focus-ring"] = `0 0 0 3px color-mix(in srgb, ${params.button_color} 30%, transparent)`;
  }
  if (params.button_text_color) {
    vars["--lume-accent-text"] = params.button_text_color;
    vars["--accent-ink"] = params.button_text_color;
  }
  return vars;
}

/** Returns true when Telegram actually played the haptic. */
export function hapticImpact(
  webApp: TelegramWebApp | null,
  style: "light" | "medium" | "heavy",
): boolean {
  if (!webApp?.HapticFeedback) {
    return false;
  }
  webApp.HapticFeedback.impactOccurred(style);
  return true;
}

export function bindBackButton(webApp: TelegramWebApp | null, handler: () => void): () => void {
  const button = webApp?.BackButton;
  if (!button) {
    return () => undefined;
  }
  button.show();
  button.onClick(handler);
  return () => {
    button.offClick(handler);
    button.hide();
  };
}
