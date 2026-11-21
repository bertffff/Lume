import { afterEach, describe, expect, it } from "vitest";
import { createPrismaClient } from "@lume/db";
import { buildApp } from "../app.js";
import { loadApiEnv } from "../env.js";

import { apiTestDatabaseUrl } from "./api-test-database.js";

const databaseUrl = apiTestDatabaseUrl();

describe("global blacklist management", () => {
  let app: Awaited<ReturnType<typeof buildApp>> | undefined;

  afterEach(async () => {
    await app?.close();
  });

  it("lists, persists, and removes a global ban separately from a friend block", async () => {
    process.env.DATABASE_URL = databaseUrl;
    const prisma = createPrismaClient();
    const env = loadApiEnv({
      NODE_ENV: "test",
      DATABASE_URL: databaseUrl,
      JWT_SECRET: "blacklist-test-secret",
      ALLOW_STUB_AUTH: "true",
      WEB_ORIGIN: "http://127.0.0.1:5173",
    });
    app = await buildApp(env, { prisma });
    const stamp = Date.now().toString(36);
    const hostLogin = await app.inject({ method: "POST", url: "/auth/dev", payload: { displayName: `Blacklist host ${stamp}` } });
    const guestLogin = await app.inject({ method: "POST", url: "/auth/dev", payload: { displayName: `Blacklist guest ${stamp}` } });
    const friendLogin = await app.inject({ method: "POST", url: "/auth/dev", payload: { displayName: `Blacklist friend ${stamp}` } });
    const host = hostLogin.json() as { accessToken: string; user: { id: string } };
    const guest = guestLogin.json() as { accessToken: string; user: { id: string } };
    const friend = friendLogin.json() as { accessToken: string; user: { id: string } };

    const created = await app.inject({
      method: "POST",
      url: "/rooms",
      headers: { authorization: `Bearer ${host.accessToken}` },
      payload: { title: `Blacklist ${stamp}` },
    });
    expect(created.statusCode).toBe(200);
    const room = created.json() as { room: { id: string; code: string } };
    const joined = await app.inject({
      method: "POST",
      url: "/rooms/join",
      headers: { authorization: `Bearer ${guest.accessToken}` },
      payload: { code: room.room.code },
    });
    expect(joined.statusCode).toBe(200);

    const banned = await app.inject({
      method: "POST",
      url: `/rooms/${room.room.id}/ban`,
      headers: { authorization: `Bearer ${host.accessToken}` },
      payload: { userId: guest.user.id, type: "blacklist", reason: "спам в зале" },
    });
    expect(banned.statusCode).toBe(200);

    const row = await prisma.ban.findFirst({
      where: { ownerId: host.user.id, userId: guest.user.id, type: "blacklist" },
    });
    expect(row).not.toBeNull();
    expect(row?.roomId).toBeNull();

    const blockedFriend = await app.inject({
      method: "POST",
      url: "/friends/block",
      headers: { authorization: `Bearer ${host.accessToken}` },
      payload: { userId: friend.user.id },
    });
    expect(blockedFriend.statusCode).toBe(200);

    const list = await app.inject({
      method: "GET",
      url: `/users/${host.user.id}/blacklist`,
      headers: { authorization: `Bearer ${host.accessToken}` },
    });
    expect(list.statusCode).toBe(200);
    const entries = list.json().entries as Array<{ id: string; userId: string; displayName: string; reason: string | null }>;
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ userId: guest.user.id, reason: "спам в зале" });
    expect(entries[0]?.displayName).toContain("Blacklist guest");
    expect(entries.some((entry) => entry.userId === friend.user.id)).toBe(false);

    const friendList = await app.inject({
      method: "GET",
      url: "/friends",
      headers: { authorization: `Bearer ${host.accessToken}` },
    });
    const blocked = friendList.json().blocked as Array<{ userId: string }>;
    expect(blocked.some((item) => item.userId === friend.user.id)).toBe(true);
    expect(blocked.some((item) => item.userId === guest.user.id)).toBe(false);
    expect(entries.some((entry) => entry.userId === blocked[0]?.userId)).toBe(false);

    const forbidden = await app.inject({
      method: "GET",
      url: `/users/${host.user.id}/blacklist`,
      headers: { authorization: `Bearer ${guest.accessToken}` },
    });
    expect(forbidden.statusCode).toBe(403);

    const rejected = await app.inject({
      method: "POST",
      url: "/rooms/join",
      headers: { authorization: `Bearer ${guest.accessToken}` },
      payload: { code: room.room.code },
    });
    expect(rejected.statusCode).toBe(403);
    expect(rejected.json().error).toBe("banned");

    const removed = await app.inject({
      method: "POST",
      url: `/users/${host.user.id}/blacklist/remove`,
      headers: { authorization: `Bearer ${host.accessToken}` },
      payload: { bannedUserId: guest.user.id },
    });
    expect(removed.statusCode).toBe(200);

    const lifted = await prisma.ban.findUnique({ where: { id: row?.id ?? "" } });
    expect(lifted?.liftedAt).not.toBeNull();

    const empty = await app.inject({
      method: "GET",
      url: `/users/${host.user.id}/blacklist`,
      headers: { authorization: `Bearer ${host.accessToken}` },
    });
    expect(empty.json().entries).toHaveLength(0);

    const rejoined = await app.inject({
      method: "POST",
      url: "/rooms/join",
      headers: { authorization: `Bearer ${guest.accessToken}` },
      payload: { code: room.room.code },
    });
    expect(rejoined.statusCode).toBe(200);

    await prisma.ban.deleteMany({ where: { ownerId: host.user.id } });
    await prisma.friendship.deleteMany({ where: { OR: [{ requesterId: host.user.id }, { addresseeId: host.user.id }] } });
    await prisma.room.deleteMany({ where: { id: room.room.id } });
    await prisma.user.deleteMany({ where: { id: { in: [host.user.id, guest.user.id, friend.user.id] } } });
    await prisma.$disconnect();
  });
});
