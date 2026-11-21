import {
  cobaltServices,
  dayScore,
  extractorsEnabled,
  imageKind,
  levelFromXp,
  memberFlagsFromDefaults,
  planPlayback,
  roomCategorySelectionSchema,
  roomLayoutSchema,
  yearHeatmap,
} from "@lume/contracts";
import { createMediaRegistry, resolveMediaChain } from "@lume/media";
import { verifyAccessToken } from "@lume/contracts/node";
import { createEmailSender, type EmailSender } from "@lume/delivery";
import { randomBytes } from "node:crypto";
import type { PrismaClient } from "@lume/db";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { publicRoomPresenceWhere } from "../access/presence.js";
import { requireUser } from "../auth/guard.js";
import type { AuthStores } from "../auth/stores.js";
import { StorageUnconfiguredError, type MediaStorage } from "../media/storage.js";
import { mintAccessToken } from "../auth/jwt.js";
import type { ApiEnv } from "../env.js";
import type { RedisLike } from "../redis.js";
import { notifyUser } from "../account/notify.js";
import { lockCategoryRoom } from "../rooms/prisma-category.js";

export interface ExtraRouteOptions {
  stores: AuthStores;
  storage: MediaStorage;
  redis?: RedisLike | null;
  email?: EmailSender;
}

function createEnvEmailSender(env: ApiEnv): EmailSender {
  return createEmailSender({
    ...(env.SMTP_HOST ? { host: env.SMTP_HOST } : {}),
    ...(env.SMTP_PORT ? { port: env.SMTP_PORT } : {}),
    ...(env.SMTP_USER ? { user: env.SMTP_USER } : {}),
    ...(env.SMTP_PASSWORD ? { password: env.SMTP_PASSWORD } : {}),
    ...(env.SMTP_FROM ? { from: env.SMTP_FROM } : {}),
  });
}

