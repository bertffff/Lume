import { createPrismaClient } from "@lume/db";
import { expect, it, vi } from "vitest";
import { buildApp } from "../app.js";
import { loadApiEnv } from "../env.js";
import { apiTestDatabaseUrl } from "./api-test-database.js";

it("projects completed watch sessions onto their own calendar days", async () => {
  const url = apiTestDatabaseUrl();
  vi.stubEnv("DATABASE_URL", url);
  const prisma = createPrismaClient();
  const app = await buildApp(loadApiEnv({ NODE_ENV: "test", DATABASE_URL: url, JWT_SECRET: "studio-season-fixture-only", ALLOW_STUB_AUTH: "true" }), { prisma });
  try {
    async function member(displayName: string) {
      const response = await app.inject({ method: "POST", url: "/auth/dev", payload: { displayName } });
      expect(response.statusCode).toBe(200);
      return response.json<{ accessToken: string; user: { id: string } }>();
    }
    const viewer = await member("Season viewer");
    const partner = await member("Season partner");
    const previous = new Date(Date.now() - 2 * 86_400_000);
    const earlier = new Date(Date.now() - 8 * 86_400_000);
    await prisma.watchSession.createMany({ data: [previous, earlier].map((sessionDate) => ({
      userId: viewer.user.id, partnerId: partner.user.id, sessionDate, watchDuration: 3600,
    })) });
    const response = await app.inject({ url: "/me/studio", headers: { authorization: `Bearer ${viewer.accessToken}` } });
    expect(response.statusCode).toBe(200);
    const heatmap = response.json<{ heatmap: { day: string; score: number }[] }>().heatmap;
    for (const date of [previous, earlier]) {
      expect(heatmap.find(({ day }) => day === date.toISOString().slice(0, 10))?.score).toBeGreaterThan(0);
    }
    expect(heatmap.at(-1)?.score).toBe(0);
  } finally {
    await app.close();
    await prisma.$disconnect();
    vi.unstubAllEnvs();
  }
});
