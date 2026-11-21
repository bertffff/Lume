import { afterEach, describe, expect, it } from "vitest";
import { createPrismaClient } from "@lume/db";
import { buildApp } from "../app.js";
import { loadApiEnv } from "../env.js";

import { apiTestDatabaseUrl } from "./api-test-database.js";

const databaseUrl = apiTestDatabaseUrl();

describe("in-room profile modal", () => {
  let app: Awaited<ReturnType<typeof buildApp>> | undefined;

  afterEach(async () => {
    await app?.close();
  });

  it("stores a friend request and a report from the profile card", async () => {
    process.env.DATABASE_URL = databaseUrl;
    const prisma = createPrismaClient();
    const env = loadApiEnv({
      NODE_ENV: "test",
      DATABASE_URL: databaseUrl,
      JWT_SECRET: "profile-modal-test-secret",
      ALLOW_STUB_AUTH: "true",
      WEB_ORIGIN: "http://127.0.0.1:5173",
    });
    app = await buildApp(env, { prisma });
    const stamp = Date.now().toString(36);
    const hostLogin = await app.inject({ method: "POST", url: "/auth/dev", payload: { displayName: `Card Host ${stamp}` } });
    const guestLogin = await app.inject({ method: "POST", url: "/auth/dev", payload: { displayName: `Card Guest ${stamp}` } });
    const hostToken = hostLogin.json().accessToken as string;
    const hostId = hostLogin.json().user.id as string;
    const guestToken = guestLogin.json().accessToken as string;
    const guestId = guestLogin.json().user.id as string;

    const created = await app.inject({
      method: "POST",
      url: "/rooms",
      headers: { authorization: `Bearer ${hostToken}` },
      payload: { title: `Profile ${stamp}`, isPublic: true },
    });
    const roomId = created.json().room.id as string;
    const joined = await app.inject({
      method: "POST",
      url: "/rooms/join",
      headers: { authorization: `Bearer ${guestToken}` },
      payload: { code: created.json().room.code },
    });
    expect(joined.statusCode).toBe(200);

    const friend = await app.inject({
      method: "POST",
      url: "/friends/request",
      headers: { authorization: `Bearer ${hostToken}` },
      payload: { userId: guestId },
    });
    expect(friend.statusCode).toBe(200);
    expect(friend.json().status).toBe("pending");
    const edge = await prisma.friendship.findFirst({ where: { requesterId: hostId, addresseeId: guestId } });
    expect(edge?.status).toBe("pending");
    const notice = await prisma.notification.findFirst({ where: { userId: guestId, kind: "FRIEND_REQUEST" } });
    expect(notice?.body).toBe(`Card Host ${stamp}`);

    const report = await app.inject({
      method: "POST",
      url: "/reports",
      headers: { authorization: `Bearer ${hostToken}` },
      payload: { targetKind: "user", targetId: guestId, roomId, reason: "мешает смотреть" },
    });
    expect(report.statusCode).toBe(200);
    const stored = await prisma.report.findFirst({ where: { reporterId: hostId, targetUserId: guestId, roomId } });
    expect(stored?.reason).toBe("мешает смотреть");

    await prisma.report.deleteMany({ where: { roomId } });
    await prisma.room.deleteMany({ where: { id: roomId } });
    await prisma.friendship.deleteMany({ where: { requesterId: hostId, addresseeId: guestId } });
    await prisma.user.deleteMany({ where: { id: { in: [hostId, guestId] } } });
    await prisma.$disconnect();
  });
});
