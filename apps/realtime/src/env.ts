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

export const realtimeEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  REALTIME_HOST: z.string().min(1).default("0.0.0.0"),
  REALTIME_PORT: z.coerce.number().int().positive().default(3002),
  REALTIME_REPLICA_INDEX: z.coerce.number().int().nonnegative().default(0),
  REALTIME_REPLICA_COUNT: z.coerce.number().int().positive().default(1),
  REALTIME_ENFORCE_ROOM_OWNER: boolFromEnv.default(false),
  WEB_ORIGIN: z.string().min(1).default("http://localhost:5173"),
  REDIS_URL: optionalString,
  API_URL: z.string().min(1).default("http://127.0.0.1:3001"),
  JWT_SECRET: optionalString,
});

export type RealtimeEnv = z.infer<typeof realtimeEnvSchema>;

export function loadRealtimeEnv(source: NodeJS.ProcessEnv): RealtimeEnv {
  const parsed = realtimeEnvSchema.safeParse(source);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ");
    throw new Error(`Invalid realtime environment: ${details}`);
  }
  if (parsed.data.REALTIME_REPLICA_INDEX >= parsed.data.REALTIME_REPLICA_COUNT) {
    throw new Error("REALTIME_REPLICA_INDEX must be smaller than REALTIME_REPLICA_COUNT");
  }
  return parsed.data;
}
