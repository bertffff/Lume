import { afterEach, describe, expect, it } from "vitest";
import { createPrismaClient } from "@lume/db";
import { buildApp } from "../app.js";
import { loadApiEnv } from "../env.js";

const databaseUrl = "postgresql://lume:lume@127.0.0.1:5432/lume_test?schema=public";

describe("ICE server config", () => {
  let app: Awaited<ReturnType<typeof buildApp>> | undefined;

  afterEach(async () => {
    await app?.close();
  });

  it("returns the configured STUN/TURN list alongside the LiveKit host", async () => {
    process.env.DATABASE_URL = databaseUrl;
    const prisma = createPrismaClient();
    const env = loadApiEnv({
      NODE_ENV: "test",
      DATABASE_URL: databaseUrl,
      JWT_SECRET: "ice-test-secret",
      ALLOW_STUB_AUTH: "true",
      WEB_ORIGIN: "http://127.0.0.1:5173",
      LIVEKIT_URL: "wss://lume.livekit.cloud",
      LIVEKIT_API_KEY: "lk-key",
      LIVEKIT_API_SECRET: "lk-secret",
      STUN_URLS: "stun:stun.example.test:3478",
      TURN_URLS: "turn:turn.example.test:3478,turns:turn.example.test:5349",
      TURN_USERNAME: "lume-turn",
      TURN_CREDENTIAL: "turn-secret",
    });
    app = await buildApp(env, { prisma });
    const anonymous = await app.inject({ method: "GET", url: "/ice-servers" });
    expect(anonymous.statusCode).toBe(401);

    const login = await app.inject({ method: "POST", url: "/auth/dev", payload: { displayName: `Ice ${Date.now().toString(36)}` } });
    const account = login.json() as { accessToken: string; user: { id: string } };
    const response = await app.inject({
      method: "GET",
      url: "/ice-servers",
      headers: { authorization: `Bearer ${account.accessToken}` },
    });
    expect(response.statusCode).toBe(200);
    const body = response.json() as {
      iceServers: Array<{ urls: string | string[]; username?: string; credential?: string }>;
      livekit: { configured: boolean; url: string | null };
    };
    const urls = body.iceServers.flatMap((server) => (Array.isArray(server.urls) ? server.urls : [server.urls]));
    expect(urls).toContain("stun:stun.example.test:3478");
    expect(urls).toContain("stun:lume.livekit.cloud:3478");
    expect(urls).toContain("turn:turn.example.test:3478");
    expect(urls).toContain("turns:turn.example.test:5349");
    const turn = body.iceServers.find((server) => (Array.isArray(server.urls) ? server.urls : [server.urls]).some((url) => url.startsWith("turn:")));
    expect(turn).toMatchObject({ username: "lume-turn", credential: "turn-secret" });
    expect(body.livekit).toEqual({ configured: true, url: "wss://lume.livekit.cloud" });

    await prisma.user.delete({ where: { id: account.user.id } });
    await prisma.$disconnect();
  });

  it("falls back to the public STUN server when nothing is configured", async () => {
    process.env.DATABASE_URL = databaseUrl;
    const prisma = createPrismaClient();
    const env = loadApiEnv({
      NODE_ENV: "test",
      DATABASE_URL: databaseUrl,
      JWT_SECRET: "ice-test-secret-2",
      ALLOW_STUB_AUTH: "true",
      WEB_ORIGIN: "http://127.0.0.1:5173",
    });
    app = await buildApp(env, { prisma });
    const login = await app.inject({ method: "POST", url: "/auth/dev", payload: { displayName: `Ice plain ${Date.now().toString(36)}` } });
    const account = login.json() as { accessToken: string; user: { id: string } };
    const response = await app.inject({
      method: "GET",
      url: "/ice-servers",
      headers: { authorization: `Bearer ${account.accessToken}` },
    });
    expect(response.statusCode).toBe(200);
    const body = response.json() as { iceServers: Array<{ urls: string | string[] }>; livekit: { configured: boolean } };
    const urls = body.iceServers.flatMap((server) => (Array.isArray(server.urls) ? server.urls : [server.urls]));
    expect(urls).toContain("stun:stun.l.google.com:19302");
    expect(urls.some((url) => url.startsWith("turn:"))).toBe(false);
    expect(body.livekit.configured).toBe(false);

    await prisma.user.delete({ where: { id: account.user.id } });
    await prisma.$disconnect();
  });
});
