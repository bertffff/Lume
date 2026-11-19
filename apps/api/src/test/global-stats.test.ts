import { afterEach, describe, expect, it } from "vitest";
import { createPrismaClient } from "@lume/db";
import { buildApp } from "../app.js";
import { loadApiEnv } from "../env.js";

const databaseUrl = "postgresql://lume:lume@127.0.0.1:5432/lume?schema=public";

describe("global stats", () => {
  let app: Awaited<ReturnType<typeof buildApp>> | undefined;

  afterEach(async () => {
    await app?.close();
  });

  it("counts online members, active rooms, videos and watch hours from stored rows", async () => {
    process.env.DATABASE_URL = databaseUrl;
    const prisma = createPrismaClient();
    const env = loadApiEnv({
      NODE_ENV: "test",
      DATABASE_URL: databaseUrl,
      JWT_SECRET: "global-stats-test-secret",
      ALLOW_STUB_AUTH: "true",
      WEB_ORIGIN: "http://127.0.0.1:5173",
    });
    app = await buildApp(env, { prisma });
    const before = (await app.inject({ method: "GET", url: "/stats/global" })).json() as {
      usersOnline: number;
      activeRooms: number;
      totalVideos: number;
      totalWatchHours: number;
    };

    const stamp = Date.now().toString(36);
    const host = await app.inject({ method: "POST", url: "/auth/dev", payload: { displayName: `Stats ${stamp}` } });
    const hostToken = host.json().accessToken as string;
    const hostId = host.json().user.id as string;
    const guest = await app.inject({ method: "POST", url: "/auth/dev", payload: { displayName: `Stats guest ${stamp}` } });
    const guestToken = guest.json().accessToken as string;
    const guestId = guest.json().user.id as string;

    const first = await app.inject({
      method: "POST",
      url: "/rooms",
      headers: { authorization: `Bearer ${hostToken}` },
      payload: { title: `Stats one ${stamp}`, isPublic: true },
    });
    const firstId = first.json().room.id as string;
    const second = await app.inject({
      method: "POST",
      url: "/rooms",
      headers: { authorization: `Bearer ${hostToken}` },
      payload: { title: `Stats two ${stamp}`, isPublic: true },
    });
    const secondId = second.json().room.id as string;
    await app.inject({
      method: "POST",
      url: "/rooms/join",
      headers: { authorization: `Bearer ${guestToken}` },
      payload: { code: first.json().room.code },
    });

    await prisma.watchHistory.createMany({
      data: [
        { userId: hostId, videoUrl: `https://cdn.example.com/stat-a-${stamp}.mp4`, title: "A", source: "direct" },
        { userId: hostId, videoUrl: `https://cdn.example.com/stat-b-${stamp}.mp4`, title: "B", source: "direct" },
        { userId: guestId, videoUrl: `https://cdn.example.com/stat-a-${stamp}.mp4`, title: "A", source: "direct" },
      ],
    });
    await prisma.user.update({ where: { id: hostId }, data: { totalWatchTime: 3600 } });
    await prisma.user.update({ where: { id: guestId }, data: { totalWatchTime: 1800 } });

    const after = (await app.inject({ method: "GET", url: "/stats/global" })).json() as typeof before;
    expect(Number.isFinite(after.usersOnline)).toBe(true);
    expect(after.usersOnline).toBeGreaterThanOrEqual(before.usersOnline + 2);
    expect(after.activeRooms).toBeGreaterThanOrEqual(before.activeRooms + 2);
    expect(after.totalVideos).toBeGreaterThanOrEqual(before.totalVideos + 2);
    expect(after.totalWatchHours).toBeGreaterThanOrEqual(before.totalWatchHours + 1.5);

    await prisma.room.updateMany({ where: { id: { in: [firstId, secondId] } }, data: { status: "ended" } });
    const ended = (await app.inject({ method: "GET", url: "/stats/global" })).json() as typeof before;
    expect(ended.activeRooms).toBeLessThan(after.activeRooms);
    expect(ended.usersOnline).toBeLessThanOrEqual(after.usersOnline);

    await prisma.roomMember.updateMany({
      where: { roomId: { in: [firstId, secondId] }, userId: { in: [hostId, guestId] } },
      data: { leftAt: new Date() },
    });
    const left = (await app.inject({ method: "GET", url: "/stats/global" })).json() as typeof before;
    expect(left.usersOnline).toBeLessThan(after.usersOnline);

    await prisma.room.deleteMany({ where: { id: { in: [firstId, secondId] } } });
    await prisma.user.deleteMany({ where: { id: { in: [hostId, guestId] } } });
    await prisma.$disconnect();
  });
});
