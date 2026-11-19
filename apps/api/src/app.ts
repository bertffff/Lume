import cors from "@fastify/cors";
import { Redis } from "ioredis";
import type { PrismaClient } from "@lume/db";
import Fastify, { type FastifyInstance } from "fastify";
import type { ApiEnv } from "./env.js";
import { limitFor, takeMemoryLimit, takeRedisLimit } from "./http/limit.js";
import { resolveMetadata } from "./media/metadata.js";
import { createPrismaRepository } from "./rooms/prisma-repo.js";
import { RoomService } from "./rooms/service.js";
import { registerAuthRoutes } from "./routes/auth.js";
import { registerHealthRoutes } from "./routes/health.js";
import { registerRoomRoutes } from "./routes/rooms.js";
import { registerExtraRoutes } from "./routes/extras.js";
import { registerSocialRoutes } from "./routes/social.js";
import { registerVideoRoutes } from "./routes/video.js";
import { registerVoiceRoutes } from "./routes/voice.js";

export async function buildApp(
  env: ApiEnv,
  options?: { prisma?: PrismaClient },
): Promise<FastifyInstance> {
  const app = Fastify({
    logger: env.NODE_ENV !== "test",
  });
  const service = options?.prisma
    ? new RoomService(createPrismaRepository(options.prisma), undefined, undefined, (item) =>
        resolveMetadata(item, {
          ...(env.OEMBED_BASE_URL ? { oEmbedBaseUrl: env.OEMBED_BASE_URL } : {}),
          allowPrivateHosts: env.METADATA_ALLOW_PRIVATE_HOSTS,
        }),
      )
    : null;

  await app.register(cors, {
    origin: env.WEB_ORIGIN,
    methods: ["GET", "HEAD", "POST", "PATCH", "PUT", "DELETE"],
  });
  const limiter = env.REDIS_URL ? new Redis(env.REDIS_URL, { maxRetriesPerRequest: 1, enableOfflineQueue: false }) : null;
  app.addHook("onRequest", async (request, reply) => {
    const path = request.url.split("?")[0] ?? request.url;
    const rule = limitFor(request.method, path);
    if (!rule) return;
    const key = `${request.method}:${path}:${request.ip}`;
    const ok = limiter
      ? await takeRedisLimit(limiter, `lume:rl:${key}`, rule.limit, rule.windowMs).catch(() =>
          takeMemoryLimit(key, rule.limit, rule.windowMs, Date.now()),
        )
      : takeMemoryLimit(key, rule.limit, rule.windowMs, Date.now());
    if (!ok) {
      await reply.code(429).send({ error: "rate_limited" });
    }
  });
  registerHealthRoutes(app, env);
  registerAuthRoutes(app, env, options?.prisma);
  registerRoomRoutes(app, env, service, options?.prisma ?? null);
  registerVoiceRoutes(app, env, service, options?.prisma ?? null);
  registerSocialRoutes(app, env, options?.prisma ?? null, service);
  registerVideoRoutes(app, env, options?.prisma ?? null);
  registerExtraRoutes(app, env, options?.prisma ?? null);

  app.setErrorHandler((error, _request, reply) => {
    app.log.error(error);
    return reply.code(500).send({ error: "internal" });
  });

  return app;
}
