import { afterEach, describe, expect, it } from "vitest";
import { createPrismaClient } from "@lume/db";
import { buildApp } from "../app.js";
import { loadApiEnv } from "../env.js";

const databaseUrl = "postgresql://lume:lume@127.0.0.1:5432/lume_test?schema=public";

describe("watch history", () => {
  let app: Awaited<ReturnType<typeof buildApp>> | undefined;

  afterEach(async () => {
    await app?.close();
  });

  it("lists persisted watch history and refuses it when privacy is off", async () => {
    process.env.DATABASE_URL = databaseUrl;
    const prisma = createPrismaClient();
    const env = loadApiEnv({
      NODE_ENV: "test",
      DATABASE_URL: databaseUrl,
      JWT_SECRET: "watch-history-test-secret",
      ALLOW_STUB_AUTH: "true",
      WEB_ORIGIN: "http://127.0.0.1:5173",
    });
    app = await buildApp(env, { prisma });
    const server = app;
    const stamp = Date.now().toString(36);
    const ownerLogin = await app.inject({ method: "POST", url: "/auth/dev", payload: { displayName: `History owner ${stamp}` } });
    const ownerToken = ownerLogin.json().accessToken as string;
    const ownerId = ownerLogin.json().user.id as string;
    const created = await app.inject({
      method: "POST",
      url: "/rooms",
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: { title: `History ${stamp}` },
    });
    const roomId = created.json().room.id as string;
    const videoUrl = `https://cdn.example.com/watched-${stamp}.mp4`;
    const secondUrl = `https://cdn.example.com/second-${stamp}.mp4`;
    const thirdUrl = `https://cdn.example.com/third-${stamp}.mp4`;

    const play = async (room: string, url: string) => {
      await server.inject({
        method: "POST",
        url: `/rooms/${room}/queue`,
        headers: { authorization: `Bearer ${ownerToken}` },
        payload: { url },
      });
      const played = await server.inject({
        method: "POST",
        url: `/rooms/${room}/queue/next`,
        headers: { authorization: `Bearer ${ownerToken}` },
        payload: {},
      });
      expect(played.statusCode).toBe(200);
    };

    await play(roomId, videoUrl);
    const second = await app.inject({
      method: "POST",
      url: "/rooms",
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: { title: `History two ${stamp}` },
    });
    const secondRoomId = second.json().room.id as string;
    await play(secondRoomId, secondUrl);
    await play(secondRoomId, videoUrl);
    await play(secondRoomId, thirdUrl);
    expect(await prisma.watchHistory.count({ where: { userId: ownerId } })).toBe(3);

    const ownerView = await app.inject({
      method: "GET",
      url: `/users/${ownerId}/watch-history`,
      headers: { authorization: `Bearer ${ownerToken}` },
    });
    expect(ownerView.statusCode).toBe(200);
    expect(ownerView.json().items.map((item: { url: string }) => item.url)).toEqual([thirdUrl, videoUrl, secondUrl]);
    expect(ownerView.json().items[1]).toMatchObject({ url: videoUrl, watchCount: 2 });
    expect(ownerView.json().items[2]).toMatchObject({ url: secondUrl, watchCount: 1 });

    const viewerLogin = await app.inject({ method: "POST", url: "/auth/dev", payload: { displayName: `History viewer ${stamp}` } });
    const viewerToken = viewerLogin.json().accessToken as string;
    const viewerId = viewerLogin.json().user.id as string;
    const publicView = await app.inject({
      method: "GET",
      url: `/users/${ownerId}/watch-history`,
      headers: { authorization: `Bearer ${viewerToken}` },
    });
    expect(publicView.statusCode).toBe(200);
    expect(publicView.json().items.map((item: { url: string }) => item.url)).toEqual([thirdUrl, videoUrl, secondUrl]);

    const hidden = await app.inject({
      method: "PATCH",
      url: "/me",
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: { isWatchHistoryPublic: false },
    });
    expect(hidden.statusCode).toBe(200);

    const blocked = await app.inject({
      method: "GET",
      url: `/users/${ownerId}/watch-history`,
      headers: { authorization: `Bearer ${viewerToken}` },
    });
    expect(blocked.statusCode).toBe(403);
    expect(blocked.json()).toMatchObject({ error: "watch_history_private" });

    const stillOwner = await app.inject({
      method: "GET",
      url: `/users/${ownerId}/watch-history`,
      headers: { authorization: `Bearer ${ownerToken}` },
    });
    expect(stillOwner.statusCode).toBe(200);
    expect(stillOwner.json().items).toHaveLength(3);

    await prisma.room.deleteMany({ where: { id: { in: [roomId, secondRoomId] } } });
    await prisma.watchHistory.deleteMany({ where: { userId: ownerId } });
    await prisma.user.deleteMany({ where: { id: { in: [ownerId, viewerId] } } });
    await prisma.$disconnect();
  });
});
