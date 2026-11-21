import { createServer } from "node:http";
import { createPrismaClient } from "@lume/db";
import { afterAll, beforeAll, expect, it } from "vitest";
import { buildApp } from "../app.js";
import { loadApiEnv } from "../env.js";
import { apiTestDatabaseUrl } from "./api-test-database.js";

const databaseUrl = apiTestDatabaseUrl();
let app: Awaited<ReturnType<typeof buildApp>>;
let prisma: ReturnType<typeof createPrismaClient>;
const actorIds = new Set<string>();
const metadata = createServer((req, res) => {
  const url = new URL(req.url ?? "/", "http://localhost").searchParams.get("url");
  res.setHeader("content-type", "application/json");
  res.end(JSON.stringify({ title: url?.includes("concert") ? "Encore" : url?.includes("film") ? "Film trailer" : "Mystery", author_name: url?.includes("concert") ? "Music Channel" : "Studio", duration: 60, thumbnail_url: "https://example.test/poster.jpg" }));
});

beforeAll(async () => {
  process.env.DATABASE_URL = databaseUrl;
  prisma = createPrismaClient();
  await new Promise<void>((resolve) => metadata.listen(0, "127.0.0.1", resolve));
  const address = metadata.address();
  if (!address || typeof address === "string") throw new Error("Missing metadata port");
  app = await buildApp(loadApiEnv({
    NODE_ENV: "test", DATABASE_URL: databaseUrl, JWT_SECRET: "room-catalog-fixture-secret",
    ALLOW_STUB_AUTH: "true", WEB_ORIGIN: "http://127.0.0.1:5173", OEMBED_BASE_URL: `http://127.0.0.1:${address.port}`,
  }), { prisma });
});

