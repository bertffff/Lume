import { afterEach, describe, expect, it } from "vitest";
import { createPrismaClient } from "@lume/db";
import { buildApp } from "../app.js";
import { loadApiEnv } from "../env.js";
import { seedPartyAchievements } from "../account/awards.js";

import { apiTestDatabaseUrl } from "./api-test-database.js";

const databaseUrl = apiTestDatabaseUrl();

describe("achievements and levels", () => {
  let app: Awaited<ReturnType<typeof buildApp>> | undefined;

  afterEach(async () => {
    await app?.close();
  });

  it("returns the whole catalog with only truly earned rows and derives level from xp", async () => {
    process.env.DATABASE_URL = databaseUrl;
    const prisma = createPrismaClient();
    await seedPartyAchievements(prisma);
    const env = loadApiEnv({
      NODE_ENV: "test",
      DATABASE_URL: databaseUrl,
      JWT_SECRET: "achievements-test-secret",
      ALLOW_STUB_AUTH: "true",
      WEB_ORIGIN: "http://127.0.0.1:5173",
    });
    app = await buildApp(env, { prisma });
    const server = app;
    const stamp = Date.now().toString(36);
    const login = await server.inject({ method: "POST", url: "/auth/dev", payload: { displayName: `Achievements ${stamp}` } });
    const token = login.json().accessToken as string;
    const userId = login.json().user.id as string;
    const created = await server.inject({
      method: "POST",
      url: "/rooms",
      headers: { authorization: `Bearer ${token}` },
      payload: { title: `Achievements ${stamp}` },
    });
    const roomId = created.json().room.id as string;

    const own = await server.inject({
      method: "GET",
      url: "/me/achievements",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(own.statusCode).toBe(200);
    const ownBody = own.json() as {
      total: number;
      unlocked: Array<{ key: string }>;
      level: number;
      totalXp: number;
      nextLevelXp: number;
      all: Array<{ key: string; earned: boolean; xpReward: number }>;
    };
    expect(ownBody.total).toBe(10);
    expect(ownBody.all).toHaveLength(10);
    expect(ownBody.unlocked.map((item) => item.key)).toContain("first_party");
    const earned = ownBody.all.filter((item) => item.earned);
    expect(earned).toHaveLength(ownBody.unlocked.length);
    expect(earned.length).toBeGreaterThanOrEqual(1);
    expect(earned.length).toBeLessThan(10);
    const earnedXp = earned.reduce((sum, item) => sum + item.xpReward, 0);
    expect(ownBody.totalXp).toBe(earnedXp);
    expect(ownBody.level).toBe(Math.floor(earnedXp / 500) + 1);
    expect(ownBody.nextLevelXp).toBe(ownBody.level * 500);

    const profile = await server.inject({
      method: "GET",
      url: "/users/profile/" + userId,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(profile.statusCode).toBe(200);
    expect(profile.json()).toMatchObject({ level: 1, nextLevelXp: 500, totalAchievements: 10 });

    await prisma.user.update({ where: { id: userId }, data: { xp: 1250 } });
    const publicView = await server.inject({ method: "GET", url: `/users/${userId}/achievements` });
    expect(publicView.statusCode).toBe(200);
    expect(publicView.json()).toMatchObject({ level: 3, totalXp: 1250, nextLevelXp: 1500, total: 10 });
    expect(publicView.json().unlocked.map((item: { key: string }) => item.key)).toContain("first_party");
    expect(publicView.json().unlocked.length).toBeLessThan(10);

    await prisma.room.deleteMany({ where: { id: roomId } });
    await prisma.user.deleteMany({ where: { id: userId } });
    await prisma.$disconnect();
  });

  it("awards a shared achievement exactly once under concurrent room creation", async () => {
    process.env.DATABASE_URL = databaseUrl;
    const prisma = createPrismaClient();
    await seedPartyAchievements(prisma);
    const env = loadApiEnv({
      NODE_ENV: "test",
      DATABASE_URL: databaseUrl,
      JWT_SECRET: "achievements-race-test-secret",
      ALLOW_STUB_AUTH: "true",
      WEB_ORIGIN: "http://127.0.0.1:5173",
    });
    app = await buildApp(env, { prisma });
    const server = app;
    const stamp = Date.now().toString(36);
    const login = await server.inject({ method: "POST", url: "/auth/dev", payload: { displayName: `Race ${stamp}` } });
    const token = login.json().accessToken as string;
    const userId = login.json().user.id as string;

    const responses = await Promise.all(
      [1, 2, 3, 4].map((index) => server.inject({
        method: "POST",
        url: "/rooms",
        headers: { authorization: `Bearer ${token}` },
        payload: { title: `Race ${stamp} ${index}` },
      })),
    );
    expect(responses.map((response) => response.statusCode)).toEqual([200, 200, 200, 200]);

    const firstParty = await prisma.userAchievement.findMany({
      where: { userId, achievement: { key: "first_party" } },
    });
    expect(firstParty).toHaveLength(1);

    await prisma.room.deleteMany({ where: { hostId: userId } });
    await prisma.user.deleteMany({ where: { id: userId } });
    await prisma.$disconnect();
  });
});
