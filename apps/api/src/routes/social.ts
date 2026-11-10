import {
  allowHit,
  decideFriendRequest,
  levelFromXp,
  passwordIssue,
  resumeCard,
  tempMuteExpiry,
  type RateBucket,
  type ResumeSnapshot,
} from "@lume/contracts";
import type { PrismaClient } from "@lume/db";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { exportZip } from "../account/archive.js";
import { awardNew, seedPartyAchievements } from "../account/awards.js";
import { emailStub, notifyUser, pushStub } from "../account/notify.js";
import { hashPassword, verifyPassword } from "../account/passwords.js";
import { mintAccessToken } from "../auth/jwt.js";
import { requireUser } from "../auth/guard.js";
import type { ApiEnv } from "../env.js";
import type { RoomService } from "../rooms/service.js";

const searches = new Map<string, RateBucket>();
const logins = new Map<string, RateBucket>();
const reports = new Map<string, RateBucket>();

function hourInZone(timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", hourCycle: "h23" }).formatToParts(new Date());
  return Number(parts.find((part) => part.type === "hour")?.value ?? "0");
}

async function audit(prisma: PrismaClient, actorId: string, action: string, subjectKind: string, subjectId: string, detail?: string) {
  await prisma.auditLog.create({ data: { actorId, action, subjectKind, subjectId, ...(detail ? { detail } : {}) } });
}

export async function prepareSocial(prisma: PrismaClient): Promise<void> {
  await seedPartyAchievements(prisma);
}

