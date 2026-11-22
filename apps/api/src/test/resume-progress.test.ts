import { createPrismaClient } from "@lume/db";
import { afterAll, beforeAll, expect, it } from "vitest";
import { buildApp } from "../app.js";
import { loadApiEnv } from "../env.js";
import type { RedisLike } from "../redis.js";
import { apiTestDatabaseUrl } from "./api-test-database.js";

const databaseUrl = apiTestDatabaseUrl();
const stamp = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
const playbackKey = (roomId: string) => `lume:room:${roomId}:playback`;
const poster = "https://media.example.test/resume-poster.jpg";
const durationMs = 61_000;

function fakeRedis(): RedisLike & { values: Map<string, string> } {
  const values = new Map<string, string>();
  return {
    values,
    get: async (key) => values.get(key) ?? null,
    setWithTtl: async (key, value) => {
      values.set(key, value);
    },
    delete: async (key) => {
      values.delete(key);
    },
    take: async (key) => {
      const value = values.get(key) ?? null;
      values.delete(key);
      return value;
    },
    incr: async (key) => {
      const next = Number(values.get(key) ?? "0") + 1;
      values.set(key, String(next));
      return next;
    },
    incrWithTtl: async (key) => {
      const next = Number(values.get(key) ?? "0") + 1;
      values.set(key, String(next));
      return next;
    },
    expire: async () => 1,
    ping: async () => true,
    quit: async () => undefined,
  };
}

let app: Awaited<ReturnType<typeof buildApp>>;
let prisma: ReturnType<typeof createPrismaClient>;
let redis: ReturnType<typeof fakeRedis>;
const userIds = new Set<string>();

beforeAll(async () => {
  process.env.DATABASE_URL = databaseUrl;
  prisma = createPrismaClient();
  redis = fakeRedis();
  app = await buildApp(loadApiEnv({
    NODE_ENV: "test",
    DATABASE_URL: databaseUrl,
    JWT_SECRET: "resume-progress-fixture-secret",
    ALLOW_STUB_AUTH: "true",
    WEB_ORIGIN: "http://127.0.0.1:5173",
  }), { prisma, redis });
});

