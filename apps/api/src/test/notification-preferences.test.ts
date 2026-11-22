import { afterEach, describe, expect, it } from "vitest";
import { createPrismaClient } from "@lume/db";
import { buildApp } from "../app.js";
import { loadApiEnv } from "../env.js";
import { apiTestDatabaseUrl } from "./api-test-database.js";

const databaseUrl = apiTestDatabaseUrl();

describe("notification preferences", () => {
  let app: Awaited<ReturnType<typeof buildApp>> | undefined;
  afterEach(async () => {
    await app?.close();
  });

  it("reads defaults and returns what was saved", async () => {
    process.env.DATABASE_URL = databaseUrl;
    const prisma = createPrismaClient();
    const env = loadApiEnv({ NODE_ENV: "test", DATABASE_URL: databaseUrl, JWT_SECRET: "notification-preferences-test-secret", ALLOW_STUB_AUTH: "true", WEB_ORIGIN: "http://127.0.0.1:5173" });
    app = await buildApp(env, { prisma });
    const stamp = Date.now().toString(36);
    const login = await app.inject({ method: "POST", url: "/auth/dev", payload: { displayName: `Prefs ${stamp}` } });
    const headers = { authorization: `Bearer ${login.json().accessToken as string}` };
    const userId = login.json().user.id as string;

    expect((await app.inject({ method: "GET", url: "/me/notification-preferences" })).statusCode).toBe(401);
    const initial = await app.inject({ method: "GET", url: "/me/notification-preferences", headers });
    expect(initial.statusCode).toBe(200);
    expect(initial.json()).toEqual({
      preferences: [],
      delivery: { digest: "INSTANT", quietHoursEnabled: false, quietStart: "22:00", quietEnd: "08:00", timezone: "UTC" },
    });

    const save = (payload: object) => app!.inject({ method: "PUT", url: "/me/notification-preferences", headers, payload });
    expect((await save({ channel: "telegram", kind: "ROOM_INVITE", enabled: false })).statusCode).toBeLessThan(300);
    expect((await save({ channel: "telegram", kind: "SYSTEM", enabled: true, digest: "DAILY", quietHoursEnabled: true, quietStart: "23:00", quietEnd: "07:30" })).statusCode).toBeLessThan(300);

    const after = (await app.inject({ method: "GET", url: "/me/notification-preferences", headers })).json();
    expect(after.preferences).toEqual(expect.arrayContaining([
      { channel: "telegram", kind: "ROOM_INVITE", enabled: false },
      { channel: "telegram", kind: "SYSTEM", enabled: true },
    ]));
    expect(after.delivery).toMatchObject({ digest: "DAILY", quietHoursEnabled: true, quietStart: "23:00", quietEnd: "07:30" });

    await prisma.user.deleteMany({ where: { id: userId } });
    await prisma.$disconnect();
  });
});
