import { afterEach, describe, expect, it } from "vitest";
import { createPrismaClient } from "@lume/db";
import { buildApp } from "../app.js";
import { loadApiEnv } from "../env.js";

const databaseUrl = "postgresql://lume:lume@127.0.0.1:5432/lume?schema=public";

describe("player recovery", () => {
  let app: Awaited<ReturnType<typeof buildApp>> | undefined;

  afterEach(async () => {
    await app?.close();
  });

  it("stores a retry recovery for the failed url", async () => {
    process.env.DATABASE_URL = databaseUrl;
    const prisma = createPrismaClient();
    const env = loadApiEnv({
      NODE_ENV: "test",
      DATABASE_URL: databaseUrl,
      JWT_SECRET: "recovery-test-secret",
      ALLOW_STUB_AUTH: "true",
      WEB_ORIGIN: "http://127.0.0.1:5173",
    });
    app = await buildApp(env, { prisma });
    const login = await app.inject({ method: "POST", url: "/auth/dev", payload: { displayName: `Recover ${Date.now().toString(36)}` } });
    const token = login.json().accessToken as string;
    const created = await app.inject({
      method: "POST",
      url: "/rooms",
      headers: { authorization: `Bearer ${token}` },
      payload: { title: "Ошибка", isPublic: true },
    });
    const roomId = created.json().room.id as string;
    const posted = await app.inject({
      method: "POST",
      url: `/rooms/${roomId}/recovery`,
      headers: { authorization: `Bearer ${token}` },
      payload: { action: "retry", url: "http://127.0.0.1:3001/health" },
    });
    expect(posted.statusCode).toBe(200);
    const stored = await prisma.moderationAction.findFirst({ where: { roomId, action: "recovery:retry" } });
    expect(stored?.detail).toBe("http://127.0.0.1:3001/health");
    await prisma.moderationAction.deleteMany({ where: { roomId, action: { startsWith: "recovery:" } } });
    await prisma.$disconnect();
  });
});
