import { z } from "zod";

const optionalString = z.preprocess(
  (value) => (value === "" || value === undefined ? undefined : value),
  z.string().min(1).optional(),
);

const boolFromEnv = z.preprocess((value) => {
  if (value === undefined || value === "") {
    return undefined;
  }
  if (value === true || value === "true" || value === "1") {
    return true;
  }
  if (value === false || value === "false" || value === "0") {
    return false;
  }
  return value;
}, z.boolean().optional());

export const apiEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  API_HOST: z.string().min(1).default("0.0.0.0"),
  API_PORT: z.coerce.number().int().positive().default(3001),
  WEB_ORIGIN: z.string().min(1).default("http://localhost:5173"),
  DATABASE_URL: optionalString,
  REDIS_URL: optionalString,
  JWT_SECRET: optionalString,
  JWT_TTL_SECONDS: z.coerce.number().int().positive().default(60 * 60 * 12),
  TELEGRAM_BOT_TOKEN: optionalString,
  TELEGRAM_STORAGE_CHAT: optionalString,
  CDN_ENDPOINT: optionalString,
  ALLOW_STUB_AUTH: boolFromEnv.default(false),
  TELEGRAM_AUTH_MAX_AGE_SECONDS: z.coerce.number().int().positive().default(300),
  LIVEKIT_URL: optionalString,
  LIVEKIT_API_KEY: optionalString,
  LIVEKIT_API_SECRET: optionalString,
  LIVEKIT_TOKEN_TTL_SECONDS: z.coerce.number().int().positive().default(60 * 60),
  DEV_ADMIN_NAMES: optionalString,
  REALTIME_URL: z.string().min(1).default("http://127.0.0.1:3002"),
  SEARXNG_URL: optionalString,
  COBALT_API_URL: optionalString,
  YTDLP_PATH: optionalString,
  FF_EXTRACTORS: optionalString,
  SMTP_HOST: optionalString,
  VAPID_PUBLIC_KEY: optionalString,
  SENTRY_DSN: optionalString,
  METRICS_TOKEN: optionalString,
});

export type ApiEnv = z.infer<typeof apiEnvSchema>;

export function loadApiEnv(source: NodeJS.ProcessEnv): ApiEnv {
  const parsed = apiEnvSchema.safeParse(source);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ");
    throw new Error(`Invalid API environment: ${details}`);
  }
  return parsed.data;
}
