import { afterEach, describe, expect, it } from "vitest";
import { defaultRoomLayout, withLayoutPreset, withVideoAspect } from "@lume/contracts";
import { createPrismaClient } from "@lume/db";
import { buildApp } from "../app.js";
import { loadApiEnv } from "../env.js";

const databaseUrl = "postgresql://lume:lume@127.0.0.1:5432/lume_test?schema=public";

describe("room layout", () => {
  let app: Awaited<ReturnType<typeof buildApp>> | undefined;

  afterEach(async () => {
    await app?.close();
  });

  it("stores the preset and the per-aspect frame on the room", async () => {
    process.env.DATABASE_URL = databaseUrl;
    const prisma = createPrismaClient();
    const env = loadApiEnv({
      NODE_ENV: "test",
      DATABASE_URL: databaseUrl,
      JWT_SECRET: "layout-test-secret",
      ALLOW_STUB_AUTH: "true",
      WEB_ORIGIN: "http://127.0.0.1:5173",
    });
    app = await buildApp(env, { prisma });
    const stamp = Date.now().toString(36);
    const host = await app.inject({ method: "POST", url: "/auth/dev", payload: { displayName: `Layout ${stamp}` } });
    const token = host.json().accessToken as string;
    const userId = host.json().user.id as string;
    const created = await app.inject({
      method: "POST",
      url: "/rooms",
      headers: { authorization: `Bearer ${token}` },
      payload: { title: `Layout ${stamp}` },
    });
    const roomId = created.json().room.id as string;
    const next = withVideoAspect(withLayoutPreset(defaultRoomLayout, "immersive"), 9 / 16);

    const saved = await app.inject({
      method: "PATCH",
      url: `/rooms/${roomId}/layout`,
      headers: { authorization: `Bearer ${token}` },
      payload: next,
    });
    expect(saved.statusCode).toBe(200);
    expect(saved.json().layout.preset).toBe("immersive");
    expect(saved.json().layout.videoAspect).toBeCloseTo(9 / 16);

    const loaded = await app.inject({
      method: "GET",
      url: `/rooms/${roomId}/layout`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(loaded.statusCode).toBe(200);
    expect(loaded.json().layout.videoAspect).toBeCloseTo(9 / 16);

    const stored = await prisma.room.findUnique({ where: { id: roomId } });
    expect((stored?.layout as { preset?: string }).preset).toBe("immersive");
    expect(stored?.videoAspect).toBeCloseTo(9 / 16);

    await prisma.room.deleteMany({ where: { id: roomId } });
    await prisma.user.deleteMany({ where: { id: userId } });
    await prisma.$disconnect();
  });
});
