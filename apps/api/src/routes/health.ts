import type { PrismaClient } from "@lume/db";
import type { FastifyInstance } from "fastify";
import type { ApiEnv } from "../env.js";
import { pingRedis, type RedisLike } from "../redis.js";
import { liveKitConfigured } from "../voice/livekit.js";

export interface HealthDeps {
  prisma: PrismaClient | null;
  redis: RedisLike | null;
}

async function databaseReady(prisma: PrismaClient | null, timeoutMs = 3000): Promise<boolean> {
  if (!prisma) return false;
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<boolean>((resolve) => {
    timer = setTimeout(() => resolve(false), timeoutMs);
  });
  try {
    const probe = prisma.$queryRaw`SELECT 1`.then(() => true).catch(() => false);
    return await Promise.race([probe, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export function registerHealthRoutes(app: FastifyInstance, env: ApiEnv, deps: HealthDeps): void {
  app.get("/health", async () => ({ status: "ok" }));
  app.get("/live", async () => ({ status: "ok" }));

  app.get("/ready", async (_request, reply) => {
    const [database, redis] = await Promise.all([
      databaseReady(deps.prisma),
      deps.redis ? pingRedis(deps.redis) : Promise.resolve(false),
    ]);
    const checks = {
      database: deps.prisma ? (database ? "up" : "down") : "missing",
      redis: deps.redis ? (redis ? "up" : "down") : "missing",
      jwt: env.JWT_SECRET ? "configured" : "missing",
      telegram: env.TELEGRAM_BOT_TOKEN ? "configured" : "missing",
      livekit: liveKitConfigured(env) ? "configured" : "disabled",
    };
    const requiredDown = checks.database === "down" || checks.redis === "down";
    const requiredMissing = checks.database === "missing" || checks.redis === "missing";
    if (env.NODE_ENV === "production" && (requiredDown || requiredMissing)) {
      return reply.code(503).send({ status: "not_ready", mode: "live", checks });
    }
    return { status: "ready", mode: "live", checks };
  });
}
