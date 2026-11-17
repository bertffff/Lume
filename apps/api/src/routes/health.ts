import type { FastifyInstance } from "fastify";
import type { ApiEnv } from "../env.js";
import { liveKitConfigured } from "../voice/livekit.js";

export function registerHealthRoutes(app: FastifyInstance, env: ApiEnv): void {
  app.get("/health", async () => ({ status: "ok" }));
  app.get("/live", async () => ({ status: "ok" }));

  app.get("/ready", async (_request, reply) => {
    const checks = {
      database: env.DATABASE_URL ? "configured" : "missing",
      redis: env.REDIS_URL ? "configured" : "missing",
      jwt: env.JWT_SECRET ? "configured" : "missing",
      telegram: env.TELEGRAM_BOT_TOKEN ? "configured" : "missing",
      livekit: liveKitConfigured(env) ? "configured" : "disabled",
    };
    if (env.NODE_ENV === "production" && (checks.database === "missing" || checks.redis === "missing")) {
      return reply.code(503).send({ status: "not_ready", checks });
    }
    return { status: "ready", mode: "config", checks };
  });
}
