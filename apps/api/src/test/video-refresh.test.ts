import { createServer, type Server } from "node:http";
import { afterEach, describe, expect, it } from "vitest";
import { createPrismaClient } from "@lume/db";
import { buildApp } from "../app.js";
import { loadApiEnv } from "../env.js";

const databaseUrl = "postgresql://lume:lume@127.0.0.1:5432/lume_test?schema=public";
const servers: Server[] = [];

afterEach(async () => {
  await Promise.all(
    servers.splice(0).map((server) => new Promise<void>((resolve) => server.close(() => resolve()))),
  );
});

async function cobaltServer(): Promise<{ base: string; url: string }> {
  const server = createServer((request, response) => {
    request.resume();
    request.on("end", () => {
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify({ status: "tunnel", url: "https://cdn.example/fresh.mp4?expire=1999999999" }));
    });
  });
  servers.push(server);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
  const address = server.address();
  return {
    base: typeof address === "object" && address ? `http://127.0.0.1:${address.port}` : "",
    url: "https://cdn.example/fresh.mp4?expire=1999999999",
  };
}

describe("video refresh", () => {
  it("re-extracts the URL and persists it instead of echoing the input", async () => {
    process.env.DATABASE_URL = databaseUrl;
    const prisma = createPrismaClient();
    const cobalt = await cobaltServer();
    const env = loadApiEnv({
      NODE_ENV: "test",
      DATABASE_URL: databaseUrl,
      JWT_SECRET: "refresh-test-secret",
      ALLOW_STUB_AUTH: "true",
      FF_EXTRACTORS: "true",
      COBALT_API_URL: cobalt.base,
      MEDIA_EXTRACTOR_TIMEOUT_MS: "1500",
      WEB_ORIGIN: "http://127.0.0.1:5173",
    });
    const app = await buildApp(env, { prisma });
    const stamp = Date.now().toString(36);
    const login = await app.inject({ method: "POST", url: "/auth/dev", payload: { displayName: `Refresh ${stamp}` } });
    const token = login.json().accessToken as string;
    const room = await app.inject({
      method: "POST",
      url: "/rooms",
      headers: { authorization: `Bearer ${token}` },
      payload: { title: `Refresh ${stamp}` },
    });
    const roomId = room.json().room.id as string;
    const original = `https://www.youtube.com/watch?v=refresh${stamp}`;
    const added = await app.inject({
      method: "POST",
      url: `/rooms/${roomId}/queue`,
      headers: { authorization: `Bearer ${token}` },
      payload: { url: original },
    });
    expect(added.statusCode).toBe(200);

    const refreshed = await app.inject({
      method: "POST",
      url: "/video/refresh",
      payload: { url: original, roomId, positionMs: 12_000, playing: true },
    });
    expect(refreshed.statusCode).toBe(200);
    expect(refreshed.json()).toMatchObject({
      url: cobalt.url,
      positionMs: 12_000,
      status: "playing",
    });
    expect(refreshed.json().expiresAt).toBe(new Date(1_999_999_999_000).toISOString());

    const row = await prisma.queueItem.findFirst({ where: { roomId } });
    expect(row?.url).toBe(cobalt.url);
    expect(row?.expiresAt?.getTime()).toBe(1_999_999_999_000);
    await app.close();
    await prisma.$disconnect();
  });

  it("refuses to pretend a refresh when extractors are off", async () => {
    const env = loadApiEnv({ NODE_ENV: "test", FF_EXTRACTORS: "false" });
    const app = await buildApp(env);
    const response = await app.inject({
      method: "POST",
      url: "/video/refresh",
      payload: { url: "https://www.youtube.com/watch?v=x" },
    });
    expect(response.statusCode).toBe(503);
    expect(response.json()).toEqual({ error: "extractors_disabled" });
  });

  it("answers no_extractor when nothing can handle the input", async () => {
    const env = loadApiEnv({ NODE_ENV: "test", FF_EXTRACTORS: "true" });
    const app = await buildApp(env);
    const response = await app.inject({
      method: "POST",
      url: "/video/refresh",
      payload: { url: "https://unknown.example/watch/1" },
    });
    expect(response.statusCode).toBe(422);
    expect(response.json()).toEqual({ error: "no_extractor" });
  });
});
