import {
  cobaltServices,
  consumeMagic,
  dayScore,
  imageKind,
  innertubeFromFixture,
  levelFromXp,
  memberFlagsFromDefaults,
  planPlayback,
  roomLayoutSchema,
  yearHeatmap,
  rutubeFromFixture,
  runExtractorChain,
  twitchFromFixture,
  vkFromFixture,
  type MagicRow,
} from "@lume/contracts";
import { verifyAccessToken } from "@lume/contracts/node";
import { randomBytes } from "node:crypto";
import type { PrismaClient } from "@lume/db";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireUser } from "../auth/guard.js";
import { issueRefresh, revokeRefresh, rotateStoredRefresh } from "../auth/refresh-store.js";
import { storeObject } from "../media/storage.js";
import { mintAccessToken } from "../auth/jwt.js";
import type { ApiEnv } from "../env.js";
import { notifyUser } from "../account/notify.js";

const uploads = new Map<string, { bytes: Buffer; type: string }>();
const magicLinks = new Map<string, MagicRow>();

export function registerExtraRoutes(app: FastifyInstance, env: ApiEnv, prisma: PrismaClient | null): void {
  app.get("/stats/global", async () => {
    if (!prisma) {
      return { usersOnline: 0, activeRooms: 0, totalVideos: 0, totalWatchHours: 0 };
    }
    const [online, active, videos, watch] = await Promise.all([
      prisma.roomMember.findMany({
        where: { leftAt: null, room: { status: { not: "ended" } } },
        distinct: ["userId"],
        select: { userId: true },
      }),
      prisma.room.findMany({
        where: { status: { not: "ended" }, members: { some: { leftAt: null } } },
        select: { id: true },
      }),
      prisma.watchHistory.findMany({ distinct: ["videoUrl"], select: { videoUrl: true } }),
      prisma.user.aggregate({ _sum: { totalWatchTime: true } }),
    ]);
    const totalWatchSeconds = watch._sum.totalWatchTime ?? 0;
    return {
      usersOnline: online.length,
      activeRooms: active.length,
      totalVideos: videos.length,
      totalWatchHours: Math.round((totalWatchSeconds / 3600) * 10) / 10,
    };
  });

  app.get("/stats", async () => {
    if (!prisma) return { watchers: [], parties: [] };
    const users = await prisma.user.findMany({ orderBy: { xp: "desc" }, take: 10, select: { id: true, displayName: true, xp: true } });
    const rooms = await prisma.room.findMany({ where: { status: { not: "ended" } }, orderBy: { createdAt: "desc" }, take: 10, select: { id: true, title: true } });
    return { watchers: users, parties: rooms };
  });

  app.get("/flags", async () => ({
    smartQueue: true,
    voicePreflight: true,
    chatComfort: true,
    moderationPresets: true,
    lowBandwidth: true,
    socialRetention: true,
    extractors: env.FF_EXTRACTORS === "true",
  }));

  app.get("/video/services", async () => ({
    services: cobaltServices(env.COBALT_API_URL),
    unavailable: !env.COBALT_API_URL,
  }));

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
    const body = z.object({ url: z.string().min(1) }).safeParse(request.body);
    if (!body.success) return reply.code(400).send({ error: "invalid_body" });
    let premium = false;
    const header = request.headers.authorization;
    if (prisma && env.JWT_SECRET && header?.startsWith("Bearer ")) {
      try {
        const actor = await verifyAccessToken(env.JWT_SECRET, header.slice("Bearer ".length));
        const account = await prisma.user.findUnique({ where: { id: actor.userId }, select: { isPremium: true } });
        premium = Boolean(account?.isPremium);
      } catch {
        premium = false;
      }
    }
    const plan = planPlayback({ url: body.data.url, premium });
    if (plan.type === "error") return reply.send(plan);
    if (env.FF_EXTRACTORS !== "true") return reply.send({ ...plan, extraction: "disabled" });
    const extracted = runExtractorChain([
      () => innertubeFromFixture(null),
      () => vkFromFixture(null),
      () => rutubeFromFixture(null),
      () => twitchFromFixture(null),
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
    const stored = await storeObject({
      id,
      bytes,
      telegram: { token: env.TELEGRAM_BOT_TOKEN, chatId: env.TELEGRAM_STORAGE_CHAT },
      s3: { endpoint: env.CDN_ENDPOINT },
    });
    return reply.send({ url: stored.backend === "local" ? stored.url : stored.url, backend: stored.backend });
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

  app.get("/rooms/:id/settings", async (request, reply) => {
    const actor = await requireUser(request, reply, env);
    if (!actor || !prisma) {
      if (actor) return reply.code(503).send({ error: "database_unconfigured" });
      return;
    }
    const params = z.object({ id: z.string() }).parse(request.params);
    const member = await prisma.roomMember.findUnique({ where: { roomId_userId: { roomId: params.id, userId: actor.userId } } });
    if (!member || member.leftAt) return reply.code(403).send({ error: "forbidden" });
    const room = await prisma.room.findUnique({ where: { id: params.id } });
    if (!room) return reply.code(404).send({ error: "not_found" });
    return reply.send({
      title: room.title,
      description: room.description ?? "",
      isPublic: room.isPublic,
      maxMembers: room.maxMembers,
      hideReactions: room.hideReactions,
      defaults: room.defaultPermissions ?? null,
    });
  });

  app.patch("/rooms/:id/settings", async (request, reply) => {
    const actor = await requireUser(request, reply, env);
    if (!actor || !prisma) {
      if (actor) return reply.code(503).send({ error: "database_unconfigured" });
      return;
    }
    const params = z.object({ id: z.string() }).parse(request.params);
    const body = z.object({
      title: z.string().trim().min(1).max(120).optional(),
      hideReactions: z.boolean().optional(),
      description: z.string().trim().max(280).optional(),
      isPublic: z.boolean().optional(),
      maxMembers: z.number().int().min(2).max(100).optional(),
      defaults: z.object({
        canChat: z.boolean(),
        canQueue: z.boolean(),
        canSpeak: z.boolean(),
        canReact: z.boolean(),
        canSeek: z.boolean(),
        canInvite: z.boolean(),
      }).optional(),
    }).safeParse(request.body);
    if (!body.success) return reply.code(400).send({ error: "invalid_body" });
    const self = await prisma.roomMember.findUnique({ where: { roomId_userId: { roomId: params.id, userId: actor.userId } } });
    if (!self || self.role !== "host" || self.leftAt) return reply.code(403).send({ error: "forbidden" });
    const room = await prisma.room.update({
      where: { id: params.id },
      data: {
        ...(body.data.title === undefined ? {} : { title: body.data.title }),
        ...(body.data.description === undefined ? {} : { description: body.data.description || null }),
        ...(body.data.isPublic === undefined ? {} : { isPublic: body.data.isPublic }),
        ...(body.data.maxMembers === undefined ? {} : { maxMembers: body.data.maxMembers }),
        ...(body.data.hideReactions === undefined ? {} : { hideReactions: body.data.hideReactions }),
        ...(body.data.defaults === undefined ? {} : { defaultPermissions: body.data.defaults }),
      },
    });
    if (body.data.defaults !== undefined) {
      await prisma.roomMember.updateMany({
        where: { roomId: params.id, permissionsOverridden: false },
        data: memberFlagsFromDefaults(body.data.defaults),
      });
    }
    return reply.send({
      title: room.title,
      description: room.description ?? "",
      isPublic: room.isPublic,
      maxMembers: room.maxMembers,
      hideReactions: room.hideReactions,
      defaults: room.defaultPermissions ?? null,
    });
  });

  app.get("/rooms/:id/layout", async (request, reply) => {
    const actor = await requireUser(request, reply, env);
    if (!actor || !prisma) {
      if (actor) return reply.code(503).send({ error: "database_unconfigured" });
      return;
    }
    const params = z.object({ id: z.string() }).parse(request.params);
    const room = await prisma.room.findUnique({ where: { id: params.id } });
    if (!room) return reply.code(404).send({ error: "not_found" });
    return reply.send({ layout: roomLayoutSchema.safeParse(room.layout).success ? room.layout : null });
  });

  app.patch("/rooms/:id/layout", async (request, reply) => {
    const actor = await requireUser(request, reply, env);
    if (!actor || !prisma) {
      if (actor) return reply.code(503).send({ error: "database_unconfigured" });
      return;
    }
    const params = z.object({ id: z.string() }).parse(request.params);
    const body = roomLayoutSchema.safeParse(request.body);
    if (!body.success) return reply.code(400).send({ error: "invalid_body" });
    const member = await prisma.roomMember.findUnique({ where: { roomId_userId: { roomId: params.id, userId: actor.userId } } });
    if (!member || member.leftAt) return reply.code(403).send({ error: "forbidden" });
    await prisma.room.update({ where: { id: params.id }, data: { layout: body.data, videoAspect: body.data.videoAspect } });
    return reply.send({ layout: body.data });
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
    const member = await prisma.roomMember.findUnique({ where: { roomId_userId: { roomId: params.id, userId: actor.userId } } });
    if (member && member.role !== "host" && member.canInvite === false) {
      return reply.code(403).send({ error: "forbidden" });
    }
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
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const todaySessions = await prisma.watchSession.findMany({
      where: { userId: user.id, sessionDate: { gte: today } },
      select: { roomId: true, sessionDate: true, watchDuration: true },
    });
    const todayBuckets = new Map<string, number>();
    for (const row of todaySessions) {
      const key = `${row.roomId ?? "none"}:${Math.floor(row.sessionDate.getTime() / 60_000)}`;
      todayBuckets.set(key, Math.max(todayBuckets.get(key) ?? 0, row.watchDuration));
    }
    const watchedToday = [...todayBuckets.values()].reduce((sum, seconds) => sum + seconds, 0);
    return reply.send({
      level: levelFromXp(user.xp),
      bio: user.bio,
      heatmap: yearHeatmap(new Date(), {
        [new Date().toISOString().slice(0, 10)]: dayScore(watchedToday, messages, user.totalReactions),
      }),
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
    const query = z.object({ roomId: z.string().min(1).optional() }).safeParse(request.query);
    if (!query.success) return reply.code(400).send({ error: "invalid_body" });
    const waiting = query.data.roomId
      ? new Set(
          (
            await prisma.queueItem.findMany({
              where: { roomId: query.data.roomId, played: false },
              select: { url: true },
            })
          ).map((row) => row.url),
        )
      : new Set<string>();
    const rows = await prisma.watchHistory.findMany({
      where: { userId: actor.userId },
      orderBy: { watchCount: "desc" },
      take: 20,
    });
    const items = rows
      .filter((row) => !waiting.has(row.videoUrl))
      .slice(0, 6)
      .map((row) => ({ url: row.videoUrl, title: row.title, reason: row.watchCount > 1 ? "favorite" : "history" }));
    return reply.send({ items });
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
    return reply.send({ accessToken, refreshToken: issueRefresh(user.id), user: { id: user.id, displayName: user.displayName } });
  });

  app.post("/auth/refresh", async (request, reply) => {
    if (!env.JWT_SECRET || !prisma) return reply.code(503).send({ error: "database_unconfigured" });
    const body = z.object({ refreshToken: z.string().min(8) }).safeParse(request.body);
    if (!body.success) return reply.code(400).send({ error: "invalid_body" });
    const rotated = rotateStoredRefresh(body.data.refreshToken);
    if (!rotated) return reply.code(401).send({ error: "unauthorized" });
    const user = await prisma.user.findUnique({ where: { id: rotated.userId } });
    if (!user || user.deletedAt) return reply.code(401).send({ error: "unauthorized" });
    const accessToken = await mintAccessToken({ secret: env.JWT_SECRET, userId: user.id, telegramId: user.telegramId?.toString() ?? null, displayName: user.displayName, ttlSeconds: env.JWT_TTL_SECONDS });
    return reply.send({ accessToken, refreshToken: rotated.refreshToken });
  });

  app.post("/auth/logout", async (request, reply) => {
    const body = z.object({ refreshToken: z.string().min(1) }).safeParse(request.body);
    if (body.success) revokeRefresh(body.data.refreshToken);
    return reply.send({ ok: true });
  });
}
