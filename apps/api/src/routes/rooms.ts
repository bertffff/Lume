import { createRoomSchema, joinRoomSchema } from "@lume/contracts";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { allowsModeration, slowModeAllows, tempMuteExpiry } from "@lume/contracts";
import type { PrismaClient } from "@lume/db";
import { banBlocksJoin } from "../access/gates.js";
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
    if (prisma) {
      const room = await prisma.room.findUnique({ where: { slug: body.data.code.trim().toLowerCase() } });
      if (room) {
        const bans = await prisma.ban.findMany({ where: { userId: actor.userId, liftedAt: null } });
        if (banBlocksJoin(bans, room, new Date())) {
          return reply.code(403).send({ error: "banned" });
        }
        const muted = await prisma.roomMember.findUnique({
          where: { roomId_userId: { roomId: room.id, userId: actor.userId } },
        });
        if (muted?.mutedUntil && muted.mutedUntil.getTime() > Date.now()) {
          return reply.code(403).send({ error: "muted" });
        }
      }
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
    if (prisma) {
      const room = await prisma.room.findUnique({ where: { id: params.data.id } });
      const member = await prisma.roomMember.findUnique({
        where: { roomId_userId: { roomId: params.data.id, userId: actor.userId } },
      });
      if (member?.mutedUntil && member.mutedUntil.getTime() > Date.now()) {
        return reply.code(403).send({ error: "muted" });
      }
      if (room && member && member.role !== "host") {
        const previous = await prisma.message.findFirst({
          where: { roomId: room.id, userId: actor.userId, type: "text" },
          orderBy: { createdAt: "desc" },
        });
        if (!slowModeAllows(previous?.createdAt.getTime() ?? null, Date.now(), room.slowModeSeconds, false)) {
          return reply.code(429).send({ error: "slow_mode", seconds: room.slowModeSeconds });
        }
      }
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

  app.patch("/rooms/:id/permissions", async (request, reply) => {
    const actor = await requireUser(request, reply, env);
    if (!actor || !prisma) {
      if (actor) return reply.code(503).send({ error: "database_unconfigured" });
      return;
    }
    const params = z.object({ id: z.string() }).parse(request.params);
    const body = z.object({
      userId: z.string().min(1),
      overridden: z.boolean(),
      canChat: z.boolean(),
      canSpeak: z.boolean(),
      canControlVideo: z.boolean(),
      canAddToQueue: z.boolean(),
      canRemoveFromQueue: z.boolean(),
      canReorderQueue: z.boolean(),
    }).safeParse(request.body);
    if (!body.success) return reply.code(400).send({ error: "invalid_body" });
    const self = await prisma.roomMember.findUnique({ where: { roomId_userId: { roomId: params.id, userId: actor.userId } } });
    if (!self || !allowsModeration(self.role, "permissions") || self.leftAt) {
      return reply.code(403).send({ error: "forbidden" });
    }
    await prisma.roomMember.update({
      where: { roomId_userId: { roomId: params.id, userId: body.data.userId } },
      data: {
        permissionsOverridden: body.data.overridden,
        canChat: body.data.canChat,
        canSpeak: body.data.canSpeak,
        canControlVideo: body.data.canControlVideo,
        canAddToQueue: body.data.canAddToQueue,
        canRemoveFromQueue: body.data.canRemoveFromQueue,
        canReorderQueue: body.data.canReorderQueue,
      },
    });
    return reply.send({ ok: true });
  });

  app.get("/rooms/:id/permissions", async (request, reply) => {
    const actor = await requireUser(request, reply, env);
    if (!actor || !prisma) {
      if (actor) return reply.code(503).send({ error: "database_unconfigured" });
      return;
    }
    const params = z.object({ id: z.string() }).parse(request.params);
    const rows = await prisma.roomMember.findMany({
      where: { roomId: params.id, leftAt: null },
      include: { user: true },
    });
    return reply.send({
      members: rows.map((row) => ({
        userId: row.userId,
        displayName: row.user.displayName,
        role: row.role,
        mutedUntil: row.mutedUntil?.toISOString() ?? null,
        overridden: row.permissionsOverridden,
        canChat: row.canChat,
        canSpeak: row.canSpeak,
        canControlVideo: row.canControlVideo,
        canAddToQueue: row.canAddToQueue,
        canRemoveFromQueue: row.canRemoveFromQueue,
        canReorderQueue: row.canReorderQueue,
      })),
    });
  });

  app.post("/rooms/:id/temp-mute", async (request, reply) => {
    const actor = await requireUser(request, reply, env);
    if (!actor || !prisma) {
      if (actor) return reply.code(503).send({ error: "database_unconfigured" });
      return;
    }
    const params = z.object({ id: z.string() }).parse(request.params);
    const body = z.object({ userId: z.string().min(1), seconds: z.number().int() }).safeParse(request.body);
    if (!body.success) return reply.code(400).send({ error: "invalid_body" });
    const expiry = tempMuteExpiry(Date.now(), body.data.seconds);
    if (expiry === null) return reply.code(400).send({ error: "invalid_body" });
    const self = await prisma.roomMember.findUnique({ where: { roomId_userId: { roomId: params.id, userId: actor.userId } } });
    if (!self || !allowsModeration(self.role, "mute") || self.leftAt) {
      return reply.code(403).send({ error: "forbidden" });
    }
    await prisma.roomMember.update({
      where: { roomId_userId: { roomId: params.id, userId: body.data.userId } },
      data: { muted: true, mutedUntil: new Date(expiry) },
    });
    await prisma.moderationAction.create({
      data: { roomId: params.id, actorId: actor.userId, targetId: body.data.userId, action: "temp-mute", detail: String(body.data.seconds) },
    });
    return reply.send({ mutedUntil: new Date(expiry).toISOString() });
  });

  app.get("/rooms/:id/mod-log", async (request, reply) => {
    const actor = await requireUser(request, reply, env);
    if (!actor || !prisma) {
      if (actor) return reply.code(503).send({ error: "database_unconfigured" });
      return;
    }
    const params = z.object({ id: z.string() }).parse(request.params);
    const self = await prisma.roomMember.findUnique({ where: { roomId_userId: { roomId: params.id, userId: actor.userId } } });
    if (!self || !allowsModeration(self.role, "log")) return reply.code(403).send({ error: "forbidden" });
    const rows = await prisma.moderationAction.findMany({ where: { roomId: params.id }, orderBy: { createdAt: "desc" }, take: 100 });
    return reply.send({
      log: rows.map((row) => ({ id: row.id, action: row.action, targetId: row.targetId, detail: row.detail, createdAt: row.createdAt.toISOString() })),
    });
  });

  app.post("/rooms/:id/pin", async (request, reply) => {
    const actor = await requireUser(request, reply, env);
    if (!actor || !prisma) {
      if (actor) return reply.code(503).send({ error: "database_unconfigured" });
      return;
    }
    const params = z.object({ id: z.string() }).parse(request.params);
    const body = z.object({ messageId: z.string().min(1).nullable() }).safeParse(request.body);
    if (!body.success) return reply.code(400).send({ error: "invalid_body" });
    const self = await prisma.roomMember.findUnique({ where: { roomId_userId: { roomId: params.id, userId: actor.userId } } });
    if (!self || (self.role !== "host" && self.role !== "mod") || self.leftAt) {
      return reply.code(403).send({ error: "forbidden" });
    }
    await prisma.room.update({ where: { id: params.id }, data: { pinnedMessageId: body.data.messageId } });
    return reply.send({ pinnedMessageId: body.data.messageId });
  });

  app.get("/rooms/:id/history", async (request, reply) => {
    const actor = await requireUser(request, reply, env);
    if (!actor || !prisma) {
      if (actor) return reply.code(503).send({ error: "database_unconfigured" });
      return;
    }
    const params = z.object({ id: z.string() }).parse(request.params);
    const rows = await prisma.roomHistoryItem.findMany({ where: { roomId: params.id }, orderBy: { watchedAt: "desc" }, take: 50 });
    return reply.send({ history: rows });
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
