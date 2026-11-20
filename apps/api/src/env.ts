import { z } from "zod";

const optionalString = z.preprocess(
  (value) => (value === "" || value === undefined ? undefined : value),
  z.string().min(1).optional(),
);

const optionalPort = z.preprocess(
  (value) => (value === "" || value === undefined ? undefined : value),
  z.coerce.number().int().positive().max(65535).optional(),
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
  /** Namespace for auth state and rate limits; e2e uses a separate prefix. */
  REDIS_KEY_PREFIX: z.string().min(1).default("lume"),
  JWT_SECRET: optionalString,
  JWT_TTL_SECONDS: z.coerce.number().int().positive().default(60 * 60 * 12),
  TELEGRAM_BOT_TOKEN: optionalString,
  TELEGRAM_STORAGE_CHAT: optionalString,
  CDN_ENDPOINT: optionalString,
  ALLOW_STUB_AUTH: boolFromEnv.default(false),
  ALLOW_STUB_VOICE: boolFromEnv.default(false),
  TELEGRAM_AUTH_MAX_AGE_SECONDS: z.coerce.number().int().positive().default(300),
  LIVEKIT_URL: optionalString,
  LIVEKIT_API_KEY: optionalString,
  LIVEKIT_API_SECRET: optionalString,
  LIVEKIT_TOKEN_TTL_SECONDS: z.coerce.number().int().positive().default(60 * 60),
  STUN_URLS: optionalString,
  TURN_URL: optionalString,
  TURN_URLS: optionalString,
  TURN_USERNAME: optionalString,
  TURN_CREDENTIAL: optionalString,
  DEV_ADMIN_NAMES: optionalString,
  REALTIME_URL: z.string().min(1).default("http://127.0.0.1:3002"),
  SEARXNG_URL: optionalString,
  COBALT_API_URL: optionalString,
  YTDLP_PATH: optionalString,
  FF_EXTRACTORS: optionalString,
  MEDIA_EXTRACTOR_TIMEOUT_MS: z.coerce.number().int().positive().default(15_000),
  OEMBED_BASE_URL: optionalString,
  METADATA_ALLOW_PRIVATE_HOSTS: boolFromEnv.default(false),
  STREAM_ALLOWLIST: optionalString,
  STREAM_MAX_BYTES: z.coerce.number().int().positive().default(500 * 1024 * 1024),
  STREAM_ALLOW_PRIVATE_HOSTS: boolFromEnv.default(false),
  STREAM_HEADER_TIMEOUT_MS: z.coerce.number().int().positive().default(10_000),
  SMTP_HOST: optionalString,
  SMTP_PORT: optionalPort,
  SMTP_USER: optionalString,
  SMTP_PASSWORD: optionalString,
  SMTP_FROM: optionalString,
  VK_COOKIES: optionalString,
  TWITCH_CLIENT_ID: optionalString,
  TWITCH_CLIENT_SECRET: optionalString,
  VAPID_PUBLIC_KEY: optionalString,
  VAPID_PRIVATE_KEY: optionalString,
  VAPID_SUBJECT: optionalString,
  CDN_BUCKET: optionalString,
  CDN_ACCESS_KEY: optionalString,
  CDN_SECRET_KEY: optionalString,
  CDN_REGION: optionalString,
  CDN_PUBLIC_URL: optionalString,
  WEBAPP_URL: optionalString,
  MINI_APP_URL: optionalString,
  SENTRY_DSN: optionalString,
  METRICS_TOKEN: optionalString,
}).superRefine((value, ctx) => {
  // Production cannot degrade to in-memory auth: refresh tokens and magic
  // links would vanish between restarts and across replicas.
  if (value.NODE_ENV === "production" && !value.REDIS_URL) {
    ctx.addIssue({
      code: "custom",
      path: ["REDIS_URL"],
      message: "REDIS_URL is required in production",
    });
  }
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
