import { afterEach, describe, expect, it } from "vitest";
import { createPrismaClient } from "@lume/db";
import { buildApp } from "../app.js";
import { loadApiEnv } from "../env.js";
import { apiTestDatabaseUrl } from "./api-test-database.js";

const databaseUrl = apiTestDatabaseUrl();

describe("host stats", () => {
  let app: Awaited<ReturnType<typeof buildApp>> | undefined;
  afterEach(async () => {
    await app?.close();
  });

  it("counts hosted rooms, distinct viewers and played videos for the host only", async () => {
    process.env.DATABASE_URL = databaseUrl;
    const prisma = createPrismaClient();
    const env = loadApiEnv({ NODE_ENV: "test", DATABASE_URL: databaseUrl, JWT_SECRET: "host-stats-test-secret", ALLOW_STUB_AUTH: "true", WEB_ORIGIN: "http://127.0.0.1:5173" });
    app = await buildApp(env, { prisma });
    const stamp = Date.now().toString(36);
    const auth = async (name: string) => {
      const response = await app!.inject({ method: "POST", url: "/auth/dev", payload: { displayName: `${name} ${stamp}` } });
      return { token: response.json().accessToken as string, id: response.json().user.id as string };
    };
    const host = await auth("HS host");
    const guest = await auth("HS guest");
    const headers = (token: string) => ({ authorization: `Bearer ${token}` });

    expect((await app.inject({ method: "GET", url: "/me/host-stats" })).statusCode).toBe(401);
    const empty = await app.inject({ method: "GET", url: "/me/host-stats", headers: headers(host.token) });
    expect(empty.json()).toEqual({ roomsHosted: 0, uniqueViewers: 0, videosPlayed: 0, topVideos: [] });

    const created = await app.inject({ method: "POST", url: "/rooms", headers: headers(host.token), payload: { title: `HS ${stamp}` } });
    const roomId = created.json().room.id as string;
    await app.inject({ method: "POST", url: "/rooms/join", headers: headers(guest.token), payload: { code: created.json().room.code } });
    await prisma.roomHistoryItem.createMany({ data: [
      { roomId, url: `https://cdn.example.com/hs-a-${stamp}.mp4`, title: "A", source: "direct" },
      { roomId, url: `https://cdn.example.com/hs-a-${stamp}.mp4`, title: "A", source: "direct" },
      { roomId, url: `https://cdn.example.com/hs-b-${stamp}.mp4`, title: "B", source: "direct" },
    ] });

    const stats = (await app.inject({ method: "GET", url: "/me/host-stats", headers: headers(host.token) })).json();
    expect(stats).toEqual({ roomsHosted: 1, uniqueViewers: 1, videosPlayed: 3, topVideos: [{ title: "A", count: 2 }, { title: "B", count: 1 }] });
    const other = (await app.inject({ method: "GET", url: "/me/host-stats", headers: headers(guest.token) })).json();
    expect(other.roomsHosted).toBe(0);

    await prisma.room.deleteMany({ where: { id: roomId } });
    await prisma.user.deleteMany({ where: { id: { in: [host.id, guest.id] } } });
    await prisma.$disconnect();
  });
});
