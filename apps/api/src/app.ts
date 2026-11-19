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

/** Local dev is opened as both `localhost` and `127.0.0.1`; the browser player needs both allowed. */
function corsOrigins(env: ApiEnv): string[] {
  let parsed: URL;
  try {
    parsed = new URL(env.WEB_ORIGIN);
  } catch {
    // A malformed WEB_ORIGIN is rejected elsewhere; keep the literal entry.
    return [env.WEB_ORIGIN];
  }
  const origins = new Set<string>([parsed.origin]);
  if (env.NODE_ENV !== "production") {
    const alias = parsed.hostname === "localhost" ? "127.0.0.1" : parsed.hostname === "127.0.0.1" ? "localhost" : null;
    if (alias) {
      const next = new URL(parsed.toString());
      next.hostname = alias;
      origins.add(next.origin);
    }
  }
  return [...origins];
}

/** Prisma exposes the failure class through `code`; never forward the raw message to a client. */
export function prismaFailure(error: unknown): { status: number; body: { error: string } } | null {
  const code = (error as { code?: unknown } | null)?.code;
  if (typeof code !== "string" || !code.startsWith("P")) {
    return null;
  }
  // Connection/runtime failures are transient; schema/config failures stay 500.
  if (["P1000", "P1001", "P1002", "P1008", "P1017"].includes(code)) {
    return { status: 503, body: { error: "database_unavailable" } };
  }
  switch (code) {
    case "P2025":
      return { status: 404, body: { error: "not_found" } };
    case "P2002":
      return { status: 409, body: { error: "conflict" } };
    case "P2003":
      return { status: 409, body: { error: "conflict" } };
    case "P2000":
    case "P2005":
    case "P2006":
    case "P2007":
    case "P2009":
    case "P2011":
    case "P2012":
    case "P2013":
      return { status: 400, body: { error: "invalid_body" } };
    case "P2023":
      return { status: 400, body: { error: "invalid_body" } };
    default:
      return { status: 500, body: { error: "internal" } };
  }
}

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
    origin: corsOrigins(env),
    methods: ["GET", "HEAD", "POST", "PATCH", "PUT", "DELETE"],
    allowedHeaders: ["content-type", "authorization", "range"],
    exposedHeaders: ["content-range", "accept-ranges", "content-length", "x-lume-retry"],
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
      return reply.code(429).send({ error: "rate_limited" });
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
    if (reply.sent) {
      return reply;
    }
    const mapped = prismaFailure(error);
    if (mapped) {
      if (mapped.status >= 500) {
        app.log.error(error);
      }
      return reply.code(mapped.status).send(mapped.body);
    }
    app.log.error(error);
    return reply.code(500).send({ error: "internal" });
  });

  return app;
}
