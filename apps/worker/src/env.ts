import { z } from "zod";

const optionalString = z.preprocess(
  (value) => (value === "" || value === undefined ? undefined : value),
  z.string().min(1).optional(),
);

const optionalPort = z.preprocess(
  (value) => (value === "" || value === undefined ? undefined : value),
  z.coerce.number().int().positive().max(65535).optional(),
);

export const workerEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  WORKER_HOST: z.string().min(1).default("0.0.0.0"),
  WORKER_PORT: z.coerce.number().int().positive().default(3003),
  REDIS_URL: optionalString,
  DATABASE_URL: optionalString,
  WEB_ORIGIN: z.string().min(1).default("http://localhost:5173"),
  TELEGRAM_BOT_TOKEN: optionalString,
  FF_EXTRACTORS: optionalString,
  MEDIA_EXTRACTOR_TIMEOUT_MS: z.coerce.number().int().positive().default(15_000),
  COBALT_API_URL: optionalString,
  YTDLP_PATH: optionalString,
  VK_COOKIES: optionalString,
  TWITCH_CLIENT_ID: optionalString,
  TWITCH_CLIENT_SECRET: optionalString,
  SEARXNG_URL: optionalString,
  SMTP_HOST: optionalString,
  SMTP_PORT: optionalPort,
  SMTP_USER: optionalString,
  SMTP_PASSWORD: optionalString,
  SMTP_FROM: optionalString,
  VAPID_PUBLIC_KEY: optionalString,
  VAPID_PRIVATE_KEY: optionalString,
  VAPID_SUBJECT: optionalString,
});

export type WorkerEnv = z.infer<typeof workerEnvSchema>;

export function loadWorkerEnv(source: NodeJS.ProcessEnv): WorkerEnv {
  const parsed = workerEnvSchema.safeParse(source);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ");
    throw new Error(`Invalid worker environment: ${details}`);
  }
  return parsed.data;
}
