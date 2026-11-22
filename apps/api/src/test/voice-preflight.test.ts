import { afterEach, describe, expect, it } from "vitest";
import { createPrismaClient } from "@lume/db";
import { buildApp } from "../app.js";
import { loadApiEnv } from "../env.js";

import { apiTestDatabaseUrl } from "./api-test-database.js";

const databaseUrl = apiTestDatabaseUrl();

describe("voice preflight", () => {
  let app: Awaited<ReturnType<typeof buildApp>> | undefined;

  afterEach(async () => {
    await app?.close();
  });

  it("persists the mic, speaker, device, and network result for the caller", async () => {
    process.env.DATABASE_URL = databaseUrl;
    const prisma = createPrismaClient();
    const env = loadApiEnv({
      NODE_ENV: "test",
      DATABASE_URL: databaseUrl,
      JWT_SECRET: "preflight-test-secret",
      ALLOW_STUB_AUTH: "true",
      WEB_ORIGIN: "http://127.0.0.1:5173",
    });
    app = await buildApp(env, { prisma });
    const stamp = Date.now().toString(36);
    const login = await app.inject({ method: "POST", url: "/auth/dev", payload: { displayName: `Preflight ${stamp}` } });
    const account = login.json() as { accessToken: string; user: { id: string } };

    const anonymous = await app.inject({ method: "GET", url: "/voice/preflight" });
    expect(anonymous.statusCode).toBe(401);

    const empty = await app.inject({
      method: "GET",
      url: "/voice/preflight",
      headers: { authorization: `Bearer ${account.accessToken}` },
    });
    expect(empty.statusCode).toBe(200);
    expect(empty.json().preflight).toBeNull();

    const saved = await app.inject({
      method: "POST",
      url: "/voice/preflight",
      headers: { authorization: `Bearer ${account.accessToken}` },
      payload: { mic: true, micLevel: 42, speaker: true, network: "good", devices: { input: 2, output: 1 } },
    });
    expect(saved.statusCode).toBe(200);
    expect(saved.json().preflight).toMatchObject({ mic: true, micLevel: 42, speaker: true, network: "good", devices: { input: 2, output: 1 } });

    const row = await prisma.user.findUnique({ where: { id: account.user.id } });
    const stored = (row as unknown as { voicePreflight?: Record<string, unknown>; voicePreflightAt?: Date | null }).voicePreflight;
    expect(stored).toMatchObject({ mic: true, micLevel: 42, speaker: true, network: "good" });
    expect((row as unknown as { voicePreflightAt?: Date | null }).voicePreflightAt).toBeInstanceOf(Date);

    const read = await app.inject({
      method: "GET",
      url: "/voice/preflight",
      headers: { authorization: `Bearer ${account.accessToken}` },
    });
    expect(read.statusCode).toBe(200);
    expect(read.json().preflight).toMatchObject({ mic: true, speaker: true, network: "good" });
    expect(typeof read.json().preflight.checkedAt).toBe("string");

    const invalid = await app.inject({
      method: "POST",
      url: "/voice/preflight",
      headers: { authorization: `Bearer ${account.accessToken}` },
      payload: { mic: true, speaker: true, network: "excellent" },
    });
    expect(invalid.statusCode).toBe(400);

    await prisma.user.delete({ where: { id: account.user.id } });
    await prisma.$disconnect();
  });
});
