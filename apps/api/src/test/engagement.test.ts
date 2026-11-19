import { afterEach, describe, expect, it } from "vitest";
import { createPrismaClient } from "@lume/db";
import { buildApp } from "../app.js";
import { loadApiEnv } from "../env.js";

const databaseUrl = "postgresql://lume:lume@127.0.0.1:5432/lume_test?schema=public";

describe("engagement widget", () => {
  let app: Awaited<ReturnType<typeof buildApp>> | undefined;

  afterEach(async () => {
    await app?.close();
  });

  it("aggregates watch seconds, voice seconds, messages, and reactions from persisted rows", async () => {
    process.env.DATABASE_URL = databaseUrl;
    const prisma = createPrismaClient();
    const env = loadApiEnv({
      NODE_ENV: "test",
      DATABASE_URL: databaseUrl,
      JWT_SECRET: "engagement-test-secret",
      ALLOW_STUB_AUTH: "true",
      WEB_ORIGIN: "http://127.0.0.1:5173",
    });
    app = await buildApp(env, { prisma });
    const server = app;
    const stamp = Date.now().toString(36);
    const ownerLogin = await server.inject({ method: "POST", url: "/auth/dev", payload: { displayName: `Engagement ${stamp}` } });
    const ownerToken = ownerLogin.json().accessToken as string;
    const ownerId = ownerLogin.json().user.id as string;
    const partnerLogin = await server.inject({ method: "POST", url: "/auth/dev", payload: { displayName: `Engagement partner ${stamp}` } });
    const partnerId = partnerLogin.json().user.id as string;
    const viewerLogin = await server.inject({ method: "POST", url: "/auth/dev", payload: { displayName: `Engagement viewer ${stamp}` } });
    const viewerToken = viewerLogin.json().accessToken as string;
    const viewerId = viewerLogin.json().user.id as string;

    const created = await server.inject({
      method: "POST",
      url: "/rooms",
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: { title: `Engagement ${stamp}` },
    });
    const roomId = created.json().room.id as string;
    const code = created.json().room.code as string;

    const partnerToken = partnerLogin.json().accessToken as string;
    const partnerJoin = await server.inject({
      method: "POST",
      url: "/rooms/join",
      headers: { authorization: `Bearer ${partnerToken}` },
      payload: { code },
    });
    expect(partnerJoin.statusCode).toBe(200);
    const viewerJoin = await server.inject({
      method: "POST",
      url: "/rooms/join",
      headers: { authorization: `Bearer ${viewerToken}` },
      payload: { code },
    });
    expect(viewerJoin.statusCode).toBe(200);

    const message = await server.inject({
      method: "POST",
      url: `/rooms/${roomId}/messages`,
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: { body: "пишу в чат" },
    });
    expect(message.statusCode).toBe(200);
    const reaction = await server.inject({
      method: "POST",
      url: `/rooms/${roomId}/reactions`,
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: { messageId: message.json().id, emoji: "🔥" },
    });
    expect(reaction.statusCode).toBe(200);

    await prisma.roomMember.update({
      where: { roomId_userId: { roomId, userId: ownerId } },
      data: { joinedAt: new Date(Date.now() - 60_000) },
    });
    const left = await server.inject({
      method: "POST",
      url: `/rooms/${roomId}/leave`,
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: {},
    });
    expect(left.statusCode).toBe(200);
    const ownerRow = await prisma.user.findUnique({ where: { id: ownerId } });
    expect(ownerRow?.totalWatchTime).toBe(60);
    const sessions = await prisma.watchSession.findMany({ where: { userId: ownerId } });
    expect(sessions).toHaveLength(2);
    expect(sessions.map((row) => row.watchDuration)).toEqual([60, 60]);
    expect(new Set(sessions.map((row) => row.sessionDate.getTime())).size).toBe(1);

    const voice = await server.inject({
      method: "POST",
      url: "/me/voice-seconds",
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: { seconds: 90 },
    });
    expect(voice.statusCode).toBe(200);

    const engagement = await server.inject({
      method: "GET",
      url: `/users/${ownerId}/engagement`,
      headers: { authorization: `Bearer ${viewerToken}` },
    });
    expect(engagement.statusCode).toBe(200);
    const engagementBody = engagement.json() as { messages: number; reactions: number; activity: number; watchSeconds: number; voiceSeconds: number; totalSeconds: number };
    expect(engagementBody).toMatchObject({
      userId: ownerId,
      voiceSeconds: 90,
      watchSeconds: 60,
      reactions: 1,
      totalSeconds: 150,
    });
    expect(engagementBody.messages).toBeGreaterThanOrEqual(1);
    expect(engagementBody.activity).toBe(engagementBody.messages + engagementBody.reactions);

    await prisma.user.update({ where: { id: ownerId }, data: { totalWatchTime: 0 } });
    const legacyBase = new Date("2026-01-01T10:00:00Z").getTime();
    for (const [index, row] of sessions.entries()) {
      await prisma.watchSession.update({
        where: { id: row.id },
        data: { sessionDate: new Date(legacyBase + index * 1000) },
      });
    }
    const legacy = await server.inject({
      method: "GET",
      url: `/users/${ownerId}/engagement`,
      headers: { authorization: `Bearer ${viewerToken}` },
    });
    expect(legacy.json().watchSeconds).toBe(60);

    const missing = await server.inject({ method: "GET", url: "/users/missing-user/engagement" });
    expect(missing.statusCode).toBe(404);

    await prisma.watchSession.deleteMany({ where: { userId: ownerId } });
    await prisma.message.deleteMany({ where: { roomId } });
    await prisma.room.deleteMany({ where: { id: roomId } });
    await prisma.user.deleteMany({ where: { id: { in: [ownerId, partnerId, viewerId] } } });
    await prisma.$disconnect();
  });
});
