import { afterEach, describe, expect, it } from "vitest";
import { createPrismaClient } from "@lume/db";
import { buildApp } from "../app.js";
import { loadApiEnv } from "../env.js";

import { apiTestDatabaseUrl } from "./api-test-database.js";

const databaseUrl = apiTestDatabaseUrl();

describe("room viewer defaults", () => {
  let app: Awaited<ReturnType<typeof buildApp>> | undefined;

  afterEach(async () => {
    await app?.close();
  });

  it("persists all six viewer permission keys", async () => {
    process.env.DATABASE_URL = databaseUrl;
    const prisma = createPrismaClient();
    const env = loadApiEnv({
      NODE_ENV: "test",
      DATABASE_URL: databaseUrl,
      JWT_SECRET: "defaults-test-secret",
      ALLOW_STUB_AUTH: "true",
      WEB_ORIGIN: "http://127.0.0.1:5173",
    });
    app = await buildApp(env, { prisma });
    const login = await app.inject({ method: "POST", url: "/auth/dev", payload: { displayName: `Perm ${Date.now().toString(36)}` } });
    const token = login.json().accessToken as string;
    const created = await app.inject({
      method: "POST",
      url: "/rooms",
      headers: { authorization: `Bearer ${token}` },
      payload: { title: "Права", isPublic: true },
    });
    const roomId = created.json().room.id as string;
    const defaults = { canChat: true, canQueue: false, canSpeak: true, canReact: false, canSeek: true, canInvite: false };
    const posted = await app.inject({
      method: "POST",
      url: `/rooms/${roomId}/defaults`,
      headers: { authorization: `Bearer ${token}` },
      payload: defaults,
    });
    expect(posted.statusCode).toBe(200);
    expect(posted.json().defaults).toEqual(defaults);
    const stored = await prisma.room.findUnique({ where: { id: roomId } });
    expect(stored?.defaultPermissions).toMatchObject(defaults);
    await prisma.$disconnect();
  });
});
