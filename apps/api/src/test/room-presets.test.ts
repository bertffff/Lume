import { afterEach, describe, expect, it } from "vitest";
import { createPrismaClient } from "@lume/db";
import { buildApp } from "../app.js";
import { loadApiEnv } from "../env.js";

import { apiTestDatabaseUrl } from "./api-test-database.js";

const databaseUrl = apiTestDatabaseUrl();

describe("moderation presets on room creation", () => {
  let app: Awaited<ReturnType<typeof buildApp>> | undefined;

  afterEach(async () => {
    await app?.close();
  });

  it("applies privacy, member cap, slow mode, and viewer rights from the preset", async () => {
    process.env.DATABASE_URL = databaseUrl;
    const prisma = createPrismaClient();
    const env = loadApiEnv({
      NODE_ENV: "test",
      DATABASE_URL: databaseUrl,
      JWT_SECRET: "presets-test-secret",
      ALLOW_STUB_AUTH: "true",
      WEB_ORIGIN: "http://127.0.0.1:5173",
    });
    app = await buildApp(env, { prisma });
    const stamp = Date.now().toString(36);
    const hostLogin = await app.inject({ method: "POST", url: "/auth/dev", payload: { displayName: `Preset host ${stamp}` } });
    const guestLogin = await app.inject({ method: "POST", url: "/auth/dev", payload: { displayName: `Preset guest ${stamp}` } });
    const host = hostLogin.json() as { accessToken: string; user: { id: string } };
    const guest = guestLogin.json() as { accessToken: string; user: { id: string } };

    const closed = await app.inject({
      method: "POST",
      url: "/rooms",
      headers: { authorization: `Bearer ${host.accessToken}` },
      payload: { title: `Закрытый ${stamp}`, preset: "closed" },
    });
    expect(closed.statusCode).toBe(200);
    const closedRoom = closed.json() as { room: { id: string; code: string } };

    const stored = await prisma.room.findUnique({ where: { id: closedRoom.room.id } });
    expect(stored?.isPublic).toBe(false);
    expect(stored?.maxMembers).toBe(6);
    expect(stored?.hideReactions).toBe(false);
    expect(stored?.slowModeSeconds).toBe(0);
    expect(stored?.defaultPermissions).toMatchObject({
      canChat: true,
      canSpeak: false,
      canReact: true,
      canQueue: false,
      canSeek: false,
      canInvite: false,
    });

    const joined = await app.inject({
      method: "POST",
      url: "/rooms/join",
      headers: { authorization: `Bearer ${guest.accessToken}` },
      payload: { code: closedRoom.room.code },
    });
    expect(joined.statusCode).toBe(200);
    expect(joined.json().self.permissions).toMatchObject({
      canChat: true,
      canSpeak: false,
      canAddToQueue: false,
      canInvite: false,
    });

    const moderated = await app.inject({
      method: "POST",
      url: "/rooms",
      headers: { authorization: `Bearer ${host.accessToken}` },
      payload: { title: `С модерацией ${stamp}`, preset: "moderated" },
    });
    expect(moderated.statusCode).toBe(200);
    const moderatedRoom = moderated.json() as { room: { id: string } };
    const moderatedRow = await prisma.room.findUnique({ where: { id: moderatedRoom.room.id } });
    expect(moderatedRow?.maxMembers).toBe(25);
    expect(moderatedRow?.hideReactions).toBe(true);
    expect(moderatedRow?.slowModeSeconds).toBe(10);
    expect(moderatedRow?.defaultPermissions).toMatchObject({ canSpeak: true, canInvite: false });

    const party = await app.inject({
      method: "POST",
      url: "/rooms",
      headers: { authorization: `Bearer ${host.accessToken}` },
      payload: { title: `Вечеринка ${stamp}`, preset: "party" },
    });
    expect(party.statusCode).toBe(200);
    const partyRow = await prisma.room.findUnique({ where: { id: (party.json() as { room: { id: string } }).room.id } });
    expect(partyRow?.isPublic).toBe(true);
    expect(partyRow?.maxMembers).toBe(50);

    const invalid = await app.inject({
      method: "POST",
      url: "/rooms",
      headers: { authorization: `Bearer ${host.accessToken}` },
      payload: { title: `Unknown ${stamp}`, preset: "unknown" },
    });
    expect(invalid.statusCode).toBe(400);

    const rooms = [closedRoom.room.id, moderatedRoom.room.id, (party.json() as { room: { id: string } }).room.id];
    await prisma.room.deleteMany({ where: { id: { in: rooms } } });
    await prisma.user.deleteMany({ where: { id: { in: [host.user.id, guest.user.id] } } });
    await prisma.$disconnect();
  });
});
