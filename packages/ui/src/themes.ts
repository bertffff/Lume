import { themeSchema, type Theme } from "@lume/contracts";

const sans = '"Outfit", "Avenir Next", "Segoe UI", sans-serif';
const display = '"Fraunces", "Iowan Old Style", Palatino, Georgia, serif';

export const emberTheme: Theme = themeSchema.parse({
  id: "ember",
  name: { ru: "Уголь", en: "Ember" },
  premium: false,
  colors: {
    bg: "#100e0c",
    surface: "#1b1612",
    panel: "#241c16",
    text: "#f6efe6",
    muted: "#b3a292",
    accent: "#e3924a",
    accentText: "#1a1008",
    line: "rgba(246, 239, 230, 0.14)",
    danger: "#e15b4c",
    ok: "#8fbf78",
  },
  radius: { sm: "8px", md: "16px", lg: "28px" },
  font: { sans, display },
});

export const auroraTheme: Theme = themeSchema.parse({
  id: "aurora",
  name: { ru: "Аврора", en: "Aurora" },
  premium: true,
  colors: {
    bg: "#0b1218",
    surface: "#121b24",
    panel: "#182633",
    text: "#e7f2f8",
    muted: "#8eabc0",
    accent: "#7ee0d0",
    accentText: "#06211e",
    line: "rgba(190, 224, 236, 0.16)",
    danger: "#ff8d7a",
    ok: "#9ee0a8",
  },
  radius: { sm: "4px", md: "8px", lg: "12px" },
  font: { sans, display },
});

export const themes = [emberTheme, auroraTheme] as const;

export function themeById(id: string): Theme {
  return themes.find((theme) => theme.id === id) ?? emberTheme;
}
