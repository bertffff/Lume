import { z } from "zod";
import type { FastifyInstance } from "fastify";
import type { ApiEnv } from "../env.js";
import { liveKitConfigured, mintLiveKitToken } from "../voice/livekit.js";

const tokenRequestSchema = z.object({
  roomId: z.string().min(1).max(80),
  identity: z.string().min(1).max(80),
  name: z.string().min(1).max(80),
});

export function registerVoiceRoutes(app: FastifyInstance, env: ApiEnv): void {
  app.post("/voice/livekit/token", async (request, reply) => {
    if (!liveKitConfigured(env)) {
      return reply.code(503).send({ error: "livekit_disabled" });
    }
    const body = tokenRequestSchema.safeParse(request.body);
    if (!body.success) {
      return reply.code(400).send({ error: "invalid_body" });
    }
    const token = await mintLiveKitToken({
      apiKey: env.LIVEKIT_API_KEY ?? "",
      apiSecret: env.LIVEKIT_API_SECRET ?? "",
      identity: body.data.identity,
      name: body.data.name,
      roomName: body.data.roomId,
      ttlSeconds: env.LIVEKIT_TOKEN_TTL_SECONDS,
    });
    return reply.send({ token, url: env.LIVEKIT_URL });
  });
}
