import { formatRoomCode, parseRoomCode } from "@lume/contracts";
import { createPrismaClient } from "@lume/db";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "../app.js";
import { loadApiEnv } from "../env.js";
import { createRedis, redisAdapter, waitForRedisReady } from "../redis.js";
import { createPrismaRepository } from "../rooms/prisma-repo.js";
import { RoomService } from "../rooms/service.js";

// Dedicated populated migration fixture, never the default API/E2E databases.
const databaseUrl = process.env.LUME_INVITE_FIXTURE_DATABASE_URL;
const redisUrl = process.env.LUME_INVITE_FIXTURE_REDIS_URL;
if (databaseUrl) {
  const url = new URL(databaseUrl);
  if (url.protocol !== "postgresql:" || url.hostname !== "127.0.0.1" || Number(url.port) <= 5432 ||
      !/^\/lume_task2(?:_[a-z0-9_]+)?$/.test(url.pathname) || url.search !== "?schema=public") {
    throw new Error("Use an explicitly disposable Task 2 loopback PostgreSQL fixture on an alternate port");
  }
}
if (redisUrl) {
  const url = new URL(redisUrl);
  if (url.protocol !== "redis:" || url.hostname !== "127.0.0.1" || Number(url.port) <= 6379 || url.search) {
    throw new Error("Use an explicitly disposable Task 2 loopback Redis fixture on an alternate port");
  }
}

