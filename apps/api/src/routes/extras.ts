import {
  consumeMagic,
  dayScore,
  imageKind,
  innertubeFromFixture,
  levelFromXp,
  planPlayback,
  rotateRefresh,
  runExtractorChain,
  type MagicRow,
  type RefreshRow,
} from "@lume/contracts";
import { randomBytes } from "node:crypto";
import type { PrismaClient } from "@lume/db";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireUser } from "../auth/guard.js";
import { mintAccessToken } from "../auth/jwt.js";
import type { ApiEnv } from "../env.js";
import { notifyUser } from "../account/notify.js";

const uploads = new Map<string, { bytes: Buffer; type: string }>();
const magicLinks = new Map<string, MagicRow>();
const refreshTokens = new Map<string, RefreshRow>();

export function registerExtraRoutes(app: FastifyInstance, env: ApiEnv, prisma: PrismaClient | null): void {
  app.get("/metrics", async (request, reply) => {
    if (env.METRICS_TOKEN) {
      const header = request.headers.authorization;
      if (header !== `Bearer ${env.METRICS_TOKEN}`) {
        return reply.code(401).send({ error: "unauthorized" });
      }
    }
    const text = [
      "# HELP lume_up 1 when the process is serving.",
      "# TYPE lume_up gauge",
      "lume_up 1",
      `# HELP lume_sentry_configured 1 when SENTRY_DSN is set.`,
      "# TYPE lume_sentry_configured gauge",
      `lume_sentry_configured ${env.SENTRY_DSN ? 1 : 0}`,
    ].join("\n");
    return reply.type("text/plain").send(`${text}\n`);
  });

  app.post("/video/resolve", async (request, reply) => {
    const body = z.object({ url: z.string().min(1), premium: z.boolean().optional() }).safeParse(request.body);
    if (!body.success) return reply.code(400).send({ error: "invalid_body" });
    const plan = planPlayback({ url: body.data.url, premium: body.data.premium === true });
    if (plan.type === "error") return reply.send(plan);
    if (env.FF_EXTRACTORS !== "true") return reply.send({ ...plan, extraction: "disabled" });
    const extracted = runExtractorChain([
      () => innertubeFromFixture(null),
      () => (env.COBALT_API_URL ? null : null),
      () => (env.YTDLP_PATH ? null : null),
    ]);
    return reply.send({ plan, extracted });
  });

  app.post("/uploads", async (request, reply) => {
    const actor = await requireUser(request, reply, env);
    if (!actor) return;
    const body = z.object({ dataBase64: z.string().min(8).max(14_000_000) }).safeParse(request.body);
    if (!body.success) return reply.code(400).send({ error: "invalid_body" });
    const bytes = Buffer.from(body.data.dataBase64, "base64");
    if (bytes.length > 10 * 1024 * 1024) return reply.code(413).send({ error: "too_large" });
    const kind = imageKind(bytes);
    if (!kind) return reply.code(400).send({ error: "not_image" });
    const id = randomBytes(8).toString("hex");
    uploads.set(id, { bytes, type: kind === "jpeg" ? "image/jpeg" : `image/${kind}` });
    return reply.send({ url: `/uploads/${id}` });
  });

  app.get("/uploads/:id", async (request, reply) => {
    const params = z.object({ id: z.string() }).parse(request.params);
    const file = uploads.get(params.id);
    if (!file) return reply.code(404).send({ error: "not_found" });
    return reply.type(file.type).send(file.bytes);
  });

  app.post("/rooms/:id/images", async (request, reply) => {
    const actor = await requireUser(request, reply, env);
    if (!actor || !prisma) {
      if (actor) return reply.code(503).send({ error: "database_unconfigured" });
      return;
    }
    const params = z.object({ id: z.string() }).parse(request.params);
    const body = z.object({ imageUrl: z.string().min(1), replyToId: z.string().nullable().optional() }).safeParse(request.body);
    if (!body.success) return reply.code(400).send({ error: "invalid_body" });
    const member = await prisma.roomMember.findUnique({ where: { roomId_userId: { roomId: params.id, userId: actor.userId } } });
    if (!member || member.leftAt || !member.canChat) return reply.code(403).send({ error: "forbidden" });
    const message = await prisma.message.create({
      data: {
        roomId: params.id,
        userId: actor.userId,
        body: "фото",
        type: "image",
        imageUrl: body.data.imageUrl,
        replyToId: body.data.replyToId ?? null,
      },
    });
    return reply.send({ id: message.id, imageUrl: message.imageUrl });
  });

  app.get("/rooms/:id/pin", async (request, reply) => {
    const actor = await requireUser(request, reply, env);
    if (!actor || !prisma) {
      if (actor) return reply.code(503).send({ error: "database_unconfigured" });
      return;
    }
    const params = z.object({ id: z.string() }).parse(request.params);
    const room = await prisma.room.findUnique({ where: { id: params.id } });
    if (!room?.pinnedMessageId) return reply.send({ message: null });
    const message = await prisma.message.findUnique({ where: { id: room.pinnedMessageId }, include: { user: true } });
    return reply.send({ message: message ? { id: message.id, body: message.body, displayName: message.user.displayName, imageUrl: message.imageUrl } : null });
  });

  app.get("/rooms/:id/pace", async (request, reply) => {
    const actor = await requireUser(request, reply, env);
    if (!actor || !prisma) {
      if (actor) return reply.code(503).send({ error: "database_unconfigured" });
      return;
    }
    const params = z.object({ id: z.string() }).parse(request.params);
    const room = await prisma.room.findUnique({ where: { id: params.id } });
    const last = await prisma.message.findFirst({
      where: { roomId: params.id, userId: actor.userId, type: "text" },
      orderBy: { createdAt: "desc" },
    });
    return reply.send({
      slowModeSeconds: room?.slowModeSeconds ?? 0,
      hideReactions: room?.hideReactions ?? false,
      lastMessageAt: last?.createdAt.toISOString() ?? null,
    });
  });

  app.patch("/rooms/:id/settings", async (request, reply) => {
    const actor = await requireUser(request, reply, env);
    if (!actor || !prisma) {
      if (actor) return reply.code(503).send({ error: "database_unconfigured" });
      return;
    }
    const params = z.object({ id: z.string() }).parse(request.params);
    const body = z.object({ hideReactions: z.boolean().optional(), description: z.string().max(280).optional(), maxMembers: z.number().int().min(2).max(100).optional() }).safeParse(request.body);
    if (!body.success) return reply.code(400).send({ error: "invalid_body" });
    const self = await prisma.roomMember.findUnique({ where: { roomId_userId: { roomId: params.id, userId: actor.userId } } });
    if (!self || self.role !== "host") return reply.code(403).send({ error: "forbidden" });
    await prisma.room.update({ where: { id: params.id }, data: body.data });
    return reply.send({ ok: true });
  });

  app.post("/rooms/:id/queue/order", async (request, reply) => {
    const actor = await requireUser(request, reply, env);
    if (!actor || !prisma) {
      if (actor) return reply.code(503).send({ error: "database_unconfigured" });
      return;
    }
    const params = z.object({ id: z.string() }).parse(request.params);
    const body = z.object({ ids: z.array(z.string().min(1)).min(1) }).safeParse(request.body);
    if (!body.success) return reply.code(400).send({ error: "invalid_body" });
    const self = await prisma.roomMember.findUnique({ where: { roomId_userId: { roomId: params.id, userId: actor.userId } } });
    if (!self || (!self.canReorderQueue && self.role !== "host")) return reply.code(403).send({ error: "forbidden" });
    await Promise.all(body.data.ids.map((id, index) => prisma.queueItem.updateMany({ where: { id, roomId: params.id }, data: { position: index + 1 } })));
    return reply.send({ ok: true });
  });

  app.post("/rooms/:id/invite", async (request, reply) => {
    const actor = await requireUser(request, reply, env);
    if (!actor || !prisma) {
      if (actor) return reply.code(503).send({ error: "database_unconfigured" });
      return;
    }
    const params = z.object({ id: z.string() }).parse(request.params);
    const body = z.object({ userId: z.string().min(1) }).safeParse(request.body);
    if (!body.success) return reply.code(400).send({ error: "invalid_body" });
    const room = await prisma.room.findUnique({ where: { id: params.id } });
    if (!room) return reply.code(404).send({ error: "not_found" });
    await notifyUser(prisma, {
      userId: body.data.userId,
      kind: "ROOM_INVITE",
      title: "Приглашение в зал",
      body: room.title,
      ...(env.TELEGRAM_BOT_TOKEN ? { telegramToken: env.TELEGRAM_BOT_TOKEN } : {}),
    });
    return reply.send({ ok: true });
  });

  app.post("/rooms/:id/reminders", async (request, reply) => {
    const actor = await requireUser(request, reply, env);
    if (!actor || !prisma) {
      if (actor) return reply.code(503).send({ error: "database_unconfigured" });
      return;
    }
    const params = z.object({ id: z.string() }).parse(request.params);
    const body = z.object({ minutes: z.number().int().min(5).max(60 * 24 * 7) }).safeParse(request.body);
    if (!body.success) return reply.code(400).send({ error: "invalid_body" });
    const note = await prisma.notification.create({
      data: { userId: actor.userId, kind: "SYSTEM", title: "Напоминание", body: `Пора вернуться в зал ${params.id}` },
    });
    await prisma.notificationDeliveryQueue.create({
      data: {
        userId: actor.userId,
        notificationId: note.id,
        channel: "web",
        kind: "SYSTEM",
        scheduledFor: new Date(Date.now() + body.data.minutes * 60_000),
      },
    });
    return reply.send({ ok: true });
  });

  app.get("/me/studio", async (request, reply) => {
    const actor = await requireUser(request, reply, env);
    if (!actor || !prisma) {
      if (actor) return reply.code(503).send({ error: "database_unconfigured" });
      return;
    }
    const user = await prisma.user.findUnique({ where: { id: actor.userId }, include: { achievements: { include: { achievement: true } }, watchHistory: true, hostedRooms: true } });
    if (!user) return reply.code(404).send({ error: "not_found" });
    const messages = await prisma.message.count({ where: { userId: user.id } });
    const bySource = new Map<string, number>();
    for (const item of user.watchHistory) {
      const source = item.source ?? "unknown";
      bySource.set(source, (bySource.get(source) ?? 0) + item.watchCount);
    }
    const sessions = await prisma.watchSession.groupBy({ by: ["partnerId"], where: { userId: user.id }, _sum: { watchDuration: true }, orderBy: { _sum: { watchDuration: "desc" } }, take: 5 });
    return reply.send({
      level: levelFromXp(user.xp),
      heatmap: [{ day: new Date().toISOString().slice(0, 10), score: dayScore(user.totalWatchTime, messages, user.totalReactions) }],
      platforms: [...bySource.entries()].map(([source, count]) => ({ source, count })).slice(0, 8),
      host: { roomsHosted: user.hostedRooms.length, messages },
      pins: user.achievements.filter((row) => row.pinSlot !== null).map((row) => ({ key: row.achievement.key, slot: row.pinSlot, title: row.achievement.titleRu })),
      achievements: user.achievements.map((row) => ({ key: row.achievement.key, title: row.achievement.titleRu, pinSlot: row.pinSlot })),
      topFriends: sessions.map((row) => ({ partnerId: row.partnerId, seconds: row._sum.watchDuration ?? 0 })),
    });
  });

  app.patch("/me/achievements/:key/pin", async (request, reply) => {
    const actor = await requireUser(request, reply, env);
    if (!actor || !prisma) {
      if (actor) return reply.code(503).send({ error: "database_unconfigured" });
      return;
    }
    const params = z.object({ key: z.string() }).parse(request.params);
    const body = z.object({ slot: z.number().int().min(0).max(2).nullable() }).safeParse(request.body);
    if (!body.success) return reply.code(400).send({ error: "invalid_body" });
    const achievement = await prisma.achievement.findUnique({ where: { key: params.key } });
    if (!achievement) return reply.code(404).send({ error: "not_found" });
    if (body.data.slot !== null) {
      await prisma.userAchievement.updateMany({ where: { userId: actor.userId, pinSlot: body.data.slot }, data: { pinSlot: null } });
    }
    await prisma.userAchievement.update({
      where: { userId_achievementId: { userId: actor.userId, achievementId: achievement.id } },
      data: { pinSlot: body.data.slot },
    });
    return reply.send({ ok: true });
  });

  app.get("/me/discovery", async (request, reply) => {
    const actor = await requireUser(request, reply, env);
    if (!actor || !prisma) {
      if (actor) return reply.code(503).send({ error: "database_unconfigured" });
      return;
    }
    const rows = await prisma.watchHistory.findMany({ where: { userId: actor.userId }, orderBy: { watchCount: "desc" }, take: 6 });
    return reply.send({ items: rows.map((row) => ({ url: row.videoUrl, title: row.title, reason: row.watchCount > 1 ? "favorite" : "history" })) });
  });

  app.post("/auth/magic-link", async (request, reply) => {
    const body = z.object({ email: z.string().email() }).safeParse(request.body);
    if (!body.success) return reply.code(400).send({ error: "invalid_body" });
    const token = randomBytes(16).toString("hex");
    magicLinks.set(token, { email: body.data.email.toLowerCase(), expiresAt: Date.now() + 15 * 60_000, used: false });
    const link = `${env.WEB_ORIGIN}/?magic=${token}`;
    return reply.send({ ok: true, ...(env.SMTP_HOST ? {} : { magicLink: link }) });
  });

  app.post("/auth/magic-link/verify", async (request, reply) => {
    if (!prisma || !env.JWT_SECRET) return reply.code(503).send({ error: "database_unconfigured" });
    const body = z.object({ token: z.string().min(8) }).safeParse(request.body);
    if (!body.success) return reply.code(400).send({ error: "invalid_body" });
    const email = consumeMagic(magicLinks, body.data.token, Date.now());
    if (!email) return reply.code(401).send({ error: "Invalid or expired magic link" });
    const user = await prisma.user.upsert({
      where: { email },
      update: {},
      create: { email, displayName: email.split("@")[0] ?? "Гость", username: `mail:${email}` },
    });
    const accessToken = await mintAccessToken({ secret: env.JWT_SECRET, userId: user.id, telegramId: null, displayName: user.displayName, ttlSeconds: env.JWT_TTL_SECONDS });
    const refreshToken = randomBytes(24).toString("hex");
    refreshTokens.set(refreshToken, { userId: user.id, expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000 });
    return reply.send({ accessToken, refreshToken, user: { id: user.id, displayName: user.displayName } });
  });

  app.post("/auth/refresh", async (request, reply) => {
    if (!env.JWT_SECRET || !prisma) return reply.code(503).send({ error: "database_unconfigured" });
    const body = z.object({ refreshToken: z.string().min(8) }).safeParse(request.body);
    if (!body.success) return reply.code(400).send({ error: "invalid_body" });
    const next = randomBytes(24).toString("hex");
    const userId = rotateRefresh(refreshTokens, body.data.refreshToken, next, Date.now(), 7 * 24 * 60 * 60 * 1000);
    if (!userId) return reply.code(401).send({ error: "unauthorized" });
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.deletedAt) return reply.code(401).send({ error: "unauthorized" });
    const accessToken = await mintAccessToken({ secret: env.JWT_SECRET, userId: user.id, telegramId: user.telegramId?.toString() ?? null, displayName: user.displayName, ttlSeconds: env.JWT_TTL_SECONDS });
    return reply.send({ accessToken, refreshToken: next });
  });

  app.post("/auth/logout", async (request, reply) => {
    const body = z.object({ refreshToken: z.string().min(1) }).safeParse(request.body);
    if (body.success) refreshTokens.delete(body.data.refreshToken);
    return reply.send({ ok: true });
  });
}
