import { createRoomSchema, joinRoomSchema } from "@lume/contracts";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { PrismaClient } from "@lume/db";
import { trackStat } from "../account/awards.js";
import { requireUser } from "../auth/guard.js";
import type { ApiEnv } from "../env.js";
import { RoomService } from "../rooms/service.js";
import { RoomFailure } from "../rooms/types.js";

const kickSchema = z.object({ userId: z.string().min(1) });
const muteSchema = kickSchema.extend({ muted: z.boolean() });
const roleSchema = kickSchema.extend({ role: z.enum(["mod", "viewer"]) });

function statusFor(code: RoomFailure["code"]): number {
  switch (code) {
    case "not_found":
    case "empty_queue":
      return 404;
    case "forbidden":
    case "not_member":
    case "muted":
      return 403;
    case "room_full":
    case "conflict":
      return 409;
    case "invalid_media":
      return 400;
    default:
      return 400;
  }
}

async function run<T>(reply: { code: (status: number) => { send: (body: unknown) => unknown } }, work: () => Promise<T>) {
  try {
    return await work();
  } catch (error) {
    if (error instanceof RoomFailure) {
      return reply.code(statusFor(error.code)).send({ error: error.code });
    }
    throw error;
  }
}

export function registerRoomRoutes(
  app: FastifyInstance,
  env: ApiEnv,
  service: RoomService | null,
  prisma: PrismaClient | null = null,
): void {
  app.get("/rooms", async (_request, reply) => {
    if (!service) {
      return reply.code(503).send({ error: "database_unconfigured" });
    }
    return { rooms: await service.listPublic() };
  });

  app.post("/rooms", async (request, reply) => {
    const actor = await requireUser(request, reply, env);
    if (!actor) {
      return;
    }
    if (!service) {
      return reply.code(503).send({ error: "database_unconfigured" });
    }
    const body = createRoomSchema.safeParse(request.body);
    if (!body.success) {
      return reply.code(400).send({ error: "invalid_body" });
    }
    return run(reply, async () => {
      const created = await service.createRoom(
        { userId: actor.userId, displayName: actor.displayName },
        { title: body.data.title, ...(body.data.isPublic === undefined ? {} : { isPublic: body.data.isPublic }) },
      );
      if (prisma) {
        await trackStat(prisma, actor.userId, "roomsCreated", 1, env.TELEGRAM_BOT_TOKEN);
        await trackStat(prisma, actor.userId, "totalParties", 1, env.TELEGRAM_BOT_TOKEN);
      }
      return created;
    });
  });

  app.post("/rooms/join", async (request, reply) => {
    const actor = await requireUser(request, reply, env);
    if (!actor) {
      return;
    }
    if (!service) {
      return reply.code(503).send({ error: "database_unconfigured" });
    }
    const body = joinRoomSchema.safeParse(request.body);
    if (!body.success) {
      return reply.code(400).send({ error: "invalid_body" });
    }
    return run(reply, async () => {
      const joined = await service.joinByCode({ userId: actor.userId, displayName: actor.displayName }, body.data.code);
      if (prisma && joined.self.role !== "host") {
        await trackStat(prisma, actor.userId, "totalParties", 1, env.TELEGRAM_BOT_TOKEN);
      }
      return joined;
    });
  });

  app.get("/rooms/:id", async (request, reply) => {
    const actor = await requireUser(request, reply, env);
    if (!actor || !service) {
      if (actor && !service) {
        return reply.code(503).send({ error: "database_unconfigured" });
      }
      return;
    }
    const params = z.object({ id: z.string().min(1) }).safeParse(request.params);
    if (!params.success) {
      return reply.code(400).send({ error: "invalid_body" });
    }
    return run(reply, () => service.detailFor(actor.userId, params.data.id));
  });

  app.post("/rooms/:id/leave", async (request, reply) => {
    const actor = await requireUser(request, reply, env);
    if (!actor || !service) {
      if (actor && !service) {
        return reply.code(503).send({ error: "database_unconfigured" });
      }
      return;
    }
    const params = z.object({ id: z.string().min(1) }).safeParse(request.params);
    if (!params.success) {
      return reply.code(400).send({ error: "invalid_body" });
    }
    await run(reply, async () => {
      await service.leave({ userId: actor.userId, displayName: actor.displayName }, params.data.id);
      if (prisma) {
        const active = await prisma.roomMember.count({ where: { roomId: params.data.id, leftAt: null } });
        if (active === 0) {
          const room = await prisma.room.findUnique({
            where: { id: params.data.id },
            include: { queue: { orderBy: { position: "asc" } }, nowPlaying: true },
          });
          if (room) {
            const historyCount = await prisma.roomHistoryItem.count({ where: { roomId: room.id } });
            await prisma.user.update({
              where: { id: room.ownerId },
              data: {
                lastRoomSnapshot: {
                  title: room.title,
                  description: room.description ?? "",
                  isPublic: room.isPublic,
                  maxMembers: room.maxMembers,
                  videoUrl: room.nowPlaying?.url ?? null,
                  positionMs: 0,
                  queue: room.queue.map((item) => ({ url: item.url, title: item.title })),
                  historyCount,
                },
                lastRoomSnapshotAt: new Date(),
              },
            });
            await prisma.room.update({ where: { id: room.id }, data: { emptySince: new Date() } });
          }
        }
      }
      return { ok: true };
    });
  });

  app.post("/rooms/:id/kick", async (request, reply) => {
    await memberAction(request, reply, env, service, kickSchema, (actor, roomId, body) =>
      service!.kick(actor, roomId, body.userId),
    );
  });

  app.post("/rooms/:id/mute", async (request, reply) => {
    await memberAction(request, reply, env, service, muteSchema, (actor, roomId, body) =>
      service!.mute(actor, roomId, body.userId, body.muted),
    );
  });

  app.post("/rooms/:id/role", async (request, reply) => {
    await memberAction(request, reply, env, service, roleSchema, (actor, roomId, body) =>
      service!.setRole(actor, roomId, body.userId, body.role),
    );
  });

  app.post("/rooms/:id/messages", async (request, reply) => {
    const actor = await requireUser(request, reply, env);
    if (!actor || !service) {
      if (actor && !service) {
        return reply.code(503).send({ error: "database_unconfigured" });
      }
      return;
    }
    const params = z.object({ id: z.string().min(1) }).safeParse(request.params);
    const body = z
      .object({ body: z.string().trim().min(1).max(2000), replyToId: z.string().min(1).nullable().optional() })
      .safeParse(request.body);
    if (!params.success || !body.success) {
      return reply.code(400).send({ error: "invalid_body" });
    }
    return run(reply, async () => {
      const message = await service.sendMessage(
        { userId: actor.userId, displayName: actor.displayName },
        params.data.id,
        body.data.body,
        body.data.replyToId,
      );
      if (prisma) {
        await trackStat(prisma, actor.userId, "totalMessages", 1, env.TELEGRAM_BOT_TOKEN);
      }
      return message;
    });
  });

  app.post("/rooms/:id/reactions", async (request, reply) => {
    const actor = await requireUser(request, reply, env);
    if (!actor || !service) {
      if (actor && !service) {
        return reply.code(503).send({ error: "database_unconfigured" });
      }
      return;
    }
    const params = z.object({ id: z.string().min(1) }).safeParse(request.params);
    const body = z
      .object({ messageId: z.string().min(1), emoji: z.string().trim().min(1).max(16) })
      .safeParse(request.body);
    if (!params.success || !body.success) {
      return reply.code(400).send({ error: "invalid_body" });
    }
    return run(reply, async () => {
      const message = await service.react(
        { userId: actor.userId, displayName: actor.displayName },
        params.data.id,
        body.data.messageId,
        body.data.emoji,
      );
      if (prisma) {
        await trackStat(prisma, actor.userId, "totalReactions", 1, env.TELEGRAM_BOT_TOKEN);
      }
      return message;
    });
  });

  app.post("/rooms/:id/queue", async (request, reply) => {
    const actor = await requireUser(request, reply, env);
    if (!actor || !service) {
      if (actor && !service) {
        return reply.code(503).send({ error: "database_unconfigured" });
      }
      return;
    }
    const params = z.object({ id: z.string().min(1) }).safeParse(request.params);
    const body = z.object({ url: z.string().trim().min(1).max(2000) }).safeParse(request.body);
    if (!params.success || !body.success) {
      return reply.code(400).send({ error: "invalid_body" });
    }
    return run(reply, () =>
      service.addQueueItem({ userId: actor.userId, displayName: actor.displayName }, params.data.id, body.data.url),
    );
  });

  app.post("/rooms/:id/queue/next", async (request, reply) => {
    const actor = await requireUser(request, reply, env);
    if (!actor || !service) {
      if (actor && !service) {
        return reply.code(503).send({ error: "database_unconfigured" });
      }
      return;
    }
    const params = z.object({ id: z.string().min(1) }).safeParse(request.params);
    if (!params.success) {
      return reply.code(400).send({ error: "invalid_body" });
    }
    return run(reply, () => service.playNext({ userId: actor.userId, displayName: actor.displayName }, params.data.id));
  });
}

async function memberAction<T extends { userId: string }>(
  request: FastifyRequestLike,
  reply: FastifyReplyLike,
  env: ApiEnv,
  service: RoomService | null,
  schema: { safeParse: (input: unknown) => { success: true; data: T } | { success: false } },
  work: (actor: { userId: string; displayName: string }, roomId: string, body: T) => Promise<unknown>,
): Promise<unknown> {
  const actor = await requireUser(request as never, reply as never, env);
  if (!actor || !service) {
    if (actor && !service) {
      return reply.code(503).send({ error: "database_unconfigured" });
    }
    return;
  }
  const params = z.object({ id: z.string().min(1) }).safeParse(request.params);
  const body = schema.safeParse(request.body);
  if (!params.success || !body.success) {
    return reply.code(400).send({ error: "invalid_body" });
  }
  return run(reply, () => work({ userId: actor.userId, displayName: actor.displayName }, params.data.id, body.data));
}

interface FastifyRequestLike {
  headers: { authorization?: string };
  params: unknown;
  body: unknown;
}

interface FastifyReplyLike {
  code: (status: number) => { send: (body: unknown) => unknown };
}
