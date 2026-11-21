import { z } from "zod";

export const themeSchema = z.object({
  id: z.string().min(1),
  name: z.object({
    ru: z.string().min(1),
    en: z.string().min(1),
  }),
  premium: z.boolean(),
  colors: z.object({
    bg: z.string().min(1),
    surface: z.string().min(1),
    panel: z.string().min(1),
    text: z.string().min(1),
    muted: z.string().min(1),
    accent: z.string().min(1),
    accentText: z.string().min(1),
    line: z.string().min(1),
    danger: z.string().min(1),
    ok: z.string().min(1),
  }),
  radius: z.object({
    sm: z.string().min(1),
    md: z.string().min(1),
    lg: z.string().min(1),
  }),
  font: z.object({
    sans: z.string().min(1),
    display: z.string().min(1),
  }),
});

export type Theme = z.infer<typeof themeSchema>;
