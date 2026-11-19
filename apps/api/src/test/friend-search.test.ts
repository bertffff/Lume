import { afterEach, describe, expect, it } from "vitest";
import { createPrismaClient } from "@lume/db";
import { buildApp } from "../app.js";
import { loadApiEnv } from "../env.js";

const databaseUrl = "postgresql://lume:lume@127.0.0.1:5432/lume_test?schema=public";

describe("friend name search", () => {
  let app: Awaited<ReturnType<typeof buildApp>> | undefined;

  afterEach(async () => {
    await app?.close();
  });

  it("returns the other person and not the caller", async () => {
    process.env.DATABASE_URL = databaseUrl;
    const prisma = createPrismaClient();
    const env = loadApiEnv({
      NODE_ENV: "test",
      DATABASE_URL: databaseUrl,
      JWT_SECRET: "search-test-secret",
      ALLOW_STUB_AUTH: "true",
      WEB_ORIGIN: "http://127.0.0.1:5173",
    });
    app = await buildApp(env, { prisma });
    const stamp = Date.now().toString(36);
    const targetName = `Искомый${stamp}`;
    const caller = await app.inject({ method: "POST", url: "/auth/dev", payload: { displayName: `Ищущий${stamp}` } });
    await app.inject({ method: "POST", url: "/auth/dev", payload: { displayName: targetName } });
    const found = await app.inject({
      method: "GET",
      url: `/users/search?q=${encodeURIComponent(targetName)}`,
      headers: { authorization: `Bearer ${caller.json().accessToken as string}` },
    });
    expect(found.statusCode).toBe(200);
    const names = (found.json().users as Array<{ displayName: string }>).map((user) => user.displayName);
    expect(names).toContain(targetName);
    expect(names).not.toContain(`Ищущий${stamp}`);
    await prisma.$disconnect();
  });
});
