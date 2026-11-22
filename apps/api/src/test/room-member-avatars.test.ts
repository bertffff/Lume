import { afterEach, describe, expect, it } from "vitest";
import { createPrismaClient } from "@lume/db";
import { buildApp } from "../app.js";
import { loadApiEnv } from "../env.js";
import { apiTestDatabaseUrl } from "./api-test-database.js";

const databaseUrl = apiTestDatabaseUrl();

describe("room member avatars", () => {
  let app: Awaited<ReturnType<typeof buildApp>> | undefined;
  afterEach(async () => {
    await app?.close();
  });

  it("includes each member's avatar (or null) in the room session", async () => {
    process.env.DATABASE_URL = databaseUrl;
    const prisma = createPrismaClient();
    const env = loadApiEnv({ NODE_ENV: "test", DATABASE_URL: databaseUrl, JWT_SECRET: "room-avatars-test-secret", ALLOW_STUB_AUTH: "true", WEB_ORIGIN: "http://127.0.0.1:5173" });
    app = await buildApp(env, { prisma });
    const stamp = Date.now().toString(36);
    const auth = async (name: string) => {
      const response = await app!.inject({ method: "POST", url: "/auth/dev", payload: { displayName: `${name} ${stamp}` } });
      return { token: response.json().accessToken as string, id: response.json().user.id as string };
    };
    const host = await auth("RA host");
    const guest = await auth("RA guest");
    const headers = (token: string) => ({ authorization: `Bearer ${token}` });
    const avatarUrl = `https://cdn.example.com/avatar-${stamp}.png`;
    await prisma.user.update({ where: { id: host.id }, data: { avatarUrl } });

    const created = await app.inject({ method: "POST", url: "/rooms", headers: headers(host.token), payload: { title: `RA ${stamp}` } });
    const roomId = created.json().room.id as string;
    const joined = await app.inject({ method: "POST", url: "/rooms/join", headers: headers(guest.token), payload: { code: created.json().room.code } });
    expect(joined.statusCode).toBe(200);

    const session = (await app.inject({ method: "GET", url: `/rooms/${roomId}`, headers: headers(guest.token) })).json() as { members: Array<{ userId: string; avatarUrl?: string | null }> };
    expect(session.members.find((member) => member.userId === host.id)?.avatarUrl).toBe(avatarUrl);
    expect(session.members.find((member) => member.userId === guest.id)?.avatarUrl).toBeNull();

    await prisma.room.deleteMany({ where: { id: roomId } });
    await prisma.user.deleteMany({ where: { id: { in: [host.id, guest.id] } } });
    await prisma.$disconnect();
  });
});
