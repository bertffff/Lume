import { afterEach, describe, expect, it } from "vitest";
import { createPrismaClient } from "@lume/db";
import { buildApp } from "../app.js";
import { loadApiEnv } from "../env.js";

const databaseUrl = "postgresql://lume:lume@127.0.0.1:5432/lume_test?schema=public";

describe("video detect premium", () => {
  let app: Awaited<ReturnType<typeof buildApp>> | undefined;

  afterEach(async () => {
    await app?.close();
  });

  it("uses the saved premium flag instead of assuming false", async () => {
    process.env.DATABASE_URL = databaseUrl;
    const prisma = createPrismaClient();
    const env = loadApiEnv({
      NODE_ENV: "test",
      DATABASE_URL: databaseUrl,
      JWT_SECRET: "detect-test-secret",
      ALLOW_STUB_AUTH: "true",
      WEB_ORIGIN: "http://127.0.0.1:5173",
    });
    app = await buildApp(env, { prisma });
    const login = await app.inject({ method: "POST", url: "/auth/dev", payload: { displayName: `Detect ${Date.now().toString(36)}` } });
    const token = login.json().accessToken as string;
    const userId = login.json().user.id as string;
    const url = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";
    const free = await app.inject({
      method: "POST",
      url: "/video/detect",
      headers: { authorization: `Bearer ${token}` },
      payload: { url },
    });
    expect(free.json().plan.type).toBe("embed");
    await prisma.user.update({ where: { id: userId }, data: { isPremium: true } });
    const paid = await app.inject({
      method: "POST",
      url: "/video/detect",
      headers: { authorization: `Bearer ${token}` },
      payload: { url },
    });
    expect(paid.json().plan.type).toBe("extract");
    await prisma.user.update({ where: { id: userId }, data: { isPremium: false } });
    await prisma.$disconnect();
  });
});
