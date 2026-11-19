import { afterEach, describe, expect, it } from "vitest";
import { createPrismaClient } from "@lume/db";
import { buildApp } from "../app.js";
import { loadApiEnv } from "../env.js";

const databaseUrl = "postgresql://lume:lume@127.0.0.1:5432/lume?schema=public";

describe("queue recommendations", () => {
  let app: Awaited<ReturnType<typeof buildApp>> | undefined;

  afterEach(async () => {
    await app?.close();
  });

  it("offers watched videos that are not already waiting, then persists the chosen one", async () => {
    process.env.DATABASE_URL = databaseUrl;
    const prisma = createPrismaClient();
    const env = loadApiEnv({
      NODE_ENV: "test",
      DATABASE_URL: databaseUrl,
      JWT_SECRET: "recommendations-test-secret",
      ALLOW_STUB_AUTH: "true",
      WEB_ORIGIN: "http://127.0.0.1:5173",
    });
    app = await buildApp(env, { prisma });
    const stamp = Date.now().toString(36);
    const host = await app.inject({ method: "POST", url: "/auth/dev", payload: { displayName: `Rec ${stamp}` } });
    const token = host.json().accessToken as string;
    const userId = host.json().user.id as string;
    const created = await app.inject({
      method: "POST",
      url: "/rooms",
      headers: { authorization: `Bearer ${token}` },
      payload: { title: `Rec ${stamp}` },
    });
    const roomId = created.json().room.id as string;

    const waiting = `https://cdn.example.com/waiting-${stamp}.mp4`;
    const replay = `https://cdn.example.com/replay-${stamp}.mp4`;
    await prisma.watchHistory.createMany({
      data: [
        { userId, videoUrl: waiting, title: "Уже в очереди", source: "direct", watchCount: 1 },
        { userId, videoUrl: replay, title: "Посмотреть снова", source: "direct", watchCount: 2 },
      ],
    });
    await app.inject({
      method: "POST",
      url: `/rooms/${roomId}/queue`,
      headers: { authorization: `Bearer ${token}` },
      payload: { url: waiting },
    });

    const discovery = await app.inject({
      method: "GET",
      url: `/me/discovery?roomId=${roomId}`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(discovery.statusCode).toBe(200);
    const items = discovery.json().items as Array<{ url: string; title: string | null; reason: string }>;
    expect(items.some((item) => item.url === waiting)).toBe(false);
    const suggested = items.find((item) => item.url === replay);
    expect(suggested).toMatchObject({ title: "Посмотреть снова", reason: "favorite" });

    const added = await app.inject({
      method: "POST",
      url: `/rooms/${roomId}/queue`,
      headers: { authorization: `Bearer ${token}` },
      payload: { url: suggested!.url, title: suggested!.title },
    });
    expect(added.statusCode).toBe(200);
    const queue = added.json().queue as Array<{ url: string; title: string; played: boolean }>;
    expect(queue.some((item) => item.url === replay && item.played === false)).toBe(true);
    const persisted = await prisma.queueItem.findFirst({ where: { roomId, url: replay, played: false } });
    expect(persisted?.title).toBe("Посмотреть снова");

    await prisma.room.deleteMany({ where: { id: roomId } });
    await prisma.user.deleteMany({ where: { id: userId } });
    await prisma.$disconnect();
  });
});
