import { afterEach, describe, expect, it } from "vitest";
import { createPrismaClient } from "@lume/db";
import { buildApp } from "../app.js";
import { loadApiEnv } from "../env.js";

const databaseUrl = "postgresql://lume:lume@127.0.0.1:5432/lume?schema=public";

describe("queue history", () => {
  let app: Awaited<ReturnType<typeof buildApp>> | undefined;

  afterEach(async () => {
    await app?.close();
  });

  it("keeps the last fifty played items and lets only the host clear them", async () => {
    process.env.DATABASE_URL = databaseUrl;
    const prisma = createPrismaClient();
    const env = loadApiEnv({
      NODE_ENV: "test",
      DATABASE_URL: databaseUrl,
      JWT_SECRET: "queue-history-test-secret",
      ALLOW_STUB_AUTH: "true",
      WEB_ORIGIN: "http://127.0.0.1:5173",
    });
    app = await buildApp(env, { prisma });
    const stamp = Date.now().toString(36);
    const host = await app.inject({ method: "POST", url: "/auth/dev", payload: { displayName: `History ${stamp}` } });
    const hostToken = host.json().accessToken as string;
    const hostId = host.json().user.id as string;
    const created = await app.inject({
      method: "POST",
      url: "/rooms",
      headers: { authorization: `Bearer ${hostToken}` },
      payload: { title: `History ${stamp}` },
    });
    const roomId = created.json().room.id as string;
    const code = created.json().room.code as string;

    const guest = await app.inject({ method: "POST", url: "/auth/dev", payload: { displayName: `History guest ${stamp}` } });
    const guestToken = guest.json().accessToken as string;
    const guestId = guest.json().user.id as string;
    await app.inject({
      method: "POST",
      url: "/rooms/join",
      headers: { authorization: `Bearer ${guestToken}` },
      payload: { code },
    });

    for (const name of ["one", "two"]) {
      const added = await app.inject({
        method: "POST",
        url: `/rooms/${roomId}/queue`,
        headers: { authorization: `Bearer ${hostToken}` },
        payload: { url: `https://cdn.example.com/${name}-${stamp}.mp4` },
      });
      expect(added.statusCode).toBe(200);
      const next = await app.inject({
        method: "POST",
        url: `/rooms/${roomId}/queue/next`,
        headers: { authorization: `Bearer ${hostToken}` },
        payload: {},
      });
      expect(next.statusCode).toBe(200);
    }

    const listed = await app.inject({
      method: "GET",
      url: `/rooms/${roomId}/history`,
      headers: { authorization: `Bearer ${hostToken}` },
    });
    expect(listed.statusCode).toBe(200);
    expect(listed.json().history).toHaveLength(2);
    expect(await prisma.roomHistoryItem.count({ where: { roomId } })).toBe(2);

    const guestClear = await app.inject({
      method: "DELETE",
      url: `/rooms/${roomId}/history`,
      headers: { authorization: `Bearer ${guestToken}` },
    });
    expect(guestClear.statusCode).toBe(403);
    expect(await prisma.roomHistoryItem.count({ where: { roomId } })).toBe(2);

    const cleared = await app.inject({
      method: "DELETE",
      url: `/rooms/${roomId}/history`,
      headers: { authorization: `Bearer ${hostToken}` },
    });
    expect(cleared.statusCode).toBe(200);
    expect(cleared.json()).toMatchObject({ ok: true, cleared: 2 });
    expect(await prisma.roomHistoryItem.count({ where: { roomId } })).toBe(0);
    const after = await app.inject({
      method: "GET",
      url: `/rooms/${roomId}/history`,
      headers: { authorization: `Bearer ${hostToken}` },
    });
    expect(after.json().history).toEqual([]);

    await prisma.roomHistoryItem.createMany({
      data: Array.from({ length: 55 }, (_, index) => ({
        roomId,
        url: `https://cdn.example.com/cap-${index}-${stamp}.mp4`,
        title: `Cap ${index}`,
        source: "direct",
      })),
    });
    const capped = await app.inject({
      method: "GET",
      url: `/rooms/${roomId}/history`,
      headers: { authorization: `Bearer ${hostToken}` },
    });
    expect(capped.json().history).toHaveLength(50);
    const cappedClear = await app.inject({
      method: "DELETE",
      url: `/rooms/${roomId}/history`,
      headers: { authorization: `Bearer ${hostToken}` },
    });
    expect(cappedClear.json()).toMatchObject({ ok: true, cleared: 55 });

    await prisma.room.deleteMany({ where: { id: roomId } });
    await prisma.user.deleteMany({ where: { id: { in: [hostId, guestId] } } });
    await prisma.$disconnect();
  });
});