export function registerSocialRoutes(
  app: FastifyInstance,
  env: ApiEnv,
  prisma: PrismaClient | null,
  service: RoomService | null,
): void {
  app.post("/auth/register", async (request, reply) => {
    if (!prisma || !env.JWT_SECRET) {
      return reply.code(503).send({ error: "database_unconfigured" });
    }
    const body = z.object({
      email: z.string().email(),
      password: z.string(),
      displayName: z.string().trim().min(1).max(100),
    }).safeParse(request.body);
    if (!body.success) {
      return reply.code(400).send({ error: "invalid_body" });
    }
    const issue = passwordIssue(body.data.password);
    if (issue) {
      return reply.code(400).send({ error: issue === "shape" ? "password_shape" : "password_length" });
    }
    const email = body.data.email.toLowerCase();
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return reply.code(409).send({ error: "Пользователь с таким email уже существует" });
    }
    const user = await prisma.user.create({
      data: { email, passwordHash: await hashPassword(body.data.password), displayName: body.data.displayName, username: `mail:${email}` },
    });
    const accessToken = await mintAccessToken({
      secret: env.JWT_SECRET,
      userId: user.id,
      telegramId: null,
      displayName: user.displayName,
      ttlSeconds: env.JWT_TTL_SECONDS,
    });
    return reply.send({ accessToken, user: { id: user.id, displayName: user.displayName, email } });
  });

  app.post("/auth/login", async (request, reply) => {
    if (!prisma || !env.JWT_SECRET) {
      return reply.code(503).send({ error: "database_unconfigured" });
    }
    const body = z.object({ email: z.string().email(), password: z.string() }).safeParse(request.body);
    if (!body.success) {
      return reply.code(400).send({ error: "invalid_body" });
    }
    const key = body.data.email.toLowerCase();
    const decision = allowHit(logins.get(key) ?? { hits: [] }, Date.now(), 20, 15 * 60_000);
    logins.set(key, decision.bucket);
    if (!decision.ok) return reply.code(429).send({ error: "rate_limited" });
    const user = await prisma.user.findUnique({ where: { email: body.data.email.toLowerCase() } });
    if (!user?.passwordHash || !(await verifyPassword(body.data.password, user.passwordHash))) {
      return reply.code(401).send({ error: "Неверный email или пароль" });
    }
    if (user.deletedAt && user.scheduledDeletionAt && user.scheduledDeletionAt.getTime() <= Date.now()) {
      return reply.code(401).send({ error: "Неверный email или пароль" });
    }
    const accessToken = await mintAccessToken({
      secret: env.JWT_SECRET,
      userId: user.id,
      telegramId: user.telegramId?.toString() ?? null,
      displayName: user.displayName,
      ttlSeconds: env.JWT_TTL_SECONDS,
    });
    return reply.send({
      accessToken,
      user: { id: user.id, displayName: user.displayName, email: user.email },
      deletionScheduled: Boolean(user.deletedAt),
    });
  });

  app.get("/me", async (request, reply) => {
    const actor = await requireUser(request, reply, env);
    if (!actor || !prisma) {
      if (actor && !prisma) return reply.code(503).send({ error: "database_unconfigured" });
      return;
    }
    return reply.send(await profileOf(prisma, actor.userId, true));
  });

  app.patch("/me", async (request, reply) => {
    const actor = await requireUser(request, reply, env);
    if (!actor || !prisma) {
      if (actor && !prisma) return reply.code(503).send({ error: "database_unconfigured" });
      return;
    }
    const body = z.object({
      bio: z.string().max(100).nullable().optional(),
      avatarUrl: z.string().url().nullable().optional(),
      themeId: z.enum(["ember", "aurora"]).optional(),
      locale: z.enum(["ru", "en"]).optional(),
      displayName: z.string().trim().min(1).max(100).optional(),
      timezone: z.string().min(1).max(80).optional(),
      hideOtherReactions: z.boolean().optional(),
      onboardingComplete: z.boolean().optional(),
      isFriendsPublic: z.boolean().optional(),
      isWatchHistoryPublic: z.boolean().optional(),
    }).safeParse(request.body);
    if (!body.success) {
      return reply.code(400).send({ error: "invalid_body" });
    }
    if (body.data.themeId === "aurora") {
      const entitlement = await prisma.entitlement.findUnique({ where: { userId_sku: { userId: actor.userId, sku: "theme.aurora" } } });
      if (!entitlement?.active) {
        return reply.code(403).send({ error: "theme_locked" });
      }
    }
    await prisma.user.update({ where: { id: actor.userId }, data: body.data });
    return reply.send(await profileOf(prisma, actor.userId, true));
  });

  app.get("/users/search", async (request, reply) => {
    const actor = await requireUser(request, reply, env);
    if (!actor || !prisma) {
      if (actor && !prisma) return reply.code(503).send({ error: "database_unconfigured" });
      return;
    }
    const query = z.object({ q: z.string().trim().min(1).max(80) }).safeParse(request.query);
    if (!query.success) {
      return reply.code(400).send({ error: "invalid_body" });
    }
    const decision = allowHit(searches.get(actor.userId) ?? { hits: [] }, Date.now(), 20, 60_000);
    searches.set(actor.userId, decision.bucket);
    if (!decision.ok) {
      return reply.code(429).send({ error: "rate_limited" });
    }
    const users = await prisma.user.findMany({
      where: { deletedAt: null, displayName: { contains: query.data.q, mode: "insensitive" }, NOT: { id: actor.userId } },
      take: 10,
      select: { id: true, displayName: true, avatarUrl: true, username: true, showUsername: true },
    });
    return reply.send({
      users: users.map((user) => ({
        id: user.id,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
        username: user.showUsername ? user.username : null,
      })),
    });
  });

  app.get("/users/:id", async (request, reply) => {
    const params = z.object({ id: z.string() }).parse(request.params);
    if (!prisma) return reply.code(503).send({ error: "database_unconfigured" });
    const user = await prisma.user.findFirst({ where: { id: params.id, deletedAt: null } });
    if (!user) return reply.code(404).send({ error: "not_found" });
    const seat = await prisma.roomMember.findFirst({
      where: { userId: user.id, leftAt: null },
      include: { room: true },
      orderBy: { joinedAt: "desc" },
    });
    return reply.send({
      id: user.id,
      displayName: user.displayName,
      bio: user.bio,
      avatarUrl: user.avatarUrl,
      roomId: seat && seat.room.status !== "ended" ? seat.roomId : null,
      roomTitle: seat && seat.room.status !== "ended" ? seat.room.title : null,
    });
  });

  app.get("/friends", async (request, reply) => {
    const actor = await requireUser(request, reply, env);
    if (!actor || !prisma) {
      if (actor && !prisma) return reply.code(503).send({ error: "database_unconfigured" });
      return;
    }
    const rows = await prisma.friendship.findMany({
      where: { OR: [{ requesterId: actor.userId }, { addresseeId: actor.userId }] },
      include: { requester: true, addressee: true },
    });
    const mapRow = async (row: (typeof rows)[number]) => {
      const other = row.requesterId === actor.userId ? row.addressee : row.requester;
      const seat = await prisma.roomMember.findFirst({
        where: { userId: other.id, leftAt: null },
        include: { room: true },
        orderBy: { joinedAt: "desc" },
      });
      return {
        id: row.id,
        status: row.status,
        userId: other.id,
        displayName: other.displayName,
        roomId: seat && seat.room.status !== "ended" ? seat.roomId : null,
        roomTitle: seat && seat.room.status !== "ended" ? seat.room.title : null,
      };
    };
    return reply.send({
      friends: await Promise.all(rows.filter((row) => row.status === "accepted").map(mapRow)),
      incoming: await Promise.all(rows.filter((row) => row.status === "pending" && row.addresseeId === actor.userId).map(mapRow)),
      outgoing: await Promise.all(rows.filter((row) => row.status === "pending" && row.requesterId === actor.userId).map(mapRow)),
      blocked: await Promise.all(rows.filter((row) => row.status === "blocked" && row.requesterId === actor.userId).map(mapRow)),
    });
  });

  app.post("/friends/request", async (request, reply) => {
    const actor = await requireUser(request, reply, env);
    if (!actor || !prisma) {
      if (actor && !prisma) return reply.code(503).send({ error: "database_unconfigured" });
      return;
    }
    const body = z.object({ userId: z.string().min(1) }).safeParse(request.body);
    if (!body.success) return reply.code(400).send({ error: "invalid_body" });
    const target = await prisma.user.findFirst({ where: { id: body.data.userId, deletedAt: null } });
    if (!target) return reply.code(404).send({ error: "not_found" });
    const edges = await prisma.friendship.findMany({
      where: { OR: [{ requesterId: actor.userId, addresseeId: target.id }, { requesterId: target.id, addresseeId: actor.userId }] },
    });
    const decision = decideFriendRequest(actor.userId, target.id, edges);
    if (decision.action === "reject") return reply.code(403).send({ error: decision.reason });
    if (decision.action === "accept") {
      await prisma.friendship.update({ where: { id: decision.id }, data: { status: "accepted" } });
      await notifyUser(prisma, { userId: target.id, kind: "FRIEND_ACCEPTED", title: "Дружба подтверждена", body: actor.displayName, ...(env.TELEGRAM_BOT_TOKEN ? { telegramToken: env.TELEGRAM_BOT_TOKEN } : {}) });
      return reply.send({ status: "accepted" });
    }
    if (decision.action === "create") {
      await prisma.friendship.create({ data: { requesterId: actor.userId, addresseeId: target.id, status: "pending" } });
      await notifyUser(prisma, { userId: target.id, kind: "FRIEND_REQUEST", title: "Заявка в друзья", body: actor.displayName, ...(env.TELEGRAM_BOT_TOKEN ? { telegramToken: env.TELEGRAM_BOT_TOKEN } : {}) });
    }
    return reply.send({ status: decision.action === "create" ? "pending" : "accepted" });
  });

  app.post("/friends/:id/accept", async (request, reply) => {
    const actor = await requireUser(request, reply, env);
    if (!actor || !prisma) {
      if (actor && !prisma) return reply.code(503).send({ error: "database_unconfigured" });
      return;
    }
    const params = z.object({ id: z.string() }).parse(request.params);
    const row = await prisma.friendship.findUnique({ where: { id: params.id } });
    if (!row || row.addresseeId !== actor.userId || row.status !== "pending") {
      return reply.code(404).send({ error: "not_found" });
    }
    await prisma.friendship.update({ where: { id: row.id }, data: { status: "accepted" } });
    await prisma.user.update({ where: { id: actor.userId }, data: { totalParties: { increment: 0 } } });
    await awardNew(prisma, actor.userId, hourInZone("UTC"), env.TELEGRAM_BOT_TOKEN);
    await notifyUser(prisma, { userId: row.requesterId, kind: "FRIEND_ACCEPTED", title: "Заявку приняли", body: actor.displayName, ...(env.TELEGRAM_BOT_TOKEN ? { telegramToken: env.TELEGRAM_BOT_TOKEN } : {}) });
    return reply.send({ status: "accepted" });
  });

  app.post("/friends/:id/decline", async (request, reply) => {
    const actor = await requireUser(request, reply, env);
    if (!actor || !prisma) {
      if (actor && !prisma) return reply.code(503).send({ error: "database_unconfigured" });
      return;
    }
    const params = z.object({ id: z.string() }).parse(request.params);
    const row = await prisma.friendship.findUnique({ where: { id: params.id } });
    if (!row || row.addresseeId !== actor.userId || row.status !== "pending") {
      return reply.code(404).send({ error: "not_found" });
    }
    await prisma.friendship.delete({ where: { id: row.id } });
    return reply.send({ ok: true });
  });

  app.delete("/friends/:id", async (request, reply) => {
    const actor = await requireUser(request, reply, env);
    if (!actor || !prisma) {
      if (actor && !prisma) return reply.code(503).send({ error: "database_unconfigured" });
      return;
    }
    const params = z.object({ id: z.string() }).parse(request.params);
    const row = await prisma.friendship.findUnique({ where: { id: params.id } });
    if (!row || (row.requesterId !== actor.userId && row.addresseeId !== actor.userId)) {
      return reply.code(404).send({ error: "not_found" });
    }
    await prisma.friendship.delete({ where: { id: row.id } });
    return reply.send({ ok: true });
  });

  app.post("/friends/block", async (request, reply) => {
    const actor = await requireUser(request, reply, env);
    if (!actor || !prisma) {
      if (actor && !prisma) return reply.code(503).send({ error: "database_unconfigured" });
      return;
    }
    const body = z.object({ userId: z.string().min(1) }).safeParse(request.body);
    if (!body.success) return reply.code(400).send({ error: "invalid_body" });
    await prisma.friendship.deleteMany({
      where: { OR: [{ requesterId: actor.userId, addresseeId: body.data.userId }, { requesterId: body.data.userId, addresseeId: actor.userId }] },
    });
    await prisma.friendship.create({ data: { requesterId: actor.userId, addresseeId: body.data.userId, status: "blocked" } });
    return reply.send({ status: "blocked" });
  });

  app.get("/notifications", async (request, reply) => {
    const actor = await requireUser(request, reply, env);
    if (!actor || !prisma) {
      if (actor && !prisma) return reply.code(503).send({ error: "database_unconfigured" });
      return;
    }
    const items = await prisma.notification.findMany({ where: { userId: actor.userId }, orderBy: { createdAt: "desc" }, take: 50 });
    return reply.send({
      unread: items.filter((item) => item.readAt === null).length,
      notifications: items.map((item) => ({ id: item.id, kind: item.kind, title: item.title, body: item.body, read: item.readAt !== null, createdAt: item.createdAt.toISOString() })),
    });
  });

  app.post("/notifications/:id/read", async (request, reply) => {
    const actor = await requireUser(request, reply, env);
    if (!actor || !prisma) {
      if (actor && !prisma) return reply.code(503).send({ error: "database_unconfigured" });
      return;
    }
    const params = z.object({ id: z.string() }).parse(request.params);
    await prisma.notification.updateMany({ where: { id: params.id, userId: actor.userId }, data: { readAt: new Date() } });
    return reply.send({ ok: true });
  });

  app.put("/me/notification-preferences", async (request, reply) => {
    const actor = await requireUser(request, reply, env);
    if (!actor || !prisma) {
      if (actor && !prisma) return reply.code(503).send({ error: "database_unconfigured" });
      return;
    }
    const body = z.object({
      channel: z.enum(["web", "telegram", "email", "push"]),
      kind: z.string().min(1),
      enabled: z.boolean(),
      digest: z.enum(["INSTANT", "HOURLY", "DAILY"]).optional(),
      quietHoursEnabled: z.boolean().optional(),
      quietStart: z.string().regex(/^\d{2}:\d{2}$/).optional(),
      quietEnd: z.string().regex(/^\d{2}:\d{2}$/).optional(),
      timezone: z.string().min(1).optional(),
    }).safeParse(request.body);
    if (!body.success) return reply.code(400).send({ error: "invalid_body" });
    await prisma.notificationPreference.upsert({
      where: { userId_channel_kind: { userId: actor.userId, channel: body.data.channel, kind: body.data.kind } },
      update: { enabled: body.data.enabled },
      create: { userId: actor.userId, channel: body.data.channel, kind: body.data.kind, enabled: body.data.enabled },
    });
    if (body.data.digest || body.data.quietHoursEnabled !== undefined || body.data.timezone) {
      await prisma.notificationDeliveryPreference.upsert({
        where: { userId: actor.userId },
        update: {
          ...(body.data.digest ? { digest: body.data.digest } : {}),
          ...(body.data.quietHoursEnabled !== undefined ? { quietHoursEnabled: body.data.quietHoursEnabled } : {}),
          ...(body.data.quietStart ? { quietStart: body.data.quietStart } : {}),
          ...(body.data.quietEnd ? { quietEnd: body.data.quietEnd } : {}),
          ...(body.data.timezone ? { timezone: body.data.timezone } : {}),
        },
        create: {
          userId: actor.userId,
          digest: body.data.digest ?? "INSTANT",
          quietHoursEnabled: body.data.quietHoursEnabled ?? false,
          quietStart: body.data.quietStart ?? "22:00",
          quietEnd: body.data.quietEnd ?? "08:00",
          timezone: body.data.timezone ?? "UTC",
        },
      });
    }
    return reply.send({ ok: true, email: emailStub(), push: pushStub() });
  });

  app.get("/notifications/digest-preview", async (request, reply) => {
    const actor = await requireUser(request, reply, env);
    if (!actor || !prisma) {
      if (actor && !prisma) return reply.code(503).send({ error: "database_unconfigured" });
      return;
    }
    const queued = await prisma.notificationDeliveryQueue.findMany({ where: { userId: actor.userId, status: "pending" }, take: 20 });
    return reply.send({ count: queued.length, channels: ["web", "telegram", "email", "push"] });
  });

  app.post("/reports", async (request, reply) => {
    const actor = await requireUser(request, reply, env);
    if (!actor || !prisma) {
      if (actor && !prisma) return reply.code(503).send({ error: "database_unconfigured" });
      return;
    }
    const decision = allowHit(reports.get(actor.userId) ?? { hits: [] }, Date.now(), 5, 60 * 60 * 1000);
    reports.set(actor.userId, decision.bucket);
    if (!decision.ok) return reply.code(429).send({ error: "rate_limited" });
    const body = z.object({
      targetKind: z.enum(["user", "message", "room"]),
      targetId: z.string().min(1),
      roomId: z.string().min(1).optional(),
      reason: z.string().trim().min(1).max(500),
      details: z.string().max(2000).optional(),
    }).safeParse(request.body);
    if (!body.success) return reply.code(400).send({ error: "invalid_body" });
    const report = await prisma.report.create({
      data: {
        reporterId: actor.userId,
        targetKind: body.data.targetKind,
        targetId: body.data.targetId,
        reason: body.data.reason,
        ...(body.data.details ? { details: body.data.details } : {}),
        ...(body.data.roomId ? { roomId: body.data.roomId } : {}),
        ...(body.data.targetKind === "user" ? { targetUserId: body.data.targetId } : {}),
      },
    });
    await audit(prisma, actor.userId, "report:create", body.data.targetKind, body.data.targetId);
    return reply.send({ id: report.id });
  });

  app.post("/rooms/:id/ban", async (request, reply) => {
    const actor = await requireUser(request, reply, env);
    if (!actor || !prisma || !service) {
      if (actor) return reply.code(503).send({ error: "database_unconfigured" });
      return;
    }
    const params = z.object({ id: z.string() }).parse(request.params);
    const body = z.object({
      userId: z.string().min(1),
      type: z.enum(["session", "permanent", "blacklist"]),
      reason: z.string().max(500).optional(),
      seconds: z.number().int().optional(),
    }).safeParse(request.body);
    if (!body.success) return reply.code(400).send({ error: "invalid_body" });
    const detail = await service.detailFor(actor.userId, params.id).catch(() => null);
    if (!detail || detail.self.role !== "host") return reply.code(403).send({ error: "forbidden" });
    const expiresAt = body.data.type === "session" && body.data.seconds ? new Date(tempMuteExpiry(Date.now(), Math.min(Math.max(body.data.seconds, 30), 86400)) ?? Date.now()) : null;
    const room = await prisma.room.findUnique({ where: { id: params.id } });
    if (!room) return reply.code(404).send({ error: "not_found" });
    await prisma.ban.create({
      data: {
        type: body.data.type,
        userId: body.data.userId,
        ownerId: room.ownerId,
        ...(body.data.type === "blacklist" ? {} : { roomId: room.id }),
        ...(body.data.reason ? { reason: body.data.reason } : {}),
        ...(expiresAt ? { expiresAt } : {}),
      },
    });
    await prisma.moderationAction.create({
      data: { roomId: room.id, actorId: actor.userId, targetId: body.data.userId, action: `ban:${body.data.type}`, detail: body.data.reason ?? null },
    });
    await service.kick({ userId: actor.userId, displayName: actor.displayName }, room.id, body.data.userId).catch(() => undefined);
    return reply.send({ ok: true });
  });

  app.post("/rooms/:id/slow-mode", async (request, reply) => {
    const actor = await requireUser(request, reply, env);
    if (!actor || !prisma) {
      if (actor) return reply.code(503).send({ error: "database_unconfigured" });
      return;
    }
    const params = z.object({ id: z.string() }).parse(request.params);
    const body = z.object({ seconds: z.number().int().min(0).max(300) }).safeParse(request.body);
    if (!body.success) return reply.code(400).send({ error: "invalid_body" });
    const member = await prisma.roomMember.findUnique({ where: { roomId_userId: { roomId: params.id, userId: actor.userId } } });
    if (!member || (member.role !== "host" && member.role !== "mod") || member.leftAt) {
      return reply.code(403).send({ error: "forbidden" });
    }
    await prisma.room.update({ where: { id: params.id }, data: { slowModeSeconds: body.data.seconds } });
    await prisma.moderationAction.create({
      data: { roomId: params.id, actorId: actor.userId, action: "slow-mode", detail: String(body.data.seconds) },
    });
    return reply.send({ seconds: body.data.seconds });
  });

  app.get("/me/resume", async (request, reply) => {
    const actor = await requireUser(request, reply, env);
    if (!actor || !prisma) {
      if (actor) return reply.code(503).send({ error: "database_unconfigured" });
      return;
    }
    const user = await prisma.user.findUnique({ where: { id: actor.userId } });
    const snapshot = (user?.lastRoomSnapshot ?? null) as ResumeSnapshot | null;
    return reply.send({ resume: resumeCard(snapshot) });
  });

  app.post("/me/export", async (request, reply) => {
    const actor = await requireUser(request, reply, env);
    if (!actor || !prisma) {
      if (actor) return reply.code(503).send({ error: "database_unconfigured" });
      return;
    }
    const profile = await profileOf(prisma, actor.userId, true);
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const row = await prisma.dataExportRequest.create({
      data: { userId: actor.userId, status: "ready", expiresAt, result: profile as object },
    });
    return reply.send({ id: row.id, token: row.downloadToken, expiresAt: expiresAt.toISOString() });
  });

  app.get("/me/export/:token", async (request, reply) => {
    if (!prisma) return reply.code(503).send({ error: "database_unconfigured" });
    const params = z.object({ token: z.string() }).parse(request.params);
    const row = await prisma.dataExportRequest.findUnique({ where: { downloadToken: params.token } });
    if (!row) return reply.code(404).send({ error: "not_found" });
    if (row.expiresAt.getTime() < Date.now()) return reply.code(410).send({ error: "expired" });
    const zip = exportZip({
      "README.txt": "TeleRave export. The link expires 24 hours after it was created.\n",
      "profile.json": JSON.stringify({ exportedAt: row.createdAt.toISOString(), data: row.result }, null, 2),
    });
    return reply.type("application/zip").header("content-disposition", "attachment; filename=lume-export.zip").send(Buffer.from(zip));
  });

  app.post("/me/delete", async (request, reply) => {
    const actor = await requireUser(request, reply, env);
    if (!actor || !prisma) {
      if (actor) return reply.code(503).send({ error: "database_unconfigured" });
      return;
    }
    const body = z.object({ confirmation: z.literal("DELETE") }).safeParse(request.body);
    if (!body.success) return reply.code(400).send({ error: "invalid_body" });
    const when = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    await prisma.user.update({
      where: { id: actor.userId },
      data: { deletedAt: new Date(), scheduledDeletionAt: when, bio: null, avatarUrl: null, displayName: "Удалён" },
    });
    return reply.send({ scheduledDeletionAt: when.toISOString() });
  });

  app.post("/me/restore", async (request, reply) => {
    const actor = await requireUser(request, reply, env);
    if (!actor || !prisma) {
      if (actor) return reply.code(503).send({ error: "database_unconfigured" });
      return;
    }
    const user = await prisma.user.findUnique({ where: { id: actor.userId } });
    if (!user?.scheduledDeletionAt || user.scheduledDeletionAt.getTime() <= Date.now()) {
      return reply.code(409).send({ error: "not_restorable" });
    }
    await prisma.user.update({ where: { id: user.id }, data: { deletedAt: null, scheduledDeletionAt: null } });
    return reply.send({ ok: true });
  });

  app.get("/admin/overview", async (request, reply) => {
    const actor = await requireAdmin(request, reply, env, prisma);
    if (!actor || !prisma) return;
    const [users, rooms, reportsOpen] = await Promise.all([
      prisma.user.count(),
      prisma.room.count({ where: { status: { not: "ended" } } }),
      prisma.report.count({ where: { status: "open" } }),
    ]);
    return reply.send({ users, rooms, reportsOpen });
  });

  app.get("/admin/users", async (request, reply) => {
    const actor = await requireAdmin(request, reply, env, prisma);
    if (!actor || !prisma) return;
    const query = z.object({ q: z.string().optional(), page: z.coerce.number().int().min(0).default(0), role: z.string().optional() }).parse(request.query);
    const where = {
      ...(query.q ? { displayName: { contains: query.q, mode: "insensitive" as const } } : {}),
      ...(query.role ? { role: query.role as "USER" | "ADMIN" | "SUPERADMIN" } : {}),
    };
    const take = 20;
    const [total, users] = await Promise.all([
      prisma.user.count({ where }),
      prisma.user.findMany({
        where,
        skip: query.page * take,
        take,
        orderBy: { createdAt: "desc" },
        select: { id: true, displayName: true, email: true, role: true, deletedAt: true, isPremium: true },
      }),
    ]);
    return reply.send({ users, page: query.page, pages: Math.max(1, Math.ceil(total / take)) });
  });

  app.get("/admin/rooms", async (request, reply) => {
    const actor = await requireAdmin(request, reply, env, prisma);
    if (!actor || !prisma) return;
    const query = z.object({ q: z.string().optional(), page: z.coerce.number().int().min(0).default(0), status: z.string().optional() }).parse(request.query);
    const where = {
      ...(query.q ? { title: { contains: query.q, mode: "insensitive" as const } } : {}),
      ...(query.status ? { status: query.status as "open" | "live" | "ended" } : {}),
    };
    const take = 20;
    const [total, rooms] = await Promise.all([
      prisma.room.count({ where }),
      prisma.room.findMany({ where, skip: query.page * take, take, orderBy: { createdAt: "desc" }, select: { id: true, slug: true, title: true, status: true, hostId: true } }),
    ]);
    return reply.send({ rooms, page: query.page, pages: Math.max(1, Math.ceil(total / take)) });
  });

  app.post("/admin/rooms/:id/close", async (request, reply) => {
    const actor = await requireAdmin(request, reply, env, prisma);
    if (!actor || !prisma) return;
    const params = z.object({ id: z.string() }).parse(request.params);
    const room = await prisma.room.update({ where: { id: params.id }, data: { status: "ended" } });
    await audit(prisma, actor.userId, "room:force-close", "room", room.id, room.title);
    await fetch(`${env.REALTIME_URL}/internal/close`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ roomId: room.id }),
    }).catch(() => undefined);
    return reply.send({ ok: true });
  });

  app.get("/admin/reports", async (request, reply) => {
    const actor = await requireAdmin(request, reply, env, prisma);
    if (!actor || !prisma) return;
    const query = z.object({ status: z.string().default("open"), page: z.coerce.number().int().min(0).default(0) }).parse(request.query);
    const where = { status: query.status };
    const take = 20;
    const [total, items] = await Promise.all([
      prisma.report.count({ where }),
      prisma.report.findMany({ where, skip: query.page * take, take, orderBy: { createdAt: "desc" } }),
    ]);
    return reply.send({ reports: items, page: query.page, pages: Math.max(1, Math.ceil(total / take)) });
  });

  app.post("/admin/reports/:id", async (request, reply) => {
    const actor = await requireAdmin(request, reply, env, prisma);
    if (!actor || !prisma) return;
    const params = z.object({ id: z.string() }).parse(request.params);
    const body = z.object({ status: z.enum(["reviewed", "dismissed"]), resolution: z.string().max(500).optional() }).safeParse(request.body);
    if (!body.success) return reply.code(400).send({ error: "invalid_body" });
    await prisma.report.update({
      where: { id: params.id },
      data: { status: body.data.status, resolvedAt: new Date(), resolvedById: actor.userId, ...(body.data.resolution ? { resolution: body.data.resolution } : {}) },
    });
    await audit(prisma, actor.userId, "report:resolve", "report", params.id, body.data.status);
    return reply.send({ ok: true });
  });

  app.post("/admin/users/:id/ban", async (request, reply) => {
    const actor = await requireAdmin(request, reply, env, prisma);
    if (!actor || !prisma) return;
    const params = z.object({ id: z.string() }).parse(request.params);
    const body = z.object({ reason: z.string().max(500).optional() }).safeParse(request.body ?? {});
    if (!body.success) return reply.code(400).send({ error: "invalid_body" });
    await prisma.ban.create({
      data: { type: "blacklist", userId: params.id, ownerId: actor.userId, ...(body.data.reason ? { reason: body.data.reason } : {}) },
    });
    await audit(prisma, actor.userId, "user:ban", "user", params.id, body.data.reason);
    return reply.send({ ok: true });
  });

  app.get("/admin/audit", async (request, reply) => {
    const actor = await requireAdmin(request, reply, env, prisma);
    if (!actor || !prisma) return;
    const query = z.object({ q: z.string().optional(), page: z.coerce.number().int().min(0).default(0) }).parse(request.query);
    const where = query.q ? { action: { contains: query.q } } : {};
    const take = 20;
    const [total, rows] = await Promise.all([
      prisma.auditLog.count({ where }),
      prisma.auditLog.findMany({ where, skip: query.page * take, take, orderBy: { createdAt: "desc" } }),
    ]);
    return reply.send({ audit: rows, page: query.page, pages: Math.max(1, Math.ceil(total / take)) });
  });
}