afterAll(async () => {
  await app?.close();
  if (prisma && userIds.size > 0) {
    const ids = [...userIds];
    await prisma.room.deleteMany({ where: { ownerId: { in: ids } } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
  }
  await prisma?.$disconnect();
  delete process.env.DATABASE_URL;
});

async function user(label: string) {
  const response = await app.inject({ method: "POST", url: "/auth/dev", payload: { displayName: `${stamp} ${label}` } });
  expect(response.statusCode).toBe(200);
  const { user, accessToken } = response.json<{ user: { id: string }; accessToken: string }>();
  userIds.add(user.id);
  return { id: user.id, headers: { authorization: `Bearer ${accessToken}` } };
}

async function room(owner: { id: string; headers: Record<string, string> }, title: string, categorySelection = "auto") {
  const response = await app.inject({ method: "POST", url: "/rooms", headers: owner.headers, payload: { title, categorySelection } });
  expect(response.statusCode).toBe(200);
  return response.json<{ room: { id: string; code: string } }>().room;
}

async function nowPlaying(roomId: string, ownerId: string, suffix: string) {
  const url = `https://media.example.test/${suffix}`;
  const item = await prisma.queueItem.create({
    data: {
      roomId, url, provider: "youtube", externalId: suffix, title: `Video ${suffix}`,
      thumbnail: poster, durationMs, position: 1, addedById: ownerId, played: false, inferredCategory: "music",
    },
  });
  await prisma.room.update({ where: { id: roomId }, data: { nowPlayingId: item.id } });
  return url;
}

async function snapshotOf(userId: string) {
  const row = await prisma.user.findUnique({ where: { id: userId } });
  return (row?.lastRoomSnapshot ?? null) as Record<string, unknown> | null;
}

function leave(roomId: string, headers: Record<string, string>, payload: object = {}) {
  return app.inject({ method: "POST", url: `/rooms/${roomId}/leave`, headers, payload });
}

it("stores the authoritative playback position, real poster and known duration at teardown", async () => {
  const owner = await user("authority owner");
  const target = await room(owner, `Authority ${stamp}`, "music");
  const url = await nowPlaying(target.id, owner.id, `authority-${stamp}`);
  const anchorTime = Date.now() - 4_000;
  redis.values.set(playbackKey(target.id), JSON.stringify({
    status: "playing", anchorPositionMs: 10_000, anchorServerTimeMs: anchorTime, version: 4, updatedBy: "realtime",
  }));

  const left = await leave(target.id, owner.headers, { positionMs: 987_654, durationMs: 1 });
  expect(left.statusCode).toBe(200);
  const snapshot = await snapshotOf(owner.id);
  expect(snapshot).not.toBeNull();
  const position = snapshot!.positionMs as number;
  expect(position).toBeGreaterThan(12_000);
  expect(position).toBeLessThan(18_000);
  expect(position).not.toBe(987_654);
  expect(snapshot).toMatchObject({ posterUrl: poster, durationMs, videoUrl: url, categorySelection: "music" });

  const resume = await app.inject({ method: "GET", url: "/me/resume", headers: owner.headers });
  expect(resume.statusCode).toBe(200);
  expect(resume.json()).toMatchObject({
    resume: { title: `Authority ${stamp}`, positionMs: position, durationMs, posterUrl: poster, queueCount: 0 },
  });
});

it("records an unknown position when the authoritative anchor is unavailable", async () => {
  const owner = await user("unknown anchor owner");
  const target = await room(owner, `Unknown ${stamp}`);
  await nowPlaying(target.id, owner.id, `unknown-${stamp}`);

  const left = await leave(target.id, owner.headers);
  expect(left.statusCode).toBe(200);
  const snapshot = await snapshotOf(owner.id);
  expect(snapshot?.positionMs).toBeNull();
  const resume = await app.inject({ method: "GET", url: "/me/resume", headers: owner.headers });
  expect(resume.json()).toMatchObject({
    resume: { positionMs: null, durationMs, posterUrl: poster },
  });

  const invalidTarget = await room(owner, `Invalid ${stamp}`);
  await nowPlaying(invalidTarget.id, owner.id, `invalid-${stamp}`);
  redis.values.set(playbackKey(invalidTarget.id), JSON.stringify({ status: "paused", anchorPositionMs: "not-a-number" }));
  expect((await leave(invalidTarget.id, owner.headers)).statusCode).toBe(200);
  expect((await snapshotOf(owner.id))?.positionMs).toBeNull();
});

it("restores the saved position as paused playback in a new room without touching the source room", async () => {
  const owner = await user("restore owner");
  const source = await room(owner, `Source ${stamp}`);
  const sourceAnchor = {
    status: "playing", anchorPositionMs: 0, anchorServerTimeMs: Date.now(), version: 1, updatedBy: "someone-else",
  };
  redis.values.set(playbackKey(source.id), JSON.stringify(sourceAnchor));
  await prisma.user.update({
    where: { id: owner.id },
    data: {
      lastRoomSnapshot: {
        title: `Saved ${stamp}`, description: "", isPublic: false, maxMembers: 25,
        videoUrl: "https://media.example.test/restored", positionMs: 42_000,
        posterUrl: poster, durationMs, queue: [{ url: "https://media.example.test/later", title: "Next" }],
        historyCount: 2, categorySelection: "film", inferredCategory: "music",
      },
    },
  });

  const response = await app.inject({ method: "POST", url: "/rooms/resume-last", headers: owner.headers, payload: { positionMs: 1 } });
  expect(response.statusCode).toBe(200);
  const body = response.json<{ room: { id: string; category: string; categorySelection: string }; positionMs: number | null; paused: boolean; playback: { status: string; positionMs: number } }>();
  expect(body.room.id).not.toBe(source.id);
  expect(body.paused).toBe(true);
  expect(body.positionMs).toBe(42_000);
  expect(body.playback).toEqual({ status: "paused", positionMs: 42_000 });
  expect(body.room.categorySelection).toBe("film");
  expect(body.room.category).toBe("film");
  expect(JSON.parse(redis.values.get(playbackKey(source.id)) ?? "null")).toEqual(sourceAnchor);
  const restoredAnchor = JSON.parse(redis.values.get(playbackKey(body.room.id)) ?? "null") as Record<string, unknown>;
  expect(restoredAnchor).toMatchObject({ status: "paused", anchorPositionMs: 42_000, version: 0 });
});

it("does not let a non-owner overwrite the owner snapshot or clone a room without access", async () => {
  const owner = await user("scope owner");
  const guest = await user("scope guest");
  const saved = `Saved scope ${stamp}`;
  await prisma.user.update({
    where: { id: owner.id },
    data: { lastRoomSnapshot: { title: saved, isPublic: false, positionMs: 5_000, queue: [], historyCount: 0 } },
  });
  const other = await room(owner, `Other ${stamp}`);
  const code = (await prisma.room.findUnique({ where: { id: other.id } }))!.slug;
  const joined = await app.inject({ method: "POST", url: "/rooms/join", headers: guest.headers, payload: { code } });
  expect(joined.statusCode).toBe(200);
  expect((await leave(other.id, owner.headers)).statusCode).toBe(200);
  expect((await leave(other.id, guest.headers)).statusCode).toBe(200);
  expect((await snapshotOf(owner.id))?.title).toBe(saved);

  const clone = await app.inject({ method: "POST", url: "/rooms/resume-last", headers: guest.headers });
  expect(clone.statusCode).toBe(404);

  // An old snapshot without poster/duration fields still resumes truthfully.
  const oldCard = await app.inject({ method: "POST", url: "/rooms/resume-last", headers: owner.headers });
  expect(oldCard.statusCode).toBe(200);
  expect(oldCard.json()).toMatchObject({
    positionMs: 5_000, durationMs: null, posterUrl: null,
    playback: { status: "paused", positionMs: 5_000 }, paused: true,
  });
});
