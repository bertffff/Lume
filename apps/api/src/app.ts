import cors from "@fastify/cors";
import Fastify, { type FastifyInstance } from "fastify";
import type { ApiEnv } from "./env.js";
import { registerAuthRoutes } from "./routes/auth.js";
import { registerHealthRoutes } from "./routes/health.js";
import { registerVoiceRoutes } from "./routes/voice.js";

export async function buildApp(env: ApiEnv): Promise<FastifyInstance> {
  const app = Fastify({
    logger: env.NODE_ENV !== "test",
  });

  await app.register(cors, { origin: env.WEB_ORIGIN });
  registerHealthRoutes(app, env);
  registerAuthRoutes(app, env);
  registerVoiceRoutes(app, env);

  app.setErrorHandler((error, _request, reply) => {
    app.log.error(error);
    return reply.code(500).send({ error: "internal" });
  });

  return app;
}
