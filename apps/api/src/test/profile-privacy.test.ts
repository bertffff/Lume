import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createPrismaClient } from "@lume/db";
import { buildApp } from "../app.js";
import { mintAccessToken } from "../auth/jwt.js";
import { loadApiEnv } from "../env.js";
import { createRoomCode } from "../rooms/service.js";

const databaseUrl = process.env.PROFILE_PRIVACY_DATABASE_URL ?? "postgresql://lume:lume@127.0.0.1:5432/lume_test?schema=public";

describe("public profile privacy", () => {
  let app: Awaited<ReturnType<typeof buildApp>> | undefined;

  afterEach(async () => {
    await app?.close();
  });

  it("hides friends and watch history from every read route when the owner opts out", async () => {
    process.env.DATABASE_URL = databaseUrl;
    const prisma = createPrismaClient();
    const env = loadApiEnv({
      NODE_ENV: "test",
      DATABASE_URL: databaseUrl,
      JWT_SECRET: "profile-privacy-test-secret",
      ALLOW_STUB_AUTH: "true",
      WEB_ORIGIN: "http://127.0.0.1:5173",
    });
    app = await buildApp(env, { prisma });
    const server = app;
    const stamp = Date.now().toString(36);
    const ownerLogin = await server.inject({ method: "POST", url: "/auth/dev", payload: { displayName: `Privacy owner ${stamp}` } });
    const ownerToken = ownerLogin.json().accessToken as string;
    const ownerId = ownerLogin.json().user.id as string;
    const viewerLogin = await server.inject({ method: "POST", url: "/auth/dev", payload: { displayName: `Privacy viewer ${stamp}` } });
    const viewerToken = viewerLogin.json().accessToken as string;
    const viewerId = viewerLogin.json().user.id as string;

    const created = await server.inject({
      method: "POST",
      url: "/rooms",
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: { title: `Privacy ${stamp}` },
    });
    const roomId = created.json().room.id as string;
    const videoUrl = `https://cdn.example.com/private-${stamp}.mp4`;
    await server.inject({
      method: "POST",
      url: `/rooms/${roomId}/queue`,
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: { url: videoUrl },
    });
    await server.inject({
      method: "POST",
      url: `/rooms/${roomId}/queue/next`,
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: {},
    });

    const request = await server.inject({
      method: "POST",
      url: "/friends/request",
      headers: { authorization: `Bearer ${viewerToken}` },
      payload: { userId: ownerId },
    });
    expect(request.statusCode).toBe(200);
    const incoming = await server.inject({
      method: "GET",
      url: "/friends",
      headers: { authorization: `Bearer ${ownerToken}` },
    });
    const friendId = incoming.json().incoming[0].id as string;
    await server.inject({
      method: "POST",
      url: `/friends/${friendId}/accept`,
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: {},
    });

    const publicProfile = await server.inject({
      method: "GET",
      url: `/users/profile/${ownerId}`,
      headers: { authorization: `Bearer ${viewerToken}` },
    });
    expect(publicProfile.statusCode).toBe(200);
    expect(publicProfile.json().watchHistory).toHaveLength(1);
    expect(publicProfile.json().watchHistory[0]).toMatchObject({ url: videoUrl, watchCount: 1 });
    expect(publicProfile.json().friends.map((friend: { id: string }) => friend.id)).toEqual([viewerId]);
    expect(publicProfile.json().privacy).toMatchObject({ isFriendsPublic: true, isWatchHistoryPublic: true });

    const ownerFriends = await server.inject({
      method: "GET",
      url: `/users/${ownerId}/friends`,
      headers: { authorization: `Bearer ${viewerToken}` },
    });
    expect(ownerFriends.statusCode).toBe(200);
    expect(ownerFriends.json().friends.map((friend: { id: string }) => friend.id)).toEqual([viewerId]);

    const hidden = await server.inject({
      method: "PATCH",
      url: "/me",
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: { isFriendsPublic: false, isWatchHistoryPublic: false },
    });
    expect(hidden.statusCode).toBe(200);

    const privateProfile = await server.inject({
      method: "GET",
      url: `/users/profile/${ownerId}`,
      headers: { authorization: `Bearer ${viewerToken}` },
    });
    expect(privateProfile.statusCode).toBe(200);
    expect(privateProfile.json().friends).toBeNull();
    expect(privateProfile.json().watchHistory).toBeNull();
    expect(privateProfile.json().privacy).toMatchObject({ isFriendsPublic: false, isWatchHistoryPublic: false });

    const blockedFriends = await server.inject({
      method: "GET",
      url: `/users/${ownerId}/friends`,
      headers: { authorization: `Bearer ${viewerToken}` },
    });
    expect(blockedFriends.statusCode).toBe(403);
    expect(blockedFriends.json()).toMatchObject({ error: "friends_private" });

    const blockedHistory = await server.inject({
      method: "GET",
      url: `/users/${ownerId}/watch-history`,
      headers: { authorization: `Bearer ${viewerToken}` },
    });
    expect(blockedHistory.statusCode).toBe(403);

    const ownerStillSees = await server.inject({
      method: "GET",
      url: `/users/profile/${ownerId}`,
      headers: { authorization: `Bearer ${ownerToken}` },
    });
    expect(ownerStillSees.statusCode).toBe(200);
    expect(ownerStillSees.json().friends).not.toBeNull();
    expect(ownerStillSees.json().watchHistory).toHaveLength(1);

    const basic = await server.inject({
      method: "GET",
      url: `/users/${ownerId}`,
      headers: { authorization: `Bearer ${viewerToken}` },
    });
    expect(basic.statusCode).toBe(200);
    expect(basic.json().privacy).toMatchObject({ isFriendsPublic: false, isWatchHistoryPublic: false });

    await prisma.friendship.deleteMany({ where: { OR: [{ requesterId: ownerId }, { addresseeId: ownerId }] } });
    await prisma.room.deleteMany({ where: { id: roomId } });
    await prisma.watchHistory.deleteMany({ where: { userId: ownerId } });
    await prisma.user.deleteMany({ where: { id: { in: [ownerId, viewerId] } } });
    await prisma.$disconnect();
  });

  it("hides private and disallowed room presence", async () => {
    process.env.DATABASE_URL = databaseUrl;
    const prisma = createPrismaClient();
    const secret = randomUUID();
    const server = await buildApp(loadApiEnv({
      NODE_ENV: "test",
      DATABASE_URL: databaseUrl,
      REDIS_URL: process.env.PROFILE_PRIVACY_REDIS_URL,
      JWT_SECRET: secret,
    }), { prisma });
    const users: string[] = [];
    const rooms: string[] = [];
    const createUser = async (displayName: string) => {
      const user = await prisma.user.create({ data: { displayName } });
      users.push(user.id);
      const token = await mintAccessToken({ secret, userId: user.id, displayName, telegramId: null, ttlSeconds: 60 });
      return { id: user.id, headers: { authorization: `Bearer ${token}` } };
    };
    const read = async (url: string, headers?: { authorization: string }) => {
      const response = await server.inject({ method: "GET", url, ...(headers ? { headers } : {}) });
      expect(response.statusCode, url).toBe(200);
      return response.json();
    };
    try {
      const before = await read("/stats/global");
      const host = await createUser("Presence host");
      const viewer = await createUser("Presence friend");
      const room = await prisma.room.create({
        data: {
          slug: createRoomCode(),
          title: "Presence fixture",
          hostId: host.id,
          ownerId: host.id,
          isPublic: false,
          layout: {},
          members: { create: { userId: host.id, role: "host" } },
        },
      });
      rooms.push(room.id);
      const friendship = await prisma.friendship.create({
        data: { requesterId: viewer.id, addresseeId: host.id, status: "accepted" },
      });
      const profile = `/users/profile/${host.id}`;
      const user = `/users/${host.id}`;
      const hidden = { roomId: null, roomTitle: null };
      const visible = { roomId: room.id, roomTitle: room.title };
      const expectPresence = async (activity: typeof visible | null) => {
        expect(await read(profile, viewer.headers)).toMatchObject({ currentActivity: activity });
        expect(await read(user, viewer.headers)).toMatchObject(activity ?? hidden);
      };
      const expectFriendPresence = async (bucket: "friends" | "outgoing" | "blocked", expected: typeof visible | typeof hidden) => {
        const list = await read("/friends", viewer.headers);
        expect(list[bucket]).toContainEqual(expect.objectContaining({ userId: host.id, ...expected }));
      };

      await expectPresence(null);
      await expectFriendPresence("friends", hidden);
      const privateStats = JSON.stringify(await read("/stats"));
      expect(privateStats).not.toContain(room.id);
      expect(privateStats).not.toContain(room.title);
      expect(await read("/stats/global")).toEqual({
        usersOnline: before.usersOnline + 1,
        activeRooms: before.activeRooms + 1,
        totalVideos: before.totalVideos,
        totalWatchHours: before.totalWatchHours,
      });
      expect(await read(`/rooms/${room.id}`, host.headers)).toMatchObject({ room: { id: room.id, title: room.title, isPublic: false } });

      await prisma.room.update({ where: { id: room.id }, data: { isPublic: true } });
      await expectPresence(visible);
      await expectFriendPresence("friends", visible);
      expect((await read("/stats")).parties).toContainEqual({ id: room.id, title: room.title });
      expect(await read(profile)).toMatchObject({ currentActivity: null });
      expect(await read(user)).toMatchObject(hidden);
      expect(await read(profile, host.headers)).toMatchObject({ currentActivity: visible });

      const secondFriend = await createUser("Second presence friend");
      const reversePending = await prisma.friendship.create({
        data: { requesterId: secondFriend.id, addresseeId: viewer.id, status: "pending" },
      });
      await prisma.friendship.create({
        data: { requesterId: viewer.id, addresseeId: secondFriend.id, status: "accepted" },
      });
      await prisma.roomMember.create({ data: { roomId: room.id, userId: secondFriend.id, joinedAt: new Date(0) } });
      const expectBothFriends = async (secondActivity: typeof visible | typeof hidden) => {
        const list = await read("/friends", viewer.headers);
        expect(list.friends).toHaveLength(2);
        expect(list.friends).toEqual(expect.arrayContaining([
          expect.objectContaining({ userId: host.id, ...visible }),
          expect.objectContaining({ userId: secondFriend.id, ...secondActivity }),
        ]));
        return list;
      };
      const conflicting = await expectBothFriends(hidden);
      expect(conflicting.incoming).toContainEqual(expect.objectContaining({ userId: secondFriend.id, ...hidden }));
      await prisma.friendship.delete({ where: { id: reversePending.id } });

      const bansRead = vi.spyOn(prisma.ban, "findMany");
      const singleSeatRead = vi.spyOn(prisma.roomMember, "findFirst");
      const batchSeatRead = vi.spyOn(prisma.roomMember, "findMany");
      try {
        await expectBothFriends(visible);
        expect(bansRead).toHaveBeenCalledTimes(1);
        expect(singleSeatRead).not.toHaveBeenCalled();
        expect(batchSeatRead).toHaveBeenCalledTimes(1);
      } finally {
        bansRead.mockRestore();
        singleSeatRead.mockRestore();
        batchSeatRead.mockRestore();
      }

      const newerPrivateRoom = await prisma.room.create({
        data: {
          slug: createRoomCode(),
          title: "Newer private presence fixture",
          hostId: secondFriend.id,
          ownerId: secondFriend.id,
          isPublic: false,
          layout: {},
          members: { create: { userId: secondFriend.id, role: "host", joinedAt: new Date(1000) } },
        },
      });
      rooms.push(newerPrivateRoom.id);
      await expectBothFriends(hidden);
      await prisma.roomMember.update({
        where: { roomId_userId: { roomId: newerPrivateRoom.id, userId: secondFriend.id } },
        data: { leftAt: new Date() },
      });
      await expectBothFriends(visible);
      const subjectBan = await prisma.ban.create({
        data: { userId: secondFriend.id, ownerId: host.id, roomId: room.id, type: "permanent" },
      });
      await expectBothFriends(hidden);
      await prisma.ban.delete({ where: { id: subjectBan.id } });

      await prisma.room.update({ where: { id: room.id }, data: { status: "ended" } });
      await expectPresence(null);
      await expectFriendPresence("friends", hidden);
      expect((await read("/stats")).parties).not.toContainEqual({ id: room.id, title: room.title });
      await prisma.room.update({ where: { id: room.id }, data: { status: "live" } });
      await expectPresence(visible);

      await prisma.user.update({ where: { id: host.id }, data: { isFriendsPublic: false } });
      await expectPresence(null);
      await expectFriendPresence("friends", hidden);
      await prisma.user.update({ where: { id: host.id }, data: { isFriendsPublic: true } });

      const ban = await prisma.ban.create({ data: { userId: viewer.id, ownerId: host.id, roomId: room.id, type: "permanent" } });
      await expectPresence(null);
      await expectFriendPresence("friends", hidden);
      await prisma.ban.update({ where: { id: ban.id }, data: { liftedAt: new Date() } });
      await expectPresence(visible);

      await prisma.friendship.update({ where: { id: friendship.id }, data: { status: "pending" } });
      await expectPresence(null);
      await expectFriendPresence("outgoing", hidden);
      await prisma.roomMember.create({ data: { roomId: room.id, userId: viewer.id } });
      expect((await read("/friends", host.headers)).incoming).toContainEqual(expect.objectContaining({ userId: viewer.id, ...hidden }));

      await prisma.friendship.update({ where: { id: friendship.id }, data: { status: "blocked" } });
      await expectPresence(null);
      await expectFriendPresence("blocked", hidden);
      await prisma.friendship.create({ data: { requesterId: host.id, addresseeId: viewer.id, status: "accepted" } });
      await expectPresence(null);
      await expectFriendPresence("friends", hidden);
    } finally {
      await server.close();
      try {
        await prisma.room.deleteMany({ where: { id: { in: rooms } } });
        await prisma.user.deleteMany({ where: { id: { in: users } } });
      } finally {
        await prisma.$disconnect();
      }
    }
  });
});
