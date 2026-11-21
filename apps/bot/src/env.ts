import { z } from "zod";

const optionalString = z.preprocess(
  (value) => (value === "" || value === undefined ? undefined : value),
  z.string().min(1).optional(),
);

const optionalUrl = z.preprocess(
  (value) => (value === "" || value === undefined ? undefined : value),
  z.string().url().optional(),
);

export const botEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  BOT_HOST: z.string().min(1).default("0.0.0.0"),
  BOT_PORT: z.coerce.number().int().positive().default(3004),
  TELEGRAM_BOT_TOKEN: optionalString,
  TELEGRAM_BOT_USERNAME: optionalString,
  WEB_ORIGIN: z.string().min(1).default("http://localhost:5173"),
  /** Public HTTPS URL of the Mini App. `WEBAPP_URL` wins over `MINI_APP_URL`. */
  WEBAPP_URL: optionalUrl,
  MINI_APP_URL: optionalUrl,
});

export type BotEnv = z.infer<typeof botEnvSchema>;

export function miniAppBase(env: Pick<BotEnv, "WEBAPP_URL" | "MINI_APP_URL">): string | null {
  return env.WEBAPP_URL ?? env.MINI_APP_URL ?? null;
}

export function loadBotEnv(source: NodeJS.ProcessEnv): BotEnv {
  const parsed = botEnvSchema.safeParse(source);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ");
    throw new Error(`Invalid bot environment: ${details}`);
  }
  return parsed.data;
}
