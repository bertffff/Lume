import { afterEach, describe, expect, it } from "vitest";
import { createPrismaClient } from "@lume/db";
import { buildApp } from "../app.js";
import { loadApiEnv } from "../env.js";

const databaseUrl = "postgresql://lume:lume@127.0.0.1:5432/lume_test?schema=public";

describe("premium extraction gate", () => {
  let app: Awaited<ReturnType<typeof buildApp>> | undefined;

  afterEach(async () => {
    await app?.close();
  });

  it("refuses extraction-only sources for a free account and allows them after premium is saved", async () => {
    process.env.DATABASE_URL = databaseUrl;
    const prisma = createPrismaClient();
    const env = loadApiEnv({
      NODE_ENV: "test",
      DATABASE_URL: databaseUrl,
      JWT_SECRET: "premium-gate-test-secret",
      ALLOW_STUB_AUTH: "true",
      WEB_ORIGIN: "http://127.0.0.1:5173",
    });
    app = await buildApp(env, { prisma });
    const stamp = Date.now().toString(36);
    const host = await app.inject({ method: "POST", url: "/auth/dev", payload: { displayName: `Premium ${stamp}` } });
    const token = host.json().accessToken as string;
    const userId = host.json().user.id as string;
    const created = await app.inject({
      method: "POST",
      url: "/rooms",
      headers: { authorization: `Bearer ${token}` },
      payload: { title: `Premium ${stamp}` },
    });
    const roomId = created.json().room.id as string;
    const tiktok = "https://www.tiktok.com/@lume/video/7300000000000000000";

    const free = await app.inject({
      method: "POST",
      url: `/rooms/${roomId}/queue`,
      headers: { authorization: `Bearer ${token}` },
      payload: { url: tiktok },
    });
    expect(free.statusCode).toBe(403);
    expect(free.json()).toMatchObject({ error: "premium_required", source: "tiktok" });
    expect(await prisma.queueItem.count({ where: { roomId } })).toBe(0);

    const direct = await app.inject({
      method: "POST",
      url: `/rooms/${roomId}/queue`,
      headers: { authorization: `Bearer ${token}` },
      payload: { url: "https://cdn.example.com/free.mp4" },
    });
    expect(direct.statusCode).toBe(200);

    const resolveFree = await app.inject({
      method: "POST",
      url: "/video/resolve",
      headers: { authorization: `Bearer ${token}` },
      payload: { url: tiktok, premium: true },
    });
    expect(resolveFree.statusCode).toBe(200);
    expect(resolveFree.json()).toMatchObject({ type: "error", code: "premium_required" });

    await prisma.user.update({ where: { id: userId }, data: { isPremium: true } });
    const paid = await app.inject({
      method: "POST",
      url: `/rooms/${roomId}/queue`,
      headers: { authorization: `Bearer ${token}` },
      payload: { url: tiktok },
    });
    expect(paid.statusCode).toBe(200);
    const stored = await prisma.queueItem.findFirst({ where: { roomId, url: tiktok } });
    expect(stored).not.toBeNull();
    expect(stored?.title).toBeTruthy();

    const resolvePaid = await app.inject({
      method: "POST",
      url: "/video/resolve",
      headers: { authorization: `Bearer ${token}` },
      payload: { url: tiktok },
    });
    expect(resolvePaid.statusCode).toBe(200);
    expect(resolvePaid.json()).toMatchObject({ type: "extract", extraction: "disabled" });

    await prisma.room.deleteMany({ where: { id: roomId } });
    await prisma.user.deleteMany({ where: { id: userId } });
    await prisma.$disconnect();
  });
});
