import { afterEach, describe, expect, it } from "vitest";
import { createPrismaClient } from "@lume/db";
import { buildApp } from "../app.js";
import { loadApiEnv } from "../env.js";

import { apiTestDatabaseUrl } from "./api-test-database.js";

const databaseUrl = apiTestDatabaseUrl();

describe("report a room member", () => {
  let app: Awaited<ReturnType<typeof buildApp>> | undefined;

  afterEach(async () => {
    await app?.close();
  });

  it("stores the selected member as the report target", async () => {
    process.env.DATABASE_URL = databaseUrl;
    const prisma = createPrismaClient();
    const env = loadApiEnv({
      NODE_ENV: "test",
      DATABASE_URL: databaseUrl,
      JWT_SECRET: "report-test-secret",
      ALLOW_STUB_AUTH: "true",
      WEB_ORIGIN: "http://127.0.0.1:5173",
    });
    app = await buildApp(env, { prisma });
    const stamp = Date.now().toString(36);
    const hostLogin = await app.inject({ method: "POST", url: "/auth/dev", payload: { displayName: `Host ${stamp}` } });
    const guestLogin = await app.inject({ method: "POST", url: "/auth/dev", payload: { displayName: `Guest ${stamp}` } });
    expect(hostLogin.statusCode).toBe(200);
    expect(guestLogin.statusCode).toBe(200);
    const host = hostLogin.json() as { accessToken: string; user: { id: string } };
    const guest = guestLogin.json() as { accessToken: string; user: { id: string } };
    const created = await app.inject({
      method: "POST",
      url: "/rooms",
      headers: { authorization: `Bearer ${host.accessToken}` },
      payload: { title: "Жалоба", isPublic: true },
    });
    expect(created.statusCode).toBe(200);
    const room = created.json() as { room: { id: string; code: string } };
    const joined = await app.inject({
      method: "POST",
      url: "/rooms/join",
      headers: { authorization: `Bearer ${guest.accessToken}` },
      payload: { code: room.room.code },
    });
    expect(joined.statusCode).toBe(200);
    const reported = await app.inject({
      method: "POST",
      url: "/reports",
      headers: { authorization: `Bearer ${host.accessToken}` },
      payload: { targetKind: "user", targetId: guest.user.id, roomId: room.room.id, reason: "спам в чате" },
    });
    expect(reported.statusCode).toBe(200);
    const row = await prisma.report.findUnique({ where: { id: reported.json().id as string } });
    expect(row?.targetId).toBe(guest.user.id);
    expect(row?.targetUserId).toBe(guest.user.id);
    expect(row?.reporterId).toBe(host.user.id);
    await prisma.report.deleteMany({ where: { id: row?.id } });
    await prisma.$disconnect();
  });
});
