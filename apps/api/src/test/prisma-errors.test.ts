import { afterEach, describe, expect, it } from "vitest";
import { createPrismaClient } from "@lume/db";
import { buildApp, prismaFailure } from "../app.js";
import { loadApiEnv } from "../env.js";
import { seedPartyAchievements } from "../account/awards.js";

import { apiTestDatabaseUrl } from "./api-test-database.js";

const databaseUrl = apiTestDatabaseUrl();

describe("prisma failure mapping", () => {
  let app: Awaited<ReturnType<typeof buildApp>> | undefined;

  afterEach(async () => {
    await app?.close();
  });

  it("maps known codes to client statuses and hides the raw message", () => {
    expect(prismaFailure({ code: "P2025", message: "An operation failed because it depends on one or more records" })).toEqual({
      status: 404,
      body: { error: "not_found" },
    });
    expect(prismaFailure({ code: "P2002", message: "Unique constraint failed on the fields: (`slug`)" })).toEqual({
      status: 409,
      body: { error: "conflict" },
    });
    expect(prismaFailure({ code: "P2003" })).toEqual({ status: 409, body: { error: "conflict" } });
    expect(prismaFailure({ code: "P1001", message: "Can't reach database server" })).toEqual({
      status: 503,
      body: { error: "database_unavailable" },
    });
    expect(prismaFailure({ code: "P1012", message: "Schema validation failed" })).toEqual({
      status: 500,
      body: { error: "internal" },
    });
    expect(prismaFailure(new Error("boom"))).toBeNull();
  });

  it("turns a real P2025 into 404 without leaking Prisma details", async () => {
    process.env.DATABASE_URL = databaseUrl;
    const prisma = createPrismaClient();
    await seedPartyAchievements(prisma);
    const env = loadApiEnv({
      NODE_ENV: "test",
      DATABASE_URL: databaseUrl,
      JWT_SECRET: "prisma-error-test-secret",
      ALLOW_STUB_AUTH: "true",
      WEB_ORIGIN: "http://127.0.0.1:5173",
    });
    app = await buildApp(env, { prisma });

    const stamp = Date.now().toString(36);
    const login = await app.inject({
      method: "POST",
      url: "/auth/dev",
      payload: { displayName: `Prisma ${stamp}` },
    });
    const token = login.json().accessToken as string;

    // The user owns no achievement row, so Prisma raises P2025 on update.
    const pin = await app.inject({
      method: "PATCH",
      url: "/me/achievements/first_party/pin",
      headers: { authorization: `Bearer ${token}` },
      payload: { slot: 0 },
    });
    expect(pin.statusCode).toBe(404);
    expect(pin.json()).toEqual({ error: "not_found" });
    expect(pin.body).not.toContain("P2025");
    expect(pin.body).not.toContain("prisma");
    expect(pin.body).not.toContain("internal");
  });
});