afterAll(async () => {
  await app?.close();
  if (actorIds.size > 0) {
    const ids = [...actorIds];
    await prisma.room.deleteMany({ where: { ownerId: { in: ids } } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
  }
  await prisma?.$disconnect();
  await new Promise<void>((resolve) => metadata.close(() => resolve()));
});

async function actor(displayName: string) {
  const result = await app.inject({ method: "POST", url: "/auth/dev", payload: { displayName } });
  expect(result.statusCode).toBe(200);
  const { user, accessToken } = result.json();
  actorIds.add(user.id);
  return { id: user.id as string, headers: { authorization: `Bearer ${accessToken}` } };
}

it("filters before keyset pagination and protects private, blocked, banned and unaccepted presence", async () => {
  const [viewer, host, friend, pending, blocked, hidden] = await Promise.all([
    actor("Viewer"), actor("Catalog Host"), actor("Friend"), actor("Pending"), actor("Blocked"), actor("Hidden Friend"),
  ]);
  await prisma.user.update({ where: { id: hidden.id }, data: { isFriendsPublic: false } });
  await prisma.friendship.createMany({ data: [
    { requesterId: friend.id, addresseeId: viewer.id, status: "accepted" },
    { requesterId: viewer.id, addresseeId: pending.id, status: "pending" },
    { requesterId: blocked.id, addresseeId: viewer.id, status: "blocked" },
    { requesterId: viewer.id, addresseeId: blocked.id, status: "accepted" },
    { requesterId: hidden.id, addresseeId: viewer.id, status: "accepted" },
  ] });
  const create = async (suffix: string, owner: typeof host, categorySelection: string, isPublic = true) => {
    const response = await app.inject({ method: "POST", url: "/rooms", headers: owner.headers, payload: { title: `Catalog ${suffix}`, isPublic, categorySelection } });
    expect(response.statusCode).toBe(200);
    return response.json().room.id as string;
  };
  const films: string[] = [];
  for (let i = 0; i < 32; i += 1) films.push(await create(`film ${i}`, host, "film"));
  await prisma.room.updateMany({ where: { id: { in: films } }, data: { createdAt: new Date("2020-01-01T00:00:00Z") } });
  for (let i = 0; i < 31; i += 1) await create(`music ${i}`, host, "music");
  const [friendsRoom, privateRoom, pendingRoom, blockedRoom, bannedRoom, leftRoom, hiddenRoom] = await Promise.all([
    create("friend", friend, "film"), create("private", friend, "film", false), create("pending", pending, "film"),
    create("blocked", blocked, "film"), create("banned", friend, "film"), create("left", friend, "film"), create("hidden", hidden, "film"),
  ]);
  await prisma.roomMember.updateMany({ where: { roomId: leftRoom }, data: { leftAt: new Date() } });
  await prisma.ban.create({ data: { roomId: bannedRoom, userId: viewer.id, ownerId: friend.id } });
  await prisma.room.update({ where: { id: friendsRoom }, data: { maxMembers: 2 } });
  await prisma.roomMember.create({ data: { roomId: friendsRoom, userId: viewer.id } });

  const list = (query: string) => app.inject({ url: `/rooms/catalog?${query}`, headers: viewer.headers });
  const first = await list("filter=film");
  expect(first.statusCode).toBe(200);
  expect(first.json().rooms).toHaveLength(30);
  expect(first.json().nextCursor).toEqual(expect.any(String));
  const second = await list(`filter=film&cursor=${encodeURIComponent(first.json().nextCursor)}`);
  expect(second.statusCode).toBe(200);
  expect(second.json().nextCursor).toBeNull();
  const all = [...first.json().rooms, ...second.json().rooms];
  const ids = all.map((item) => item.id);
  expect(new Set(ids).size).toBe(35);
  expect(ids.filter((id) => films.includes(id))).toEqual([...films].sort().reverse());
  expect(ids).toEqual(expect.arrayContaining([friendsRoom, pendingRoom, hiddenRoom]));
  for (const hiddenId of [privateRoom, blockedRoom, bannedRoom, leftRoom]) expect(ids).not.toContain(hiddenId);
  expect(all.every((item) => item.category === "film" && item.mediaPreview === null)).toBe(true);
  expect(all.find((item) => item.id === friendsRoom)).toMatchObject({ memberCount: 2, isFull: true });
  expect(all.find((item) => item.id === pendingRoom)).toMatchObject({ memberCount: 1, isFull: false });
  expect((await list("filter=friends")).json().rooms.map((item: { id: string }) => item.id)).toEqual([friendsRoom]);
  expect((await app.inject({ url: "/rooms/catalog?filter=friends" })).statusCode).toBe(401);
  expect((await app.inject({ url: "/rooms/catalog" })).statusCode).toBe(200);
  expect((await list("cursor=bad")).statusCode).toBe(400);
  const malformedKey = Buffer.from(JSON.stringify(["2020-01-01T00:00:00.000Z", "bad\0id"])).toString("base64url");
  expect((await list(`cursor=${malformedKey}`)).json()).toEqual({ error: "invalid_cursor" });
  expect((await list("filter=other")).statusCode).toBe(400);
  expect((await app.inject({ url: "/rooms/catalog", headers: { authorization: "Bearer bad" } })).statusCode).toBe(401);
});

it("persists explicit and inferred categories through queue, replacement and restore", async () => {
  const host = await actor("Playback Host");
  const viewer = await actor("Playback Viewer");
  const setup = await app.inject({ method: "POST", url: "/rooms", headers: host.headers, payload: { title: "Playback room", isPublic: true, categorySelection: "other" } });
  const { id, code } = setup.json().room;
  expect(setup.json().room).toMatchObject({ categorySelection: "other", category: "other" });
  await app.inject({ method: "POST", url: "/rooms/join", headers: viewer.headers, payload: { code } });
  const settings = (selection: string, headers = host.headers) => app.inject({ method: "PATCH", url: `/rooms/${id}/settings`, headers, payload: { categorySelection: selection } });
  expect((await settings("film", viewer.headers)).statusCode).toBe(403);
  expect((await settings("fake")).statusCode).toBe(400);

  const concert = "https://example.test/concert.mp4";
  const film = "https://example.test/film.mp4";
  const mystery = "https://example.test/mystery.mp4";
  const post = (path: string, payload: object = {}) => app.inject({ method: "POST", url: `/rooms/${id}/${path}`, headers: host.headers, payload });
  expect((await post("queue", { url: concert })).json().room.category).toBe("other");
  expect((await post("queue/next")).json().room.category).toBe("other");
  expect((await settings("auto")).json()).toMatchObject({ categorySelection: "auto", category: "music" });
  expect((await post("queue", { url: film })).json().room.category).toBe("music");
  expect((await post("queue/next")).json().room.category).toBe("film");
  const replaced = await post("recovery", { action: "replace", url: mystery });
  expect(replaced.statusCode).toBe(200);
  expect(await prisma.room.findUnique({ where: { id }, include: { nowPlaying: true } })).toMatchObject({ category: "other", nowPlaying: { url: mystery } });
  const catalog = await app.inject({ url: "/rooms/catalog", headers: host.headers });
  expect(catalog.json().rooms.find((room: { id: string }) => room.id === id)).toMatchObject({ category: "other", mediaPreview: { provider: "direct", title: "Mystery", thumbnailUrl: "https://example.test/poster.jpg" } });

  await prisma.user.update({ where: { id: host.id }, data: { lastRoomSnapshot: { title: "Restored category", isPublic: false, videoUrl: concert, positionMs: 30, queue: [{ url: film }] } } });
  const resumed = await app.inject({ method: "POST", url: "/rooms/resume-last", headers: host.headers });
  expect(resumed.statusCode).toBe(200);
  expect(resumed.json()).toMatchObject({ room: { category: "music", categorySelection: "auto", nowPlaying: { url: concert } }, queue: expect.arrayContaining([expect.objectContaining({ url: film })]), paused: true });
});