async function requireAdmin(
  request: Parameters<typeof requireUser>[0],
  reply: Parameters<typeof requireUser>[1],
  env: ApiEnv,
  prisma: PrismaClient | null,
) {
  const actor = await requireUser(request, reply, env);
  if (!actor) return null;
  if (!prisma) {
    await reply.code(503).send({ error: "database_unconfigured" });
    return null;
  }
  const user = await prisma.user.findUnique({ where: { id: actor.userId } });
  if (!user || (user.role !== "ADMIN" && user.role !== "SUPERADMIN")) {
    await reply.code(403).send({ error: "forbidden" });
    return null;
  }
  return actor;
}

async function profileOf(prisma: PrismaClient, userId: string, includePrivate: boolean) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { achievements: { include: { achievement: true } }, entitlements: true },
  });
  if (!user) return null;
  return {
    id: user.id,
    displayName: user.displayName,
    username: (user.showUsername || includePrivate) ? user.username : null,
    bio: user.bio,
    avatarUrl: user.avatarUrl,
    locale: user.locale,
    themeId: user.themeId,
    role: user.role,
    xp: user.xp,
    level: levelFromXp(user.xp),
    isPremium: user.isPremium,
    stats: {
      parties: user.totalParties,
      messages: user.totalMessages,
      reactions: user.totalReactions,
      roomsCreated: user.roomsCreated,
      watchTime: user.totalWatchTime,
    },
    achievements: user.achievements.map((row) => ({
      key: row.achievement.key,
      title: row.achievement.titleRu,
      points: row.achievement.xpReward,
      pinSlot: row.pinSlot,
      awardedAt: row.awardedAt.toISOString(),
    })),
    entitlements: user.entitlements.map((item) => ({
      id: item.id,
      sku: item.sku,
      kind: item.kind,
      active: item.active,
      expiresAt: item.expiresAt?.toISOString() ?? null,
    })),
  };
}
