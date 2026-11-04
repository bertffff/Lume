import cors from "@fastify/cors";
import type { PrismaClient } from "@lume/db";
import Fastify, { type FastifyInstance } from "fastify";
import type { ApiEnv } from "./env.js";
import { fetchOEmbedTitle } from "./media/oembed.js";
import { createPrismaRepository } from "./rooms/prisma-repo.js";
import { RoomService } from "./rooms/service.js";
import { registerAuthRoutes } from "./routes/auth.js";
import { registerHealthRoutes } from "./routes/health.js";
import { registerRoomRoutes } from "./routes/rooms.js";
import { registerVoiceRoutes } from "./routes/voice.js";

export async function buildApp(
  env: ApiEnv,
  options?: { prisma?: PrismaClient },
): Promise<FastifyInstance> {
  const app = Fastify({
    logger: env.NODE_ENV !== "test",
  });
  const service = options?.prisma
    ? new RoomService(createPrismaRepository(options.prisma), undefined, undefined, fetchOEmbedTitle)
    : null;

  await app.register(cors, { origin: env.WEB_ORIGIN });
  registerHealthRoutes(app, env);
  registerAuthRoutes(app, env, options?.prisma);
  registerRoomRoutes(app, env, service);
  registerVoiceRoutes(app, env, service);

  app.setErrorHandler((error, _request, reply) => {
    app.log.error(error);
    return reply.code(500).send({ error: "internal" });
  });

  return app;
}
