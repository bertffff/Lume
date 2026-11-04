import { z } from "zod";

export const telegramWebAppUserSchema = z.object({
  id: z.number().int().positive(),
  first_name: z.string().min(1),
  last_name: z.string().min(1).optional(),
  username: z.string().min(1).optional(),
  language_code: z.string().min(1).optional(),
  is_premium: z.boolean().optional(),
  photo_url: z.string().url().optional(),
});

export type TelegramWebAppUser = z.infer<typeof telegramWebAppUserSchema>;

/** Parsed Telegram Mini App initData, after the raw query string is checked. */
export const telegramAuthPayloadSchema = z.object({
  queryId: z.string().min(1).optional(),
  authDate: z.number().int().nonnegative(),
  hash: z.string().min(1),
  user: telegramWebAppUserSchema,
});

export type TelegramAuthPayload = z.infer<typeof telegramAuthPayloadSchema>;

export const telegramAuthRequestSchema = z.object({
  initData: z.string().min(1),
});

export type TelegramAuthRequest = z.infer<typeof telegramAuthRequestSchema>;

export const accessTokenRequestSchema = z.object({
  userId: z.string().min(1),
  telegramId: z.string().min(1).nullable().optional(),
  displayName: z.string().min(1).max(80).optional(),
});

export const devAuthRequestSchema = z.object({
  displayName: z.string().trim().min(1).max(80),
});

export type AccessTokenRequest = z.infer<typeof accessTokenRequestSchema>;