describe.skipIf(!databaseUrl)("six-character invite cutover on PostgreSQL", () => {
  let prisma: ReturnType<typeof createPrismaClient>;
  let app: Awaited<ReturnType<typeof buildApp>>;
  let redis: ReturnType<typeof createRedis> | undefined;
  let forwarded = 0;

  beforeAll(async () => {
    process.env.DATABASE_URL = databaseUrl;
    prisma = createPrismaClient();
    redis = redisUrl ? createRedis(redisUrl) : undefined;
    if (redis && !await waitForRedisReady(redis)) throw new Error("Disposable invite Redis fixture is not ready");
    const env = loadApiEnv({
      NODE_ENV: "test",
      JWT_SECRET: "fixture-only-secret",
      ALLOW_STUB_AUTH: "true",
      REDIS_KEY_PREFIX: `task2:${crypto.randomUUID()}`,
    });
    app = await buildApp(env, { prisma, ...(redis ? { redis: redisAdapter(redis) } : {}) });
  });

  afterAll(async () => {
    await app?.close();
    redis?.disconnect();
    await prisma?.$disconnect();
  });

  async function login(name: string) {
    const response = await app.inject({ method: "POST", url: "/auth/dev", payload: { displayName: `${name} ${crypto.randomUUID()}` } });
    expect(response.statusCode).toBe(200);
    return response.json<{ accessToken: string; user: { id: string } }>();
  }

  function join(token: string, code: string, remoteAddress: string, query = "") {
    return app.inject({
      method: "POST",
      url: `/rooms/join${query}`,
      remoteAddress,
      headers: { authorization: `Bearer ${token}`, "x-forwarded-for": `198.51.100.${++forwarded}` },
      payload: { code },
    });
  }

  it("preserves seeded relations and rejects the former invite", async () => {
    const guest = await login("Cutover guest");
    expect((await join(guest.accessToken, "7kq2mxzz", "192.0.2.1")).statusCode).toBe(400);
    const room = await prisma.room.findUniqueOrThrow({
      where: { id: "task2-room" }, include: { members: true, messages: true, queue: true, bans: true },
    });
    expect(parseRoomCode(room.slug)).toBe(room.slug);
    expect(room.slug).not.toBe("7kq2mx");
    expect(room.members.map(({ id }) => id)).toEqual(["task2-member"]);
    expect(room.messages.map(({ id }) => id)).toEqual(["task2-message"]);
    expect(room.queue.map(({ id }) => id)).toEqual(["task2-queue"]);
    expect(room.nowPlayingId).toBe("task2-queue");
    expect(room.bans.map(({ id }) => id)).toEqual(["task2-ban"]);
    const ended = await prisma.room.findUniqueOrThrow({ where: { id: "task2-ended" } });
    expect(parseRoomCode(ended.slug)).toBe(ended.slug);
    expect((await join(guest.accessToken, ended.slug, "192.0.2.1")).statusCode).toBe(404);
    const grouped = ` ${formatRoomCode(room.slug)} `;
    await prisma.ban.create({ data: { userId: guest.user.id, roomId: room.id, ownerId: room.hostId } });
    expect((await join(guest.accessToken, grouped, "192.0.2.1")).json()).toEqual({ error: "banned" });
    const viewer = await login("Cutover viewer");
    const accepted = await join(viewer.accessToken, grouped, "192.0.2.1");
    expect(accepted.statusCode).toBe(200);
    expect(accepted.json()).toMatchObject({ room: { id: room.id, code: room.slug }, self: { permissions: { canInvite: false } } });
  });

  it("generates a canonical code on the resume creation path", async () => {
    const owner = await login("Resume owner");
    await prisma.user.update({ where: { id: owner.user.id }, data: { lastRoomSnapshot: { title: "Resume fixture" } } });
    const response = await app.inject({ method: "POST", url: "/rooms/resume-last", headers: { authorization: `Bearer ${owner.accessToken}` } });
    expect(response.statusCode).toBe(200);
    const { room } = response.json<{ room: { id: string; code: string } }>();
    expect(parseRoomCode(room.code)).toBe(room.code);
    expect(await prisma.room.findUnique({ where: { id: room.id }, select: { slug: true } })).toEqual({ slug: room.code });
  });

  it("retries only a real slug collision at insert, including simultaneous creators", async () => {
    const owner = await login("Cutover host");
    const actor = { userId: owner.user.id, displayName: "Cutover host" };
    const repo = createPrismaRepository(prisma);
    const codes = ["hjj222", "hjj333", "hjj444"];
    const create = (id: string, fallback: string) => {
      let first = true;
      return new RoomService(repo, () => id, undefined, undefined, () => {
        if (!first) return fallback;
        first = false;
        return codes[0]!;
      }).createRoom(actor, { title: "Concurrent room" });
    };
    const [left, right] = await Promise.all([create("collision-left", codes[1]!), create("collision-right", codes[2]!)]);
    expect(new Set([left.room.code, right.room.code]).size).toBe(2);
    expect([left.room.code, right.room.code]).toContain(codes[0]);
    const duplicateId = new RoomService(repo, () => left.room.id, undefined, undefined, () => "hjj555");
    await expect(duplicateId.createRoom(actor, { title: "Duplicate ID" })).rejects.toMatchObject({ code: "P2002" });
  });

  it("limits malformed attempts by account across IPs and by IP across accounts/query variants", async () => {
    const first = await login("Rate account");
    for (let attempt = 1; attempt <= 6; attempt += 1) {
      expect((await join(first.accessToken, "7kq2mxzz", `192.0.2.${attempt + 10}`)).statusCode).toBe(400);
    }
    expect((await join(first.accessToken, "7kq2mxzz", "192.0.2.27")).statusCode).toBe(429);

    for (let account = 0; account < 4; account += 1) {
      const user = await login(`Shared IP ${account}`);
      for (let attempt = 0; attempt < 6; attempt += 1) {
        expect((await join(user.accessToken, "7kq2mxzz", "192.0.2.30", `?request=${account}-${attempt}`)).statusCode).toBe(400);
      }
    }
    const next = await login("Shared IP limit");
    const blocked = await join(next.accessToken, "7kq2mxzz", "192.0.2.30", "?request=last");
    expect(blocked.statusCode).toBe(429);
    expect(blocked.headers["retry-after"]).toBe("60");
    expect((await join(next.accessToken, "7kq2mxzz", "192.0.2.31")).statusCode).toBe(400);
  });
});
