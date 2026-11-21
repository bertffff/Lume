import { z } from "zod";

export const localeSchema = z.enum(["ru", "en"]);
export type Locale = z.infer<typeof localeSchema>;

export const userSchema = z.object({
  id: z.string().min(1),
  telegramId: z.string().nullable(),
  username: z.string().min(1).nullable(),
  displayName: z.string().min(1).max(80),
  locale: localeSchema,
  themeId: z.string().min(1),
});

export type User = z.infer<typeof userSchema>;
