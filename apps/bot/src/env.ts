import { z } from "zod";

const optionalString = z.preprocess(
  (value) => (value === "" || value === undefined ? undefined : value),
  z.string().min(1).optional(),
);

export const botEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  BOT_HOST: z.string().min(1).default("0.0.0.0"),
  BOT_PORT: z.coerce.number().int().positive().default(3004),
  TELEGRAM_BOT_TOKEN: optionalString,
  TELEGRAM_BOT_USERNAME: optionalString,
  WEB_ORIGIN: z.string().min(1).default("http://localhost:5173"),
});

export type BotEnv = z.infer<typeof botEnvSchema>;

export function loadBotEnv(source: NodeJS.ProcessEnv): BotEnv {
  const parsed = botEnvSchema.safeParse(source);
  if (!parsed.success) {
    throw new Error("Invalid bot environment");
  }
  return parsed.data;
}
