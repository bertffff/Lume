import { afterEach, describe, expect, it } from "vitest";
import { createPrismaClient } from "@lume/db";
import { buildApp } from "../app.js";
import { loadApiEnv } from "../env.js";

import { apiTestDatabaseUrl } from "./api-test-database.js";

const databaseUrl = apiTestDatabaseUrl();

const defaults = { canChat: false, canQueue: true, canSpeak: false, canReact: true, canSeek: false, canInvite: true };

describe("room settings", () => {
  let app: Awaited<ReturnType<typeof buildApp>> | undefined;

  afterEach(async () => {
    await app?.close();
  });

  it("saves title, description, visibility, member cap, hide-reactions, and viewer defaults", async () => {
    process.env.DATABASE_URL = databaseUrl;
    const prisma = createPrismaClient();
    const env = loadApiEnv({
      NODE_ENV: "test",
      DATABASE_URL: databaseUrl,
      JWT_SECRET: "room-settings-test-secret",
      ALLOW_STUB_AUTH: "true",
      WEB_ORIGIN: "http://127.0.0.1:5173",
    });
    app = await buildApp(env, { prisma });
    const stamp = Date.now().toString(36);
    const host = await app.inject({ method: "POST", url: "/auth/dev", payload: { displayName: `Settings Host ${stamp}` } });
    const hostToken = host.json().accessToken as string;
    const hostId = host.json().user.id as string;
    const created = await app.inject({
      method: "POST",
      url: "/rooms",
      headers: { authorization: `Bearer ${hostToken}` },
      payload: { title: `Settings ${stamp}`, isPublic: false },
    });
    const roomId = created.json().room.id as string;

    const saved = await app.inject({
      method: "PATCH",
      url: `/rooms/${roomId}/settings`,
      headers: { authorization: `Bearer ${hostToken}` },
      payload: {
        title: `Ночной зал ${stamp}`,
        description: "Смотрим вместе",
        isPublic: true,
        maxMembers: 2,
        hideReactions: true,
        defaults,
      },
    });
    expect(saved.statusCode).toBe(200);
    expect(saved.json()).toMatchObject({
      title: `Ночной зал ${stamp}`,
      description: "Смотрим вместе",
      isPublic: true,
      maxMembers: 2,
      hideReactions: true,
      defaults,
    });

    const loaded = await app.inject({
      method: "GET",
      url: `/rooms/${roomId}/settings`,
      headers: { authorization: `Bearer ${hostToken}` },
    });
    expect(loaded.statusCode).toBe(200);
    expect(loaded.json().maxMembers).toBe(2);
    expect(loaded.json().hideReactions).toBe(true);

    const stored = await prisma.room.findUnique({ where: { id: roomId } });
    expect(stored?.title).toBe(`Ночной зал ${stamp}`);
    expect(stored?.description).toBe("Смотрим вместе");
    expect(stored?.isPublic).toBe(true);
    expect(stored?.maxMembers).toBe(2);
    expect(stored?.hideReactions).toBe(true);
    expect(stored?.defaultPermissions).toMatchObject(defaults);

    const first = await app.inject({ method: "POST", url: "/auth/dev", payload: { displayName: `Cap One ${stamp}` } });
    const second = await app.inject({ method: "POST", url: "/auth/dev", payload: { displayName: `Cap Two ${stamp}` } });
    const firstJoin = await app.inject({
      method: "POST",
      url: "/rooms/join",
      headers: { authorization: `Bearer ${first.json().accessToken}` },
      payload: { code: created.json().room.code },
    });
    expect(firstJoin.statusCode).toBe(200);
    const secondJoin = await app.inject({
      method: "POST",
      url: "/rooms/join",
      headers: { authorization: `Bearer ${second.json().accessToken}` },
      payload: { code: created.json().room.code },
    });
    expect(secondJoin.statusCode).toBe(409);
    expect(secondJoin.json().error).toBe("room_full");

    await prisma.room.deleteMany({ where: { id: roomId } });
    await prisma.user.deleteMany({
      where: { id: { in: [hostId, first.json().user.id as string, second.json().user.id as string] } },
    });
    await prisma.$disconnect();
  });

  it("applies the viewer defaults to a joining member without overrides", async () => {
    process.env.DATABASE_URL = databaseUrl;
    const prisma = createPrismaClient();
    const env = loadApiEnv({
      NODE_ENV: "test",
      DATABASE_URL: databaseUrl,
      JWT_SECRET: "room-settings-test-secret",
      ALLOW_STUB_AUTH: "true",
      WEB_ORIGIN: "http://127.0.0.1:5173",
    });
    app = await buildApp(env, { prisma });
    const stamp = Date.now().toString(36);
    const host = await app.inject({ method: "POST", url: "/auth/dev", payload: { displayName: `Defaults Host ${stamp}` } });
    const hostToken = host.json().accessToken as string;
    const hostId = host.json().user.id as string;
    const guest = await app.inject({ method: "POST", url: "/auth/dev", payload: { displayName: `Defaults Guest ${stamp}` } });
    const guestToken = guest.json().accessToken as string;
    const guestId = guest.json().user.id as string;
    const friend = await app.inject({ method: "POST", url: "/auth/dev", payload: { displayName: `Defaults Friend ${stamp}` } });
    const friendId = friend.json().user.id as string;

    const created = await app.inject({
      method: "POST",
      url: "/rooms",
      headers: { authorization: `Bearer ${hostToken}` },
      payload: { title: `Defaults ${stamp}`, isPublic: false },
    });
    const roomId = created.json().room.id as string;
    const code = created.json().room.code as string;

    const locked = { canChat: false, canQueue: false, canSpeak: false, canReact: false, canSeek: false, canInvite: false };
    const saved = await app.inject({
      method: "PATCH",
      url: `/rooms/${roomId}/settings`,
      headers: { authorization: `Bearer ${hostToken}` },
      payload: { defaults: locked },
    });
    expect(saved.statusCode).toBe(200);

    const joined = await app.inject({
      method: "POST",
      url: "/rooms/join",
      headers: { authorization: `Bearer ${guestToken}` },
      payload: { code },
    });
    expect(joined.statusCode).toBe(200);
    expect(joined.json().self.permissions).toMatchObject({
      canChat: false,
      canSpeak: false,
      canReact: false,
      canSeek: false,
      canInvite: false,
      canAddToQueue: false,
    });

    const member = await prisma.roomMember.findUnique({
      where: { roomId_userId: { roomId, userId: guestId } },
    });
    expect(member).toMatchObject({
      permissionsOverridden: false,
      canChat: false,
      canSpeak: false,
      canReact: false,
      canSeek: false,
      canInvite: false,
      canAddToQueue: false,
    });

    const hostMessage = await app.inject({
      method: "POST",
      url: `/rooms/${roomId}/messages`,
      headers: { authorization: `Bearer ${hostToken}` },
      payload: { body: "хост пишет" },
    });
    expect(hostMessage.statusCode).toBe(200);
    const messageId = hostMessage.json().id as string;

    const guestChat = await app.inject({
      method: "POST",
      url: `/rooms/${roomId}/messages`,
      headers: { authorization: `Bearer ${guestToken}` },
      payload: { body: "гость пишет" },
    });
    expect(guestChat.statusCode).toBe(403);
    expect(guestChat.json().error).toBe("forbidden");

    const guestReaction = await app.inject({
      method: "POST",
      url: `/rooms/${roomId}/reactions`,
      headers: { authorization: `Bearer ${guestToken}` },
      payload: { messageId, emoji: "🔥" },
    });
    expect(guestReaction.statusCode).toBe(403);

    const guestQueue = await app.inject({
      method: "POST",
      url: `/rooms/${roomId}/queue`,
      headers: { authorization: `Bearer ${guestToken}` },
      payload: { url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ" },
    });
    expect(guestQueue.statusCode).toBe(403);

    const guestInvite = await app.inject({
      method: "POST",
      url: `/rooms/${roomId}/invite`,
      headers: { authorization: `Bearer ${guestToken}` },
      payload: { userId: friendId },
    });
    expect(guestInvite.statusCode).toBe(403);

    const reopened = await app.inject({
      method: "POST",
      url: `/rooms/${roomId}/defaults`,
      headers: { authorization: `Bearer ${hostToken}` },
      payload: { canChat: true },
    });
    expect(reopened.statusCode).toBe(200);
    expect(reopened.json().defaults).toMatchObject({ ...locked, canChat: true });

    const retried = await app.inject({
      method: "POST",
      url: `/rooms/${roomId}/messages`,
      headers: { authorization: `Bearer ${guestToken}` },
      payload: { body: "теперь можно" },
    });
    expect(retried.statusCode).toBe(200);
    expect(retried.json().body).toBe("теперь можно");

    await prisma.room.deleteMany({ where: { id: roomId } });
    await prisma.user.deleteMany({ where: { id: { in: [hostId, guestId, friendId] } } });
    await prisma.$disconnect();
  });
});
