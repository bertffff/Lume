import { canActOnMember, canModerate } from "@lume/contracts";
import type { FastifyInstance, FastifyReply } from "fastify";
import { z } from "zod";
import { requireUser } from "../auth/guard.js";
import type { ApiEnv } from "../env.js";
import type { RoomService } from "../rooms/service.js";
import { RoomFailure } from "../rooms/types.js";
import { disconnectVoiceIdentity, muteVoiceIdentities } from "../voice/admin.js";
import { liveKitConfigured, liveKitRoomName, mintLiveKitToken } from "../voice/livekit.js";

const roomSchema = z.object({ roomId: z.string().min(1).max(80) });
const targetSchema = roomSchema.extend({ userId: z.string().min(1) });

async function guardRoom(service: RoomService, userId: string, roomId: string, reply: FastifyReply) {
  try {
    return await service.detailFor(userId, roomId);
  } catch (error) {
    if (error instanceof RoomFailure) {
      await reply.code(error.code === "not_member" ? 403 : 404).send({ error: error.code });
      return null;
    }
    throw error;
  }
}

export function registerVoiceRoutes(app: FastifyInstance, env: ApiEnv, service: RoomService | null): void {
  app.get("/voice/livekit", async () => ({ enabled: liveKitConfigured(env), stub: env.ALLOW_STUB_VOICE }));

  app.post("/voice/livekit/token", async (request, reply) => {
    if (!liveKitConfigured(env)) {
      return reply.code(503).send({ error: "livekit_disabled" });
    }
    const actor = await requireUser(request, reply, env);
    if (!actor) {
      return;
    }
    if (!service) {
      return reply.code(503).send({ error: "database_unconfigured" });
    }
    const body = roomSchema.safeParse(request.body);
    if (!body.success) {
      return reply.code(400).send({ error: "invalid_body" });
    }
    const detail = await guardRoom(service, actor.userId, body.data.roomId, reply);
    if (!detail) {
      return;
    }
    if (detail.self.role !== "host" && detail.self.permissions.canSpeak === false) {
      return reply.code(403).send({ error: "forbidden" });
    }
    const token = await mintLiveKitToken({
      apiKey: env.LIVEKIT_API_KEY ?? "",
      apiSecret: env.LIVEKIT_API_SECRET ?? "",
      identity: actor.userId,
      name: actor.displayName,
      roomName: liveKitRoomName(body.data.roomId),
      ttlSeconds: env.LIVEKIT_TOKEN_TTL_SECONDS,
    });
    return reply.send({ token, url: env.LIVEKIT_URL });
  });

  app.post("/voice/livekit/mute", async (request, reply) => {
    const acted = await moderate(request, reply, env, service, roomSchema.extend({ userId: z.string().min(1).optional() }));
    if (!acted) {
      return;
    }
    const identities = acted.userId ? [acted.userId] : acted.others;
    await muteVoiceIdentities(
      {
        LIVEKIT_URL: env.LIVEKIT_URL ?? "",
        LIVEKIT_API_KEY: env.LIVEKIT_API_KEY ?? "",
        LIVEKIT_API_SECRET: env.LIVEKIT_API_SECRET ?? "",
      },
      acted.roomId,
      identities,
    );
    return reply.send({ muted: identities });
  });

  app.post("/voice/livekit/disconnect", async (request, reply) => {
    const acted = await moderate(request, reply, env, service, targetSchema);
    if (!acted || !acted.userId) {
      return;
    }
    await disconnectVoiceIdentity(
      {
        LIVEKIT_URL: env.LIVEKIT_URL ?? "",
        LIVEKIT_API_KEY: env.LIVEKIT_API_KEY ?? "",
        LIVEKIT_API_SECRET: env.LIVEKIT_API_SECRET ?? "",
      },
      acted.roomId,
      acted.userId,
    );
    return reply.send({ disconnected: acted.userId });
  });
}

async function moderate(
  request: { headers: { authorization?: string }; body: unknown },
  reply: FastifyReply,
  env: ApiEnv,
  service: RoomService | null,
  schema: { safeParse: (body: unknown) => { success: true; data: { roomId: string; userId?: string } } | { success: false } },
): Promise<{ roomId: string; userId?: string; others: string[] } | null> {
  if (!liveKitConfigured(env)) {
    await reply.code(503).send({ error: "livekit_disabled" });
    return null;
  }
  const actor = await requireUser(request as never, reply, env);
  if (!actor) {
    return null;
  }
  if (!service) {
    await reply.code(503).send({ error: "database_unconfigured" });
    return null;
  }
  const body = schema.safeParse(request.body);
  if (!body.success) {
    await reply.code(400).send({ error: "invalid_body" });
    return null;
  }
  const detail = await guardRoom(service, actor.userId, body.data.roomId, reply);
  if (!detail) {
    return null;
  }
  if (!canModerate(detail.self.role)) {
    await reply.code(403).send({ error: "forbidden" });
    return null;
  }
  if (body.data.userId) {
    const target = detail.members.find((member) => member.userId === body.data.userId);
    if (!target || !canActOnMember(detail.self.role, target.role)) {
      await reply.code(403).send({ error: "forbidden" });
      return null;
    }
    return { roomId: body.data.roomId, userId: body.data.userId, others: [body.data.userId] };
  }
  const others = detail.members
    .filter((member) => member.userId !== actor.userId && canActOnMember(detail.self.role, member.role))
    .map((member) => member.userId);
  return { roomId: body.data.roomId, others };
}
