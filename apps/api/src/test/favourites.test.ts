import { afterEach, describe, expect, it } from "vitest";
import { createPrismaClient } from "@lume/db";
import { buildApp } from "../app.js";
import { loadApiEnv } from "../env.js";

const databaseUrl = "postgresql://lume:lume@127.0.0.1:5432/lume_test?schema=public";

describe("favourite videos", () => {
  let app: Awaited<ReturnType<typeof buildApp>> | undefined;

  afterEach(async () => {
    await app?.close();
  });

  it("promotes a video after its second watch and leaves single watches out", async () => {
    process.env.DATABASE_URL = databaseUrl;
    const prisma = createPrismaClient();
    const env = loadApiEnv({
      NODE_ENV: "test",
      DATABASE_URL: databaseUrl,
      JWT_SECRET: "favourites-test-secret",
      ALLOW_STUB_AUTH: "true",
      WEB_ORIGIN: "http://127.0.0.1:5173",
    });
    app = await buildApp(env, { prisma });
    const server = app;
    const stamp = Date.now().toString(36);
    const login = await server.inject({ method: "POST", url: "/auth/dev", payload: { displayName: `Favourites ${stamp}` } });
    const token = login.json().accessToken as string;
    const userId = login.json().user.id as string;
    const repeatUrl = `https://cdn.example.com/repeat-${stamp}.mp4`;
    const onceUrl = `https://cdn.example.com/once-${stamp}.mp4`;

    const createRoom = async (suffix: string) => {
      const created = await server.inject({
        method: "POST",
        url: "/rooms",
        headers: { authorization: `Bearer ${token}` },
        payload: { title: `Favourites ${suffix} ${stamp}` },
      });
      return created.json().room.id as string;
    };
    const play = async (roomId: string, url: string) => {
      const added = await server.inject({
        method: "POST",
        url: `/rooms/${roomId}/queue`,
        headers: { authorization: `Bearer ${token}` },
        payload: { url },
      });
      expect(added.statusCode).toBe(200);
      const next = await server.inject({
        method: "POST",
        url: `/rooms/${roomId}/queue/next`,
        headers: { authorization: `Bearer ${token}` },
        payload: {},
      });
      expect(next.statusCode).toBe(200);
    };

    const firstRoom = await createRoom("one");
    await play(firstRoom, onceUrl);
    await play(firstRoom, repeatUrl);
    const secondRoom = await createRoom("two");
    await play(secondRoom, repeatUrl);

    expect(await prisma.watchHistory.count({ where: { userId } })).toBe(2);
    expect(await prisma.watchHistory.findUnique({ where: { userId_videoUrl: { userId, videoUrl: repeatUrl } } })).toMatchObject({ watchCount: 2 });
    expect(await prisma.watchHistory.findUnique({ where: { userId_videoUrl: { userId, videoUrl: onceUrl } } })).toMatchObject({ watchCount: 1 });

    const favourites = await server.inject({
      method: "GET",
      url: "/me/favourites",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(favourites.statusCode).toBe(200);
    expect(favourites.json().items).toHaveLength(1);
    expect(favourites.json().items[0]).toMatchObject({
      url: repeatUrl,
      watchCount: 2,
      source: "direct",
    });
    expect(typeof favourites.json().items[0].lastWatchedAt).toBe("string");
    expect(favourites.json().items.map((item: { url: string }) => item.url)).not.toContain(onceUrl);

    await prisma.room.deleteMany({ where: { id: { in: [firstRoom, secondRoom] } } });
    await prisma.watchHistory.deleteMany({ where: { userId } });
    await prisma.user.deleteMany({ where: { id: userId } });
    await prisma.$disconnect();
  });
});
