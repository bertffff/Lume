import { createPrismaClient } from "@lume/db";
import { afterAll, beforeAll, expect, it, vi } from "vitest";
import { buildApp } from "../app.js";
import { loadApiEnv } from "../env.js";
import { apiTestDatabaseUrl } from "./api-test-database.js";

const databaseUrl = apiTestDatabaseUrl();
let app: Awaited<ReturnType<typeof buildApp>>;
let prisma: ReturnType<typeof createPrismaClient>;

beforeAll(async () => {
  vi.stubEnv("DATABASE_URL", databaseUrl);
  prisma = createPrismaClient();
  app = await buildApp(loadApiEnv({
    NODE_ENV: "test",
    DATABASE_URL: databaseUrl,
    JWT_SECRET: "notification-inbox-fixture-secret",
    ALLOW_STUB_AUTH: "true",
  }), { prisma });
});

afterAll(async () => {
  try {
    await app?.close();
    await prisma?.$disconnect();
  } finally {
    vi.unstubAllEnvs();
  }
});

async function login(displayName: string) {
  const response = await app.inject({ method: "POST", url: "/auth/dev", payload: { displayName } });
  expect(response.statusCode).toBe(200);
  const { accessToken, user } = response.json<{ accessToken: string; user: { id: string } }>();
  return { id: user.id, headers: { authorization: `Bearer ${accessToken}` } };
}

it("exposes ISO timestamps and only an allowlisted friend action, never payload URLs or foreign rows", async () => {
  const recipient = await login("Inbox target recipient");
  const sender = await login("Inbox target sender");
  const createdAt = new Date("2026-11-21T18:00:00.000Z");
  const friendRequest = await app.inject({
    method: "POST", url: "/friends/request", headers: sender.headers, payload: { userId: recipient.id },
  });
  expect(friendRequest.statusCode).toBe(200);
  await prisma.notification.createMany({ data: [
    { userId: recipient.id, kind: "SYSTEM", title: "System", body: "Reminder", createdAt, data: { target: "https://example.invalid/" } },
    { userId: recipient.id, kind: "ROOM_INVITE", title: "Legacy invite", body: "Room title", data: { url: "//example.invalid" } },
    { userId: sender.id, kind: "SYSTEM", title: "Private", body: "Not for the recipient" },
  ] });

  const response = await app.inject({ method: "GET", url: "/notifications", headers: recipient.headers });
  expect(response.statusCode).toBe(200);
  expect(response.json()).toMatchObject({ unread: 3, notifications: expect.arrayContaining([
    expect.objectContaining({ kind: "FRIEND_REQUEST", target: "/profile" }),
    expect.objectContaining({ kind: "SYSTEM", createdAt: createdAt.toISOString(), target: null }),
    expect.objectContaining({ kind: "ROOM_INVITE", target: null }),
  ]) });
  expect(response.json().notifications).toHaveLength(3);
  expect(response.body).not.toContain("example.invalid");
});

it("counts all unread, marks only the caller's notifications, and preserves the first read timestamp", async () => {
  const recipient = await login("Inbox read recipient");
  const other = await login("Inbox read other");
  const own = await prisma.notification.create({ data: { userId: recipient.id, kind: "SYSTEM", title: "Mine", body: "Own note" } });
  const foreign = await prisma.notification.create({ data: { userId: other.id, kind: "SYSTEM", title: "Other", body: "Foreign note" } });
  await prisma.notification.createMany({ data: Array.from({ length: 52 }, () => ({ userId: recipient.id, kind: "SYSTEM", title: "More", body: "Additional note" })) });

  const read = (id: string) => app.inject({ method: "POST", url: `/notifications/${id}/read`, headers: recipient.headers });
  const inbox = () => app.inject({ method: "GET", url: "/notifications", headers: recipient.headers });
  const readAll = () => app.inject({ method: "POST", url: "/notifications/read-all", headers: recipient.headers });

  const initial = await inbox();
  expect(initial.json().notifications).toHaveLength(50);
  expect(initial.json().unread).toBe(53);
  expect((await read(foreign.id)).statusCode).toBe(404);
  expect((await read("missing")).statusCode).toBe(404);
  expect((await read(own.id)).json()).toEqual({ ok: true, unread: 52 });
  const firstReadAt = (await prisma.notification.findUniqueOrThrow({ where: { id: own.id } })).readAt;
  expect(firstReadAt).toBeInstanceOf(Date);
  expect((await read(own.id)).json()).toEqual({ ok: true, unread: 52 });
  expect((await readAll()).json()).toEqual({ unread: 0 });
  expect((await readAll()).json()).toEqual({ unread: 0 });
  expect((await inbox()).json().unread).toBe(0);
  expect((await prisma.notification.findUniqueOrThrow({ where: { id: own.id } })).readAt).toEqual(firstReadAt);
  expect((await prisma.notification.findUniqueOrThrow({ where: { id: foreign.id } })).readAt).toBeNull();
});
