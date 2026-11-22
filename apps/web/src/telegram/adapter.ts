import type { TelegramThemeParams, TelegramWebApp } from "./types.js";

export const previewThemeParams: TelegramThemeParams = {
  bg_color: "#17212b",
  secondary_bg_color: "#232e3c",
  text_color: "#f5f5f5",
  hint_color: "#8aa0b3",
  button_color: "#5288c1",
  button_text_color: "#ffffff",
};

/** Telegram's chat colours override the design tokens, so the Mini App looks native inside the chat. */
export function themeParamsToCssVars(params: TelegramThemeParams): Record<string, string> {
  const vars: Record<string, string> = {};
  if (params.bg_color) vars["--ds-bg"] = params.bg_color;
  if (params.secondary_bg_color) {
    vars["--ds-surface-1"] = params.secondary_bg_color;
    vars["--ds-surface-2"] = params.secondary_bg_color;
    vars["--ds-surface-3"] = `color-mix(in srgb, ${params.secondary_bg_color} 88%, ${params.text_color ?? "white"})`;
  }
  if (params.text_color) {
    vars["--ds-text-primary"] = params.text_color;
    vars["--ds-border"] = `color-mix(in srgb, ${params.text_color} 16%, transparent)`;
    vars["--ds-border-strong"] = `color-mix(in srgb, ${params.text_color} 30%, transparent)`;
  }
  if (params.hint_color) {
    vars["--ds-text-secondary"] = params.hint_color;
    vars["--ds-text-tertiary"] = params.hint_color;
  }
  if (params.button_color) {
    vars["--ds-accent"] = params.button_color;
    vars["--ds-accent-text"] = params.button_color;
    vars["--ds-accent-soft"] = `color-mix(in srgb, ${params.button_color} 18%, transparent)`;
    vars["--ds-focus"] = params.button_color;
  }
  if (params.button_text_color) vars["--ds-text-on-accent"] = params.button_text_color;
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