export function registerExtraRoutes(
  app: FastifyInstance,
  env: ApiEnv,
  prisma: PrismaClient | null,
  options: ExtraRouteOptions,
): void {
  const { stores, storage, email } = options;
  const mailer = email ?? createEnvEmailSender(env);

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
    const rooms = await prisma.room.findMany({
      where: { ...publicRoomPresenceWhere, members: { some: { leftAt: null } } },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: { id: true, title: true },
    });
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
    if (!extractorsEnabled(env.FF_EXTRACTORS)) {
      return reply.send({ ...plan, extraction: "disabled" });
    }
    const mediaConfig = {
      ...(env.COBALT_API_URL ? { cobaltApiUrl: env.COBALT_API_URL } : {}),
      ...(env.YTDLP_PATH ? { ytdlpPath: env.YTDLP_PATH } : {}),
      ...(env.VK_COOKIES ? { vkCookies: env.VK_COOKIES } : {}),
      ...(env.TWITCH_CLIENT_ID ? { twitchClientId: env.TWITCH_CLIENT_ID } : {}),
      ...(env.TWITCH_CLIENT_SECRET ? { twitchClientSecret: env.TWITCH_CLIENT_SECRET } : {}),
      ...(env.SEARXNG_URL ? { searxngUrl: env.SEARXNG_URL } : {}),
      timeoutMs: env.MEDIA_EXTRACTOR_TIMEOUT_MS,
    };
    const report = createMediaRegistry(mediaConfig);
    const outcome = await resolveMediaChain(report, body.data.url, env.MEDIA_EXTRACTOR_TIMEOUT_MS);
    if (outcome.status === "no_extractor") {
      return reply.send({
        plan,
        extraction: "unconfigured",
        adapters: { enabled: report.enabled, disabled: report.disabled },
      });
    }
    if (outcome.status === "failed") {
      request.log.warn({ attempts: outcome.attempts }, "media resolve failed");
      return reply.send({ plan, extraction: "failed", attempts: outcome.attempts });
    }
    return reply.send({ plan, media: outcome.media, extractor: outcome.extractorId });
  });

  app.post("/uploads", async (request, reply) => {
    const actor = await requireUser(request, reply, env);
    if (!actor) return;
    if (!prisma) return reply.code(503).send({ error: "database_unconfigured" });
    const body = z.object({ dataBase64: z.string().min(8).max(14_000_000) }).safeParse(request.body);
    if (!body.success) return reply.code(400).send({ error: "invalid_body" });
    const bytes = Buffer.from(body.data.dataBase64, "base64");
    if (bytes.length > 10 * 1024 * 1024) return reply.code(413).send({ error: "too_large" });
    const kind = imageKind(bytes);
    if (!kind) return reply.code(400).send({ error: "not_image" });
    const mimeType = kind === "jpeg" ? "image/jpeg" : `image/${kind}`;
    const key = randomBytes(8).toString("hex");
    let stored;
    try {
      stored = await storage.put({ key, bytes, mimeType });
    } catch (error) {
      if (error instanceof StorageUnconfiguredError) {
        return reply.code(503).send({ error: "storage_unconfigured" });
      }
      request.log.error(error);
      return reply.code(502).send({ error: "storage_failed" });
    }
    await prisma.mediaObject.create({
      data: {
        key,
        userId: actor.userId,
        kind,
        mimeType,
        byteSize: bytes.length,
        backend: stored.backend,
        storageKey: stored.storageKey,
        publicUrl: stored.publicUrl,
        telegramFileId: stored.telegramFileId,
      },
    });
    return reply.send({
      url: stored.publicUrl ?? `/uploads/${key}`,
      backend: stored.backend,
    });
  });

  app.get("/uploads/:id", async (request, reply) => {
    const params = z.object({ id: z.string().min(1).max(64) }).safeParse(request.params);
    if (!params.success) return reply.code(400).send({ error: "invalid_body" });
    if (!prisma) return reply.code(503).send({ error: "database_unconfigured" });
    const row = await prisma.mediaObject.findUnique({ where: { key: params.data.id } });
    if (!row) return reply.code(404).send({ error: "not_found" });
    const resolved = await storage.read({
      backend: row.backend,
      storageKey: row.storageKey,
      publicUrl: row.publicUrl,
      telegramFileId: row.telegramFileId,
      mimeType: row.mimeType,
    });
    if (!resolved) return reply.code(404).send({ error: "not_found" });
    if (resolved.kind === "redirect") return reply.redirect(resolved.url);
    return reply.type(resolved.mimeType).send(resolved.bytes);
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
      category: room.category,
      categorySelection: room.categorySelection,
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
      categorySelection: roomCategorySelectionSchema.optional(),
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
    const selection = body.data.categorySelection;
    const room = await prisma.$transaction(async (tx) => {
      if (selection !== undefined) await lockCategoryRoom(tx, params.id);
      const self = await tx.roomMember.findUnique({ where: { roomId_userId: { roomId: params.id, userId: actor.userId } } });
      if (!self || self.role !== "host" || self.leftAt) return null;
      const current = selection === "auto" ? await tx.room.findUnique({
        where: { id: params.id }, select: { nowPlaying: { select: { inferredCategory: true } } },
      }) : null;
      const updated = await tx.room.update({ where: { id: params.id }, data: {
        ...(body.data.title === undefined ? {} : { title: body.data.title }),
        ...(body.data.description === undefined ? {} : { description: body.data.description || null }),
        ...(body.data.isPublic === undefined ? {} : { isPublic: body.data.isPublic }),
        ...(body.data.maxMembers === undefined ? {} : { maxMembers: body.data.maxMembers }),
        ...(body.data.hideReactions === undefined ? {} : { hideReactions: body.data.hideReactions }),
        ...(body.data.defaults === undefined ? {} : { defaultPermissions: body.data.defaults }),
        ...(selection === undefined ? {} : { categorySelection: selection, category: selection === "auto" ? current?.nowPlaying?.inferredCategory ?? "other" : selection }),
      } });
      if (body.data.defaults !== undefined) {
        await tx.roomMember.updateMany({
          where: { roomId: params.id, permissionsOverridden: false },
          data: memberFlagsFromDefaults(body.data.defaults),
        });
      }
      return updated;
    });
    if (!room) return reply.code(403).send({ error: "forbidden" });
    return reply.send({
      title: room.title,
      description: room.description ?? "",
      isPublic: room.isPublic,
      maxMembers: room.maxMembers,
      hideReactions: room.hideReactions,
      defaults: room.defaultPermissions ?? null,
      category: room.category,
      categorySelection: room.categorySelection,
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
    const now = new Date();
    const seasonStart = new Date(now);
    seasonStart.setUTCHours(0, 0, 0, 0);
    seasonStart.setUTCDate(seasonStart.getUTCDate() - 364);
    const seasonSessions = await prisma.watchSession.findMany({
      where: { userId: user.id, sessionDate: { gte: seasonStart, lte: now } },
      select: { roomId: true, sessionDate: true, watchDuration: true },
    });
    const bucketsByDay = new Map<string, Map<string, number>>();
    for (const row of seasonSessions) {
      const day = row.sessionDate.toISOString().slice(0, 10);
      const buckets = bucketsByDay.get(day) ?? new Map<string, number>();
      const key = `${row.roomId ?? "none"}:${Math.floor(row.sessionDate.getTime() / 60_000)}`;
      // A group session can contain one record per partner, not one watch per record.
      buckets.set(key, Math.max(buckets.get(key) ?? 0, row.watchDuration));
      bucketsByDay.set(day, buckets);
    }
    const scores = Object.fromEntries([...bucketsByDay].map(([day, buckets]) => [
      day, dayScore([...buckets.values()].reduce((sum, seconds) => sum + seconds, 0), 0, 0),
    ]));
    return reply.send({
      level: levelFromXp(user.xp),
      bio: user.bio,
      heatmap: yearHeatmap(now, scores),
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
    const emailAddress = body.data.email.toLowerCase();
    const { token } = await stores.magic.issue(emailAddress);
    const link = `${env.WEB_ORIGIN}/?magic=${token}`;
    if (!mailer.configured) {
      return reply.send({ ok: true, magicLink: link });
    }
    const delivered = await mailer.send({
      to: emailAddress,
      subject: "Вход в Lume",
      text: `Ссылка для входа: ${link}\nСсылка действует 15 минут.`,
      html: `<p>Ссылка для входа: <a href="${link}">${link}</a></p><p>Ссылка действует 15 минут.</p>`,
    });
    if (delivered.status === "failed") {
      request.log.error({ error: delivered.error }, "magic link email failed");
      return reply.code(502).send({ error: "email_failed" });
    }
    return reply.send({ ok: true });
  });

  app.post("/auth/magic-link/verify", async (request, reply) => {
    if (!prisma || !env.JWT_SECRET) return reply.code(503).send({ error: "database_unconfigured" });
    const body = z.object({ token: z.string().min(8) }).safeParse(request.body);
    if (!body.success) return reply.code(400).send({ error: "invalid_body" });
    const email = await stores.magic.consume(body.data.token);
    if (!email) return reply.code(401).send({ error: "Invalid or expired magic link" });
    const user = await prisma.user.upsert({
      where: { email },
      update: {},
      create: { email, displayName: email.split("@")[0] ?? "Гость", username: `mail:${email}` },
    });
    const accessToken = await mintAccessToken({ secret: env.JWT_SECRET, userId: user.id, telegramId: null, displayName: user.displayName, ttlSeconds: env.JWT_TTL_SECONDS });
    return reply.send({ accessToken, refreshToken: await stores.refresh.issue(user.id), user: { id: user.id, displayName: user.displayName } });
  });

  app.post("/auth/refresh", async (request, reply) => {
    if (!env.JWT_SECRET || !prisma) return reply.code(503).send({ error: "database_unconfigured" });
    const body = z.object({ refreshToken: z.string().min(8) }).safeParse(request.body);
    if (!body.success) return reply.code(400).send({ error: "invalid_body" });
    const rotated = await stores.refresh.rotate(body.data.refreshToken);
    if (!rotated) return reply.code(401).send({ error: "unauthorized" });
    const user = await prisma.user.findUnique({ where: { id: rotated.userId } });
    if (!user || user.deletedAt) return reply.code(401).send({ error: "unauthorized" });
    const accessToken = await mintAccessToken({ secret: env.JWT_SECRET, userId: user.id, telegramId: user.telegramId?.toString() ?? null, displayName: user.displayName, ttlSeconds: env.JWT_TTL_SECONDS });
    return reply.send({ accessToken, refreshToken: rotated.refreshToken });
  });

  app.post("/auth/logout", async (request, reply) => {
    const body = z.object({ refreshToken: z.string().min(1) }).safeParse(request.body);
    if (body.success) await stores.refresh.revoke(body.data.refreshToken);
    return reply.send({ ok: true });
  });
}
