import { afterEach, describe, expect, it } from "vitest";
import { createPrismaClient } from "@lume/db";
import { buildApp } from "../app.js";
import { loadApiEnv } from "../env.js";
import { apiTestDatabaseUrl } from "./api-test-database.js";

const databaseUrl = apiTestDatabaseUrl();

describe("queue management", () => {
  let app: Awaited<ReturnType<typeof buildApp>> | undefined;

  afterEach(async () => {
    await app?.close();
  });

  it("lets the host remove, reorder and play queued items, and keeps viewers to their own items", async () => {
    process.env.DATABASE_URL = databaseUrl;
    const prisma = createPrismaClient();
    const env = loadApiEnv({ NODE_ENV: "test", DATABASE_URL: databaseUrl, JWT_SECRET: "queue-manage-test-secret", ALLOW_STUB_AUTH: "true", WEB_ORIGIN: "http://127.0.0.1:5173" });
    app = await buildApp(env, { prisma });
    const stamp = Date.now().toString(36);
    const auth = async (name: string) => {
      const response = await app!.inject({ method: "POST", url: "/auth/dev", payload: { displayName: `${name} ${stamp}` } });
      return { token: response.json().accessToken as string, id: response.json().user.id as string };
    };
    const host = await auth("QM host");
    const guest = await auth("QM guest");
    const headers = (token: string) => ({ authorization: `Bearer ${token}` });
    const created = await app.inject({ method: "POST", url: "/rooms", headers: headers(host.token), payload: { title: `QM ${stamp}` } });
    const roomId = created.json().room.id as string;
    const code = created.json().room.code as string;
    await app.inject({ method: "POST", url: "/rooms/join", headers: headers(guest.token), payload: { code } });

    const add = async (token: string, n: number) => {
      const response = await app!.inject({ method: "POST", url: `/rooms/${roomId}/queue`, headers: headers(token), payload: { url: `https://cdn.example.com/qm-${stamp}-${n}.mp4` } });
      expect(response.statusCode).toBe(200);
      return (response.json().queue as Array<{ id: string; url: string }>).find((item) => item.url.endsWith(`-${n}.mp4`))!.id;
    };
    const a = await add(host.token, 1);
    const b = await add(host.token, 2);
    const c = await add(guest.token, 3);
    const order = async () => (await prisma.queueItem.findMany({ where: { roomId }, orderBy: { position: "asc" } })).map((row) => row.id);
    expect(await order()).toEqual([a, b, c]);

    const down = await app.inject({ method: "POST", url: `/rooms/${roomId}/queue/${a}/move`, headers: headers(host.token), payload: { direction: "down" } });
    expect(down.statusCode).toBe(200);
    expect(await order()).toEqual([b, a, c]);
    const up = await app.inject({ method: "POST", url: `/rooms/${roomId}/queue/${c}/move`, headers: headers(host.token), payload: { direction: "up" } });
    expect(up.statusCode).toBe(200);
    expect(await order()).toEqual([b, c, a]);
    const edge = await app.inject({ method: "POST", url: `/rooms/${roomId}/queue/${b}/move`, headers: headers(host.token), payload: { direction: "up" } });
    expect(edge.statusCode).toBe(200);
    expect(await order()).toEqual([b, c, a]);
    expect((await app.inject({ method: "POST", url: `/rooms/${roomId}/queue/${b}/move`, headers: headers(guest.token), payload: { direction: "down" } })).statusCode).toBe(403);

    expect((await app.inject({ method: "DELETE", url: `/rooms/${roomId}/queue/${a}`, headers: headers(guest.token) })).statusCode).toBe(403);
    expect((await app.inject({ method: "DELETE", url: `/rooms/${roomId}/queue/${c}`, headers: headers(guest.token) })).statusCode).toBe(200);
    expect(await order()).toEqual([b, a]);

    expect((await app.inject({ method: "POST", url: `/rooms/${roomId}/queue/${a}/play`, headers: headers(guest.token) })).statusCode).toBe(403);
    const played = await app.inject({ method: "POST", url: `/rooms/${roomId}/queue/${a}/play`, headers: headers(host.token) });
    expect(played.statusCode).toBe(200);
    expect(played.json().room.nowPlaying.id).toBe(a);
    expect((await app.inject({ method: "DELETE", url: `/rooms/${roomId}/queue/${a}`, headers: headers(host.token) })).statusCode).toBe(409);
    expect((await app.inject({ method: "DELETE", url: `/rooms/${roomId}/queue/nope`, headers: headers(host.token) })).statusCode).toBe(404);

    await prisma.room.deleteMany({ where: { id: roomId } });
    await prisma.user.deleteMany({ where: { id: { in: [host.id, guest.id] } } });
    await prisma.$disconnect();
  });
});
