import type { FastifyInstance } from "fastify";
import type { ApiEnv } from "../env.js";
import { liveKitConfigured } from "../voice/livekit.js";

export function registerHealthRoutes(app: FastifyInstance, env: ApiEnv): void {
  app.get("/health", async () => ({ status: "ok" }));
  app.get("/live", async () => ({ status: "ok" }));

  app.get("/ready", async () => ({
    status: "ready",
    mode: "config",
    checks: {
      database: env.DATABASE_URL ? "configured" : "missing",
      redis: env.REDIS_URL ? "configured" : "missing",
      jwt: env.JWT_SECRET ? "configured" : "missing",
      telegram: env.TELEGRAM_BOT_TOKEN ? "configured" : "missing",
      livekit: liveKitConfigured(env) ? "configured" : "disabled",
    },
  }));
}
