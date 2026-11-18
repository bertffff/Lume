import { afterEach, describe, expect, it } from "vitest";
import { createPrismaClient } from "@lume/db";
import { buildApp } from "../app.js";
import { loadApiEnv } from "../env.js";

const databaseUrl = "postgresql://lume:lume@127.0.0.1:5432/lume?schema=public";

const defaults = { canChat: false, canQueue: true, canSpeak: false, canReact: true, canSeek: false, canInvite: true };

describe("room settings", () => {
  let app: Awaited<ReturnType<typeof buildApp>> | undefined;

  afterEach(async () => {
    await app?.close();
  });

  it("saves title, description, visibility, member cap, hide-reactions, and viewer defaults", async () => {
    process.env.DATABASE_URL = databaseUrl;
    const prisma = createPrismaClient();
    const env = loadApiEnv({
      NODE_ENV: "test",
      DATABASE_URL: databaseUrl,
      JWT_SECRET: "room-settings-test-secret",
      ALLOW_STUB_AUTH: "true",
      WEB_ORIGIN: "http://127.0.0.1:5173",
    });
    app = await buildApp(env, { prisma });
    const stamp = Date.now().toString(36);
    const host = await app.inject({ method: "POST", url: "/auth/dev", payload: { displayName: `Settings Host ${stamp}` } });
    const hostToken = host.json().accessToken as string;
    const hostId = host.json().user.id as string;
    const created = await app.inject({
      method: "POST",
      url: "/rooms",
      headers: { authorization: `Bearer ${hostToken}` },
      payload: { title: `Settings ${stamp}`, isPublic: false },
    });
    const roomId = created.json().room.id as string;

    const saved = await app.inject({
      method: "PATCH",
      url: `/rooms/${roomId}/settings`,
      headers: { authorization: `Bearer ${hostToken}` },
      payload: {
        title: `Ночной зал ${stamp}`,
        description: "Смотрим вместе",
        isPublic: true,
        maxMembers: 2,
        hideReactions: true,
        defaults,
      },
    });
    expect(saved.statusCode).toBe(200);
    expect(saved.json()).toMatchObject({
      title: `Ночной зал ${stamp}`,
      description: "Смотрим вместе",
      isPublic: true,
      maxMembers: 2,
      hideReactions: true,
      defaults,
    });

    const loaded = await app.inject({
      method: "GET",
      url: `/rooms/${roomId}/settings`,
      headers: { authorization: `Bearer ${hostToken}` },
    });
    expect(loaded.statusCode).toBe(200);
    expect(loaded.json().maxMembers).toBe(2);
    expect(loaded.json().hideReactions).toBe(true);

    const stored = await prisma.room.findUnique({ where: { id: roomId } });
    expect(stored?.title).toBe(`Ночной зал ${stamp}`);
    expect(stored?.description).toBe("Смотрим вместе");
    expect(stored?.isPublic).toBe(true);
    expect(stored?.maxMembers).toBe(2);
    expect(stored?.hideReactions).toBe(true);
    expect(stored?.defaultPermissions).toMatchObject(defaults);

    const first = await app.inject({ method: "POST", url: "/auth/dev", payload: { displayName: `Cap One ${stamp}` } });
    const second = await app.inject({ method: "POST", url: "/auth/dev", payload: { displayName: `Cap Two ${stamp}` } });
    const firstJoin = await app.inject({
      method: "POST",
      url: "/rooms/join",
      headers: { authorization: `Bearer ${first.json().accessToken}` },
      payload: { code: created.json().room.code },
    });
    expect(firstJoin.statusCode).toBe(200);
    const secondJoin = await app.inject({
      method: "POST",
      url: "/rooms/join",
      headers: { authorization: `Bearer ${second.json().accessToken}` },
      payload: { code: created.json().room.code },
    });
    expect(secondJoin.statusCode).toBe(409);
    expect(secondJoin.json().error).toBe("room_full");

    await prisma.room.deleteMany({ where: { id: roomId } });
    await prisma.user.deleteMany({
      where: { id: { in: [hostId, first.json().user.id as string, second.json().user.id as string] } },
    });
    await prisma.$disconnect();
  });
});
