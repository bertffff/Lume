import { afterEach, describe, expect, it } from "vitest";
import { createPrismaClient } from "@lume/db";
import { buildApp } from "../app.js";
import { loadApiEnv } from "../env.js";

const databaseUrl = "postgresql://lume:lume@127.0.0.1:5432/lume_test?schema=public";

describe("hide other reactions", () => {
  let app: Awaited<ReturnType<typeof buildApp>> | undefined;

  afterEach(async () => {
    await app?.close();
  });

  it("saves hideOtherReactions and returns it on the profile", async () => {
    process.env.DATABASE_URL = databaseUrl;
    const prisma = createPrismaClient();
    const env = loadApiEnv({
      NODE_ENV: "test",
      DATABASE_URL: databaseUrl,
      JWT_SECRET: "hide-test-secret",
      ALLOW_STUB_AUTH: "true",
      WEB_ORIGIN: "http://127.0.0.1:5173",
    });
    app = await buildApp(env, { prisma });
    const login = await app.inject({ method: "POST", url: "/auth/dev", payload: { displayName: `Hide ${Date.now().toString(36)}` } });
    const token = login.json().accessToken as string;
    const userId = login.json().user.id as string;
    const patched = await app.inject({
      method: "PATCH",
      url: "/me",
      headers: { authorization: `Bearer ${token}` },
      payload: { hideOtherReactions: true },
    });
    expect(patched.statusCode).toBe(200);
    expect(patched.json().hideOtherReactions).toBe(true);
    const stored = await prisma.user.findUnique({ where: { id: userId } });
    expect(stored?.hideOtherReactions).toBe(true);
    await prisma.user.update({ where: { id: userId }, data: { hideOtherReactions: false } });
    await prisma.$disconnect();
  });
});
