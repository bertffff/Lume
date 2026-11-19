import { afterEach, describe, expect, it } from "vitest";
import { createPrismaClient } from "@lume/db";
import { buildApp } from "../app.js";
import { loadApiEnv } from "../env.js";

const databaseUrl = "postgresql://lume:lume@127.0.0.1:5432/lume_test?schema=public";

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
});
