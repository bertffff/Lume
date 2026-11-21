import { createPrismaClient } from "@lume/db";
import { prepareSocial } from "./routes/social.js";
import { buildApp } from "./app.js";
import { loadApiEnv } from "./env.js";
import { loadRepoEnv } from "./load-env.js";
import { createRedis, redisAdapter, waitForRedisReady } from "./redis.js";

loadRepoEnv();
const env = loadApiEnv(process.env);
const prisma = env.DATABASE_URL ? createPrismaClient() : undefined;
if (prisma) {
  await prepareSocial(prisma);
}

const client = env.REDIS_URL ? createRedis(env.REDIS_URL) : null;
const redis = client ? redisAdapter(client) : null;
if (client) {
  const ready = await waitForRedisReady(client, 5000);
  if (!ready) {
    // Production auth state (refresh tokens, magic links) lives in Redis.
    // Starting without it would silently lose sessions between restarts.
    if (env.NODE_ENV === "production") {
      console.error(JSON.stringify({ service: "api", fatal: "redis_unreachable" }));
      await client?.quit().catch(() => undefined);
      process.exit(1);
    }
    console.warn(JSON.stringify({ service: "api", warning: "redis_unreachable", mode: "degraded" }));
  }
}

const app = await buildApp(env, {
  ...(prisma ? { prisma } : {}),
  ...(redis ? { redis } : {}),
});

const shutdown = async (signal: string) => {
  app.log.info({ signal }, "shutting down");
  await app.close().catch(() => undefined);
  await client?.quit().catch(() => undefined);
  process.exit(0);
};
process.once("SIGTERM", () => void shutdown("SIGTERM"));
process.once("SIGINT", () => void shutdown("SIGINT"));

await app.listen({ host: env.API_HOST, port: env.API_PORT });
