import { afterEach, describe, expect, it } from "vitest";
import { createPrismaClient } from "@lume/db";
import { buildApp } from "../app.js";
import { loadApiEnv } from "../env.js";

const databaseUrl = "postgresql://lume:lume@127.0.0.1:5432/lume?schema=public";

describe("session dock", () => {
  let app: Awaited<ReturnType<typeof buildApp>> | undefined;

  afterEach(async () => {
    await app?.close();
  });

  it("serves the persisted session summary and stores the reminder", async () => {
    process.env.DATABASE_URL = databaseUrl;
    const prisma = createPrismaClient();
    const env = loadApiEnv({
      NODE_ENV: "test",
      DATABASE_URL: databaseUrl,
      JWT_SECRET: "session-dock-test-secret",
      ALLOW_STUB_AUTH: "true",
      WEB_ORIGIN: "http://127.0.0.1:5173",
    });
    app = await buildApp(env, { prisma });
    const stamp = Date.now().toString(36);

    const host = await app.inject({ method: "POST", url: "/auth/dev", payload: { displayName: `Dock ${stamp}` } });
    const hostToken = host.json().accessToken as string;
    const hostId = host.json().user.id as string;
    const created = await app.inject({
      method: "POST",
      url: "/rooms",
      headers: { authorization: `Bearer ${hostToken}` },
      payload: { title: `Dock ${stamp}` },
    });
    const roomId = created.json().room.id as string;
    const code = created.json().room.code as string;

    const one = await app.inject({
      method: "GET",
      url: `/rooms/${roomId}/session`,
      headers: { authorization: `Bearer ${hostToken}` },
    });
    expect(one.statusCode).toBe(200);
    expect(one.json()).toMatchObject({ roomId, code, role: "host", memberCount: 1 });
    expect(one.json().elapsedSeconds).toBeGreaterThanOrEqual(0);
    expect(Number.isNaN(Date.parse(one.json().startedAt as string))).toBe(false);
    expect(
      Math.abs((Date.now() - Date.parse(one.json().startedAt as string)) / 1000 - (one.json().elapsedSeconds as number)),
    ).toBeLessThan(5);

    const guest = await app.inject({ method: "POST", url: "/auth/dev", payload: { displayName: `Dock guest ${stamp}` } });
    const guestToken = guest.json().accessToken as string;
    const guestId = guest.json().user.id as string;
    const joined = await app.inject({
      method: "POST",
      url: "/rooms/join",
      headers: { authorization: `Bearer ${guestToken}` },
      payload: { code },
    });
    expect(joined.statusCode).toBe(200);

    const two = await app.inject({
      method: "GET",
      url: `/rooms/${roomId}/session`,
      headers: { authorization: `Bearer ${guestToken}` },
    });
    expect(two.statusCode).toBe(200);
    expect(two.json()).toMatchObject({ memberCount: 2, role: "viewer" });

    const reminder = await app.inject({
      method: "POST",
      url: `/rooms/${roomId}/reminders`,
      headers: { authorization: `Bearer ${hostToken}` },
      payload: { minutes: 30 },
    });
    expect(reminder.statusCode).toBe(200);
    const queued = await prisma.notificationDeliveryQueue.findFirst({
      where: { userId: hostId, kind: "SYSTEM" },
      orderBy: { scheduledFor: "desc" },
    });
    expect(queued).not.toBeNull();
    expect(queued?.notificationId).toBeTruthy();
    expect((queued?.scheduledFor.getTime() ?? 0) > Date.now()).toBe(true);

    const left = await app.inject({
      method: "POST",
      url: `/rooms/${roomId}/leave`,
      headers: { authorization: `Bearer ${guestToken}` },
      payload: {},
    });
    expect(left.statusCode).toBe(200);
    const afterLeave = await app.inject({
      method: "GET",
      url: `/rooms/${roomId}/session`,
      headers: { authorization: `Bearer ${hostToken}` },
    });
    expect(afterLeave.json().memberCount).toBe(1);

    await prisma.room.deleteMany({ where: { id: roomId } });
    await prisma.user.deleteMany({ where: { id: { in: [hostId, guestId] } } });
    await prisma.$disconnect();
  });
});
