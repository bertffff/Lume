export interface TelegramThemeParams {
  bg_color?: string;
  text_color?: string;
  hint_color?: string;
  button_color?: string;
  button_text_color?: string;
  secondary_bg_color?: string;
  header_bg_color?: string;
}

export interface TelegramHapticFeedback {
  impactOccurred: (style: "light" | "medium" | "heavy") => void;
}

export interface TelegramBackButton {
  show: () => void;
  hide: () => void;
  onClick: (handler: () => void) => void;
  offClick: (handler: () => void) => void;
}

export interface TelegramMainButton {
  setText: (text: string) => void;
  show: () => void;
  hide: () => void;
  onClick: (handler: () => void) => void;
  offClick: (handler: () => void) => void;
}

export interface TelegramWebApp {
  initData?: string;
  initDataUnsafe?: { user?: { language_code?: string }; start_param?: string };
  themeParams?: TelegramThemeParams;
  colorScheme?: "light" | "dark";
  ready?: () => void;
  expand?: () => void;
  onEvent?: (event: string, handler: () => void) => void;
  HapticFeedback?: TelegramHapticFeedback;
  BackButton?: TelegramBackButton;
  MainButton?: TelegramMainButton;
}

interface TelegramGlobal {
  Telegram?: { WebApp?: TelegramWebApp };
}

export function readTelegramWebApp(): TelegramWebApp | null {
  if (typeof window === "undefined") {
    return null;
  }
  return (window as unknown as TelegramGlobal).Telegram?.WebApp ?? null;
}
