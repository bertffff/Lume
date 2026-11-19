import { afterEach, describe, expect, it } from "vitest";
import { createPrismaClient } from "@lume/db";
import { buildApp } from "../app.js";
import { loadApiEnv } from "../env.js";

const databaseUrl = "postgresql://lume:lume@127.0.0.1:5432/lume_test?schema=public";

describe("unread anchor", () => {
  let app: Awaited<ReturnType<typeof buildApp>> | undefined;

  afterEach(async () => {
    await app?.close();
  });

  it("keeps chat history in order so the live room can anchor the first unread line", async () => {
    process.env.DATABASE_URL = databaseUrl;
    const prisma = createPrismaClient();
    const env = loadApiEnv({
      NODE_ENV: "test",
      DATABASE_URL: databaseUrl,
      JWT_SECRET: "unread-test-secret",
      ALLOW_STUB_AUTH: "true",
      WEB_ORIGIN: "http://127.0.0.1:5173",
    });
    app = await buildApp(env, { prisma });
    const stamp = Date.now().toString(36);
    const hostLogin = await app.inject({ method: "POST", url: "/auth/dev", payload: { displayName: `Host ${stamp}` } });
    const guestLogin = await app.inject({ method: "POST", url: "/auth/dev", payload: { displayName: `Guest ${stamp}` } });
    const hostToken = hostLogin.json().accessToken as string;
    const guestToken = guestLogin.json().accessToken as string;
    const guestId = guestLogin.json().user.id as string;

    const created = await app.inject({
      method: "POST",
      url: "/rooms",
      headers: { authorization: `Bearer ${hostToken}` },
      payload: { title: `Unread ${stamp}`, isPublic: true },
    });
    const roomId = created.json().room.id as string;

    const joined = await app.inject({
      method: "POST",
      url: "/rooms/join",
      headers: { authorization: `Bearer ${guestToken}` },
      payload: { code: created.json().room.code },
    });
    expect(joined.statusCode).toBe(200);

    for (const body of ["первое непрочитанное", "второе непрочитанное"]) {
      const posted = await app.inject({
        method: "POST",
        url: `/rooms/${roomId}/messages`,
        headers: { authorization: `Bearer ${guestToken}` },
        payload: { body },
      });
      expect(posted.statusCode).toBe(200);
    }

    const detail = await app.inject({
      method: "GET",
      url: `/rooms/${roomId}`,
      headers: { authorization: `Bearer ${hostToken}` },
    });
    expect(detail.statusCode).toBe(200);
    const messages = detail.json().messages as Array<{ body: string; userId: string }>;
    const first = messages.findIndex((message) => message.body === "первое непрочитанное");
    const second = messages.findIndex((message) => message.body === "второе непрочитанное");
    expect(first).toBeGreaterThanOrEqual(0);
    expect(second).toBe(first + 1);
    expect(messages[first]?.userId).toBe(guestId);

    const stored = await prisma.message.count({
      where: { roomId, body: { in: ["первое непрочитанное", "второе непрочитанное"] } },
    });
    expect(stored).toBe(2);

    await prisma.room.deleteMany({ where: { id: roomId } });
    await prisma.user.deleteMany({ where: { displayName: { in: [`Host ${stamp}`, `Guest ${stamp}`] } } });
    await prisma.$disconnect();
  });
});
