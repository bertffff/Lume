import cors from "@fastify/cors";
import type { PrismaClient } from "@lume/db";
import Fastify, { type FastifyInstance } from "fastify";
import type { ApiEnv } from "./env.js";
import { createAuthStores, type AuthStores } from "./auth/stores.js";
import { createRoomJoinLimiter, limitFor, roomJoinPath, takeMemoryLimit, takeRedisLimit } from "./http/limit.js";
import {
  createCachedMetadataResolver,
  createCircuitBreaker,
  createMetadataCache,
} from "./media/metadata-cache.js";
import { createMediaStorage, type MediaStorage } from "./media/storage.js";
import { createRedis, redisAdapter, type RedisLike } from "./redis.js";
import { createPrismaRepository } from "./rooms/prisma-repo.js";
import { RoomService } from "./rooms/service.js";
import { registerAuthRoutes } from "./routes/auth.js";
import { registerHealthRoutes } from "./routes/health.js";
import { registerRoomRoutes } from "./routes/rooms.js";
import { registerExtraRoutes } from "./routes/extras.js";
import { registerSocialRoutes } from "./routes/social.js";
import { registerVideoRoutes } from "./routes/video.js";
import { registerVoiceRoutes } from "./routes/voice.js";

/** 10 MiB uploads need headroom for base64 and JSON framing. */
export const API_BODY_LIMIT_BYTES = 15 * 1024 * 1024;

export interface BuildAppOptions {
  prisma?: PrismaClient;
  redis?: RedisLike;
  stores?: AuthStores;
  storage?: MediaStorage;
}


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
  options?: BuildAppOptions,
): Promise<FastifyInstance> {
  const app = Fastify({
    logger: env.NODE_ENV === "test" ? false : {
      serializers: {
        req: (request) => ({ method: request.method, url: request.routeOptions?.url ?? "unmatched" }),
      },
    },
    bodyLimit: API_BODY_LIMIT_BYTES,
  });
  const ownedClient = options?.redis ? null : env.REDIS_URL ? createRedis(env.REDIS_URL) : null;
  const redis: RedisLike | null = options?.redis ?? (ownedClient ? redisAdapter(ownedClient) : null);
  const keyPrefix = env.NODE_ENV === "test" ? `${env.REDIS_KEY_PREFIX}:test:api` : env.REDIS_KEY_PREFIX;
  const joinLimiter = createRoomJoinLimiter(redis, keyPrefix, env.NODE_ENV === "production");
  const stores = options?.stores ?? createAuthStores({ redis, keyPrefix });
  const storage = options?.storage ?? createMediaStorage({ env });
  const service = options?.prisma
    ? new RoomService(
        createPrismaRepository(options.prisma),
        undefined,
        undefined,
        createCachedMetadataResolver(
          {
            ...(env.OEMBED_BASE_URL ? { oEmbedBaseUrl: env.OEMBED_BASE_URL } : {}),
            allowPrivateHosts: env.METADATA_ALLOW_PRIVATE_HOSTS,
          },
          { cache: createMetadataCache(redis), breaker: createCircuitBreaker() },
        ),
      )
    : null;

  await app.register(cors, {
    origin: corsOrigins(env),
    methods: ["GET", "HEAD", "POST", "PATCH", "PUT", "DELETE"],
    allowedHeaders: ["content-type", "authorization", "range"],
    exposedHeaders: ["content-range", "accept-ranges", "content-length", "x-lume-retry"],
  });
  app.addHook("onRequest", async (request, reply) => {
    if (request.method === "POST" && request.routeOptions.url === roomJoinPath) return;
    const path = request.url.split("?")[0] ?? request.url;
    const rule = limitFor(request.method, path);
    if (!rule) return;
    const key = `${request.method}:${path}:${request.ip}`;
    const ok = redis
      ? await takeRedisLimit(redis, `${keyPrefix}:rl:${key}`, rule.limit, rule.windowMs).catch(() =>
          takeMemoryLimit(key, rule.limit, rule.windowMs, Date.now()),
        )
      : takeMemoryLimit(key, rule.limit, rule.windowMs, Date.now());
    if (!ok) {
      return reply.code(429).send({ error: "rate_limited" });
    }
  });
  app.addHook("onClose", async () => {
    if (ownedClient) {
      await ownedClient.quit().catch(() => undefined);
    }
  });
  registerHealthRoutes(app, env, { prisma: options?.prisma ?? null, redis });
  registerAuthRoutes(app, env, options?.prisma, stores);
  registerRoomRoutes(app, env, service, options?.prisma ?? null, joinLimiter, redis);
  registerVoiceRoutes(app, env, service, options?.prisma ?? null);
  registerSocialRoutes(app, env, options?.prisma ?? null, service, stores, redis);
  registerVideoRoutes(app, env, options?.prisma ?? null, { redis });
  registerExtraRoutes(app, env, options?.prisma ?? null, { stores, storage, redis });
  app.setErrorHandler((error, request, reply) => {
    if (reply.sent) {
      return reply;
    }
    const mapped = prismaFailure(error);
    const inviteRoute = request.method === "POST" && [roomJoinPath, "/rooms", "/rooms/resume-last"].includes(request.routeOptions.url ?? "");
    const logError = () => {
      if (inviteRoute) request.log.error("Room invite operation failed");
      else request.log.error(error);
    };
    if (mapped) {
      if (mapped.status >= 500) {
        logError();
      }
      return reply.code(mapped.status).send(mapped.body);
    }
    logError();
    return reply.code(500).send({ error: "internal" });
  });

  return app;
}
