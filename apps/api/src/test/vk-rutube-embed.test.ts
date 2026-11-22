import { createServer, type Server } from "node:http";
import { afterEach, describe, expect, it } from "vitest";
import { createPrismaClient } from "@lume/db";
import { buildApp } from "../app.js";
import { loadApiEnv } from "../env.js";

import { apiTestDatabaseUrl } from "./api-test-database.js";

const databaseUrl = apiTestDatabaseUrl();

async function listen(server: Server): Promise<string> {
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("no address");
  return `http://127.0.0.1:${address.port}`;
}

describe("VK and Rutube embed queue", () => {
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

  it("persists the provider and external id used by the live embed adapters", async () => {
    // Keep the queue metadata resolver off the public network. CI has no
    // guarantee that VK/Rutube oEmbed endpoints answer within the test budget.
    server = createServer((_request, response) => {
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify({ title: "Embed fixture", thumbnail_url: "https://cdn.example.com/embed.jpg" }));
    });
    const oEmbedBaseUrl = `${await listen(server)}/oembed`;

    process.env.DATABASE_URL = databaseUrl;
    const prisma = createPrismaClient();
    const env = loadApiEnv({
      NODE_ENV: "test",
      DATABASE_URL: databaseUrl,
      JWT_SECRET: "embed-test-secret",
      ALLOW_STUB_AUTH: "true",
      WEB_ORIGIN: "http://127.0.0.1:5173",
      OEMBED_BASE_URL: oEmbedBaseUrl,
    });
    app = await buildApp(env, { prisma });
    const stamp = Date.now().toString(36);
    const host = await app.inject({ method: "POST", url: "/auth/dev", payload: { displayName: `Embed ${stamp}` } });
    const token = host.json().accessToken as string;
    const userId = host.json().user.id as string;
    const created = await app.inject({
      method: "POST",
      url: "/rooms",
      headers: { authorization: `Bearer ${token}` },
      payload: { title: `Embed ${stamp}` },
    });
    const roomId = created.json().room.id as string;

    const vkUrl = "https://vk.com/video-200_456239017";
    const rutubeUrl = "https://rutube.ru/video/abcdef123456/";
    for (const url of [vkUrl, rutubeUrl]) {
      const added = await app.inject({
        method: "POST",
        url: `/rooms/${roomId}/queue`,
        headers: { authorization: `Bearer ${token}` },
        payload: { url },
      });
      expect(added.statusCode).toBe(200);
    }

    const detail = await app.inject({
      method: "GET",
      url: `/rooms/${roomId}`,
      headers: { authorization: `Bearer ${token}` },
    });
    const queue = detail.json().queue as Array<{ provider: string; externalId: string; url: string }>;
    expect(queue.map((item) => item.provider)).toEqual(["vk", "rutube"]);
    expect(queue[0]).toMatchObject({ url: vkUrl, externalId: "-200_456239017" });
    expect(queue[1]).toMatchObject({ url: rutubeUrl, externalId: "abcdef123456" });

    const stored = await prisma.queueItem.findMany({ where: { roomId }, orderBy: { position: "asc" } });
    expect(stored).toHaveLength(2);
    expect(stored.map((item) => item.provider)).toEqual(["vk", "rutube"]);
    expect(stored[0]?.externalId).toBe("-200_456239017");
    expect(stored[1]?.externalId).toBe("abcdef123456");

    const next = await app.inject({
      method: "POST",
      url: `/rooms/${roomId}/queue/next`,
      headers: { authorization: `Bearer ${token}` },
      payload: {},
    });
    expect(next.statusCode).toBe(200);
    expect(next.json().room.nowPlaying).toMatchObject({ provider: "vk", externalId: "-200_456239017" });

    await prisma.room.deleteMany({ where: { id: roomId } });
    await prisma.user.deleteMany({ where: { id: userId } });
    await prisma.$disconnect();
  });
});
