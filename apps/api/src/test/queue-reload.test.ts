import { afterEach, describe, expect, it } from "vitest";
import { createPrismaClient } from "@lume/db";
import { buildApp } from "../app.js";
import { loadApiEnv } from "../env.js";

const databaseUrl = "postgresql://lume:lume@127.0.0.1:5432/lume?schema=public";

describe("queue reload from persisted history", () => {
  let app: Awaited<ReturnType<typeof buildApp>> | undefined;

  afterEach(async () => {
    await app?.close();
  });

  it("puts a played history row back into the live queue and rejects a duplicate", async () => {
    process.env.DATABASE_URL = databaseUrl;
    const prisma = createPrismaClient();
    const env = loadApiEnv({
      NODE_ENV: "test",
      DATABASE_URL: databaseUrl,
      JWT_SECRET: "queue-reload-test-secret",
      ALLOW_STUB_AUTH: "true",
      WEB_ORIGIN: "http://127.0.0.1:5173",
    });
    app = await buildApp(env, { prisma });
    const stamp = Date.now().toString(36);
    const host = await app.inject({ method: "POST", url: "/auth/dev", payload: { displayName: `Reload ${stamp}` } });
    const hostToken = host.json().accessToken as string;
    const hostId = host.json().user.id as string;
    const created = await app.inject({
      method: "POST",
      url: "/rooms",
      headers: { authorization: `Bearer ${hostToken}` },
      payload: { title: `Reload ${stamp}` },
    });
    const roomId = created.json().room.id as string;

    const guest = await app.inject({ method: "POST", url: "/auth/dev", payload: { displayName: `Reload guest ${stamp}` } });
    const guestToken = guest.json().accessToken as string;
    const guestId = guest.json().user.id as string;

    const url = `https://cdn.example.com/reload-${stamp}.mp4`;
    const added = await app.inject({
      method: "POST",
      url: `/rooms/${roomId}/queue`,
      headers: { authorization: `Bearer ${hostToken}` },
      payload: { url },
    });
    expect(added.statusCode).toBe(200);
    const played = await app.inject({
      method: "POST",
      url: `/rooms/${roomId}/queue/next`,
      headers: { authorization: `Bearer ${hostToken}` },
      payload: {},
    });
    expect(played.statusCode).toBe(200);
    const historyRow = await prisma.roomHistoryItem.findFirst({ where: { roomId, url } });
    expect(historyRow).not.toBeNull();
    expect(await prisma.queueItem.count({ where: { roomId, played: true } })).toBe(1);

    const forbidden = await app.inject({
      method: "POST",
      url: `/rooms/${roomId}/queue/reload`,
      headers: { authorization: `Bearer ${guestToken}` },
      payload: { historyId: historyRow!.id },
    });
    expect(forbidden.statusCode).toBe(403);

    const reloaded = await app.inject({
      method: "POST",
      url: `/rooms/${roomId}/queue/reload`,
      headers: { authorization: `Bearer ${hostToken}` },
      payload: { historyId: historyRow!.id },
    });
    expect(reloaded.statusCode).toBe(200);
    const queue = reloaded.json().queue as Array<{ url: string; title: string; played?: boolean }>;
    expect(queue.some((item) => item.url === url)).toBe(true);
    const created2 = await prisma.queueItem.findFirst({ where: { roomId, url, played: false } });
    expect(created2).not.toBeNull();
    expect(created2?.title).toBe(historyRow?.title);
    expect(await prisma.queueItem.count({ where: { roomId, url } })).toBe(2);

    const duplicate = await app.inject({
      method: "POST",
      url: `/rooms/${roomId}/queue/reload`,
      headers: { authorization: `Bearer ${hostToken}` },
      payload: { historyId: historyRow!.id },
    });
    expect(duplicate.statusCode).toBe(409);
    expect(await prisma.queueItem.count({ where: { roomId, url } })).toBe(2);

    await prisma.room.deleteMany({ where: { id: roomId } });
    await prisma.user.deleteMany({ where: { id: { in: [hostId, guestId] } } });
    await prisma.$disconnect();
  });
});
