import { createServer, type Server } from "node:http";
import { afterEach, describe, expect, it } from "vitest";
import { createPrismaClient } from "@lume/db";
import { buildApp } from "../app.js";
import { loadApiEnv } from "../env.js";

const databaseUrl = "postgresql://lume:lume@127.0.0.1:5432/lume?schema=public";

async function listen(server: Server): Promise<string> {
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("no address");
  return `http://127.0.0.1:${address.port}`;
}

describe("metadata resolver", () => {
  let app: Awaited<ReturnType<typeof buildApp>> | undefined;
  let server: Server | undefined;

  afterEach(async () => {
    await app?.close();
    await new Promise<void>((resolve, reject) => {
      if (!server?.listening) {
        resolve();
        return;
      }
      server.close((error) => (error ? reject(error) : resolve()));
    });
    server = undefined;
  });

  it("stores the resolved title, thumbnail and duration instead of an oEmbed URL", async () => {
    server = createServer((request, response) => {
      const url = new URL(request.url ?? "/", "http://127.0.0.1");
      if (url.pathname === "/oembed") {
        response.writeHead(200, { "content-type": "application/json" });
        response.end(JSON.stringify({
          title: "Ночной рейс",
          thumbnail_url: "https://cdn.example.com/poster.jpg",
          duration: 754.5,
        }));
        return;
      }
      response.writeHead(404);
      response.end();
    });
    const base = await listen(server);

    process.env.DATABASE_URL = databaseUrl;
    const prisma = createPrismaClient();
    const env = loadApiEnv({
      NODE_ENV: "test",
      DATABASE_URL: databaseUrl,
      JWT_SECRET: "metadata-test-secret",
      ALLOW_STUB_AUTH: "true",
      WEB_ORIGIN: "http://127.0.0.1:5173",
      OEMBED_BASE_URL: `${base}/oembed`,
    });
    app = await buildApp(env, { prisma });
    const stamp = Date.now().toString(36);
    const host = await app.inject({ method: "POST", url: "/auth/dev", payload: { displayName: `Meta ${stamp}` } });
    const token = host.json().accessToken as string;
    const userId = host.json().user.id as string;
    const created = await app.inject({
      method: "POST",
      url: "/rooms",
      headers: { authorization: `Bearer ${token}` },
      payload: { title: `Meta ${stamp}` },
    });
    const roomId = created.json().room.id as string;

    const added = await app.inject({
      method: "POST",
      url: `/rooms/${roomId}/queue`,
      headers: { authorization: `Bearer ${token}` },
      payload: { url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ" },
    });
    expect(added.statusCode).toBe(200);
    const queue = added.json().queue as Array<{ title: string; durationMs: number | null; thumbnailUrl: string | null }>;
    expect(queue).toHaveLength(1);
    expect(queue[0]?.title).toBe("Ночной рейс");
    expect(queue[0]?.durationMs).toBe(754_500);
    expect(queue[0]?.thumbnailUrl).toBe("https://cdn.example.com/poster.jpg");
    expect(JSON.stringify(added.json())).not.toContain("oembed?format=json");
    const row = await prisma.queueItem.findFirst({ where: { roomId } });
    expect(row?.title).toBe("Ночной рейс");
    expect(row?.durationMs).toBe(754_500);
    await app.inject({
      method: "POST",
      url: `/rooms/${roomId}/queue/next`,
      headers: { authorization: `Bearer ${token}` },
      payload: {},
    });
    const history = await prisma.roomHistoryItem.findFirst({ where: { roomId } });
    expect(history?.durationMs).toBe(754_500);

    await prisma.room.deleteMany({ where: { id: roomId } });
    await prisma.user.deleteMany({ where: { id: userId } });
    await prisma.$disconnect();
  });

  it("falls back to OpenGraph duration when a page has no oEmbed endpoint", async () => {
    server = createServer((request, response) => {
      if (request.url === "/page") {
        response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
        response.end(`<html><head>
          <meta property="og:title" content="Открытый граф" />
          <meta property="og:image" content="https://cdn.example.com/og.jpg" />
          <meta property="og:video:duration" content="125" />
        </head></html>`);
        return;
      }
      response.writeHead(404);
      response.end();
    });
    const base = await listen(server);

    process.env.DATABASE_URL = databaseUrl;
    const prisma = createPrismaClient();
    const env = loadApiEnv({
      NODE_ENV: "test",
      DATABASE_URL: databaseUrl,
      JWT_SECRET: "metadata-og-test-secret",
      ALLOW_STUB_AUTH: "true",
      WEB_ORIGIN: "http://127.0.0.1:5173",
      METADATA_ALLOW_PRIVATE_HOSTS: "true",
    });
    app = await buildApp(env, { prisma });
    const stamp = Date.now().toString(36);
    const host = await app.inject({ method: "POST", url: "/auth/dev", payload: { displayName: `Meta og ${stamp}` } });
    const token = host.json().accessToken as string;
    const userId = host.json().user.id as string;
    const created = await app.inject({
      method: "POST",
      url: "/rooms",
      headers: { authorization: `Bearer ${token}` },
      payload: { title: `Meta og ${stamp}` },
    });
    const roomId = created.json().room.id as string;

    const added = await app.inject({
      method: "POST",
      url: `/rooms/${roomId}/queue`,
      headers: { authorization: `Bearer ${token}` },
      payload: { url: `${base}/page` },
    });
    expect(added.statusCode).toBe(200);
    const item = (added.json().queue as Array<{ title: string; durationMs: number | null; thumbnailUrl: string | null }>)[0];
    expect(item?.title).toBe("Открытый граф");
    expect(item?.durationMs).toBe(125_000);
    expect(item?.thumbnailUrl).toBe("https://cdn.example.com/og.jpg");

    await prisma.room.deleteMany({ where: { id: roomId } });
    await prisma.user.deleteMany({ where: { id: userId } });
    await prisma.$disconnect();
  });

  it("refuses a private OpenGraph page fetch when the flag is off", async () => {
    let pageHits = 0;
    server = createServer((request, response) => {
      if (request.url === "/page") {
        pageHits += 1;
        response.writeHead(200, { "content-type": "text/html" });
        response.end(`<meta property="og:title" content="Секрет" /><meta property="og:video:duration" content="77" />`);
        return;
      }
      response.writeHead(404);
      response.end();
    });
    const base = await listen(server);

    process.env.DATABASE_URL = databaseUrl;
    const prisma = createPrismaClient();
    const env = loadApiEnv({
      NODE_ENV: "test",
      DATABASE_URL: databaseUrl,
      JWT_SECRET: "metadata-guard-test-secret",
      ALLOW_STUB_AUTH: "true",
      WEB_ORIGIN: "http://127.0.0.1:5173",
    });
    app = await buildApp(env, { prisma });
    const stamp = Date.now().toString(36);
    const host = await app.inject({ method: "POST", url: "/auth/dev", payload: { displayName: `Meta guard ${stamp}` } });
    const token = host.json().accessToken as string;
    const userId = host.json().user.id as string;
    const created = await app.inject({
      method: "POST",
      url: "/rooms",
      headers: { authorization: `Bearer ${token}` },
      payload: { title: `Meta guard ${stamp}` },
    });
    const roomId = created.json().room.id as string;

    const blocked = await app.inject({
      method: "POST",
      url: `/rooms/${roomId}/queue`,
      headers: { authorization: `Bearer ${token}` },
      payload: { url: `${base}/page` },
    });
    expect(blocked.statusCode).toBe(200);
    const blockedItem = (blocked.json().queue as Array<{ title: string; durationMs: number | null }>)[0];
    expect(blockedItem?.title).toBe("127.0.0.1");
    expect(blockedItem?.durationMs).toBeNull();
    expect(pageHits).toBe(0);

    await prisma.room.deleteMany({ where: { id: roomId } });
    await prisma.user.deleteMany({ where: { id: userId } });
    await prisma.$disconnect();
  });

  it("reads schema.org ISO duration when the provider oEmbed has no duration", async () => {
    server = createServer((request, response) => {
      const url = new URL(request.url ?? "/", "http://127.0.0.1");
      if (url.pathname === "/oembed-no-duration") {
        response.writeHead(200, { "content-type": "application/json" });
        response.end(JSON.stringify({ title: "Трейлер", thumbnail_url: "https://cdn.example.com/trailer.jpg" }));
        return;
      }
      if (url.pathname === "/watch") {
        response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
        response.end(`<html><head>
          <meta property="og:title" content="Трейлер" />
          <meta property="og:image" content="https://cdn.example.com/trailer.jpg" />
          <div itemprop="duration" content="PT3M34S"></div>
        </head></html>`);
        return;
      }
      response.writeHead(404);
      response.end();
    });
    const base = await listen(server);

    process.env.DATABASE_URL = databaseUrl;
    const prisma = createPrismaClient();
    const env = loadApiEnv({
      NODE_ENV: "test",
      DATABASE_URL: databaseUrl,
      JWT_SECRET: "metadata-iso-test-secret",
      ALLOW_STUB_AUTH: "true",
      WEB_ORIGIN: "http://127.0.0.1:5173",
      OEMBED_BASE_URL: `${base}/oembed-no-duration`,
      METADATA_ALLOW_PRIVATE_HOSTS: "true",
    });
    app = await buildApp(env, { prisma });
    const stamp = Date.now().toString(36);
    const host = await app.inject({ method: "POST", url: "/auth/dev", payload: { displayName: `Meta iso ${stamp}` } });
    const token = host.json().accessToken as string;
    const userId = host.json().user.id as string;
    const created = await app.inject({
      method: "POST",
      url: "/rooms",
      headers: { authorization: `Bearer ${token}` },
      payload: { title: `Meta iso ${stamp}` },
    });
    const roomId = created.json().room.id as string;

    const added = await app.inject({
      method: "POST",
      url: `/rooms/${roomId}/queue`,
      headers: { authorization: `Bearer ${token}` },
      payload: { url: `${base}/watch` },
    });
    expect(added.statusCode).toBe(200);
    const item = (added.json().queue as Array<{ title: string; durationMs: number | null }>)[0];
    expect(item?.title).toBe("Трейлер");
    expect(item?.durationMs).toBe(214_000);

    await prisma.room.deleteMany({ where: { id: roomId } });
    await prisma.user.deleteMany({ where: { id: userId } });
    await prisma.$disconnect();
  });
});
