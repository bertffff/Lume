import { afterEach, describe, expect, it } from "vitest";
import { createPrismaClient } from "@lume/db";
import { buildApp } from "../app.js";
import { loadApiEnv } from "../env.js";

import { apiTestDatabaseUrl } from "./api-test-database.js";

const databaseUrl = apiTestDatabaseUrl();

describe("sync incidents", () => {
  let app: Awaited<ReturnType<typeof buildApp>> | undefined;

  afterEach(async () => {
    await app?.close();
  });

  it("stores a sync failure note and lists it back", async () => {
    process.env.DATABASE_URL = databaseUrl;
    const prisma = createPrismaClient();
    const env = loadApiEnv({
      NODE_ENV: "test",
      DATABASE_URL: databaseUrl,
      JWT_SECRET: "incident-test-secret",
      ALLOW_STUB_AUTH: "true",
      WEB_ORIGIN: "http://127.0.0.1:5173",
    });
    app = await buildApp(env, { prisma });
    const stamp = Date.now().toString(36);
    const login = await app.inject({ method: "POST", url: "/auth/dev", payload: { displayName: `Sync ${stamp}` } });
    const token = login.json().accessToken as string;
    const created = await app.inject({
      method: "POST",
      url: "/rooms",
      headers: { authorization: `Bearer ${token}` },
      payload: { title: "Синхрон", isPublic: true },
    });
    const roomId = created.json().room.id as string;
    const posted = await app.inject({
      method: "POST",
      url: `/rooms/${roomId}/sync-incident`,
      headers: { authorization: `Bearer ${token}` },
      payload: { note: "player drift" },
    });
    expect(posted.statusCode).toBe(200);
    const listed = await app.inject({
      method: "GET",
      url: `/rooms/${roomId}/sync-incidents`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(listed.statusCode).toBe(200);
    expect(listed.json().incidents[0].detail).toBe("player drift");
    await prisma.moderationAction.deleteMany({ where: { roomId, action: "sync-incident" } });
    await prisma.$disconnect();
  });
});
