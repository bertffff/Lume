import { afterEach, describe, expect, it } from "vitest";
import { createPrismaClient } from "@lume/db";
import { buildApp } from "../app.js";
import { loadApiEnv } from "../env.js";

const databaseUrl = "postgresql://lume:lume@127.0.0.1:5432/lume?schema=public";

describe("emoji picker recents", () => {
  let app: Awaited<ReturnType<typeof buildApp>> | undefined;

  afterEach(async () => {
    await app?.close();
  });

  it("persists recent emojis per account, dedupes them, and caps the list", async () => {
    process.env.DATABASE_URL = databaseUrl;
    const prisma = createPrismaClient();
    const env = loadApiEnv({
      NODE_ENV: "test",
      DATABASE_URL: databaseUrl,
      JWT_SECRET: "emoji-picker-test-secret",
      ALLOW_STUB_AUTH: "true",
      WEB_ORIGIN: "http://127.0.0.1:5173",
    });
    app = await buildApp(env, { prisma });
    const stamp = Date.now().toString(36);
    const login = await app.inject({ method: "POST", url: "/auth/dev", payload: { displayName: `Emoji ${stamp}` } });
    const token = login.json().accessToken as string;
    const userId = login.json().user.id as string;
    const headers = { authorization: `Bearer ${token}` };

    for (const emoji of ["🔥", "😂", "❤️"]) {
      const saved = await app.inject({ method: "POST", url: "/me/recent-emojis", headers, payload: { emoji } });
      expect(saved.statusCode).toBe(200);
    }
    const first = await app.inject({ method: "GET", url: "/me", headers });
    expect(first.json().recentEmojis).toEqual(["❤️", "😂", "🔥"]);

    const again = await app.inject({ method: "POST", url: "/me/recent-emojis", headers, payload: { emoji: "🔥" } });
    expect(again.json().recentEmojis).toEqual(["🔥", "❤️", "😂"]);

    for (let index = 0; index < 15; index += 1) {
      const emoji = String.fromCodePoint(0x1f600 + index);
      await app.inject({ method: "POST", url: "/me/recent-emojis", headers, payload: { emoji } });
    }
    const capped = await app.inject({ method: "GET", url: "/me", headers });
    const recent = capped.json().recentEmojis as string[];
    expect(recent).toHaveLength(12);
    expect(new Set(recent).size).toBe(12);
    expect(recent[0]).toBe(String.fromCodePoint(0x1f600 + 14));

    const stored = await prisma.user.findUnique({ where: { id: userId }, select: { recentEmojis: true } });
    expect(stored?.recentEmojis).toEqual(recent);

    await prisma.user.deleteMany({ where: { id: userId } });
    await prisma.$disconnect();
  });
});
