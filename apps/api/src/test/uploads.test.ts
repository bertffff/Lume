import { afterEach, describe, expect, it } from "vitest";
import { createPrismaClient } from "@lume/db";
import { buildApp } from "../app.js";
import { loadApiEnv } from "../env.js";

const databaseUrl = "postgresql://lume:lume@127.0.0.1:5432/lume_test?schema=public";
const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.alloc(32, 1),
]);

describe("uploads", () => {
  let app: Awaited<ReturnType<typeof buildApp>> | undefined;
  let prisma: ReturnType<typeof createPrismaClient> | undefined;

  afterEach(async () => {
    await app?.close();
    await prisma?.$disconnect();
  });

  it("stores bytes, persists metadata, and serves them back", async () => {
    process.env.DATABASE_URL = databaseUrl;
    prisma = createPrismaClient();
    const env = loadApiEnv({
      NODE_ENV: "test",
      DATABASE_URL: databaseUrl,
      JWT_SECRET: "upload-test-secret",
      ALLOW_STUB_AUTH: "true",
      WEB_ORIGIN: "http://127.0.0.1:5173",
    });
    app = await buildApp(env, { prisma });
    const stamp = Date.now().toString(36);
    const login = await app.inject({ method: "POST", url: "/auth/dev", payload: { displayName: `Upload ${stamp}` } });
    const token = login.json().accessToken as string;
    const userId = login.json().user.id as string;

    const upload = await app.inject({
      method: "POST",
      url: "/uploads",
      headers: { authorization: `Bearer ${token}` },
      payload: { dataBase64: png.toString("base64") },
    });
    expect(upload.statusCode).toBe(200);
    const body = upload.json() as { url: string; backend: string };
    expect(body.backend).toBe("local");
    expect(body.url).toMatch(/^\/uploads\/[0-9a-f]+$/);

    const row = await prisma.mediaObject.findFirst({ where: { userId } });
    expect(row).toMatchObject({ backend: "local", mimeType: "image/png", byteSize: png.length });

    const fetched = await app.inject({ method: "GET", url: body.url });
    expect(fetched.statusCode).toBe(200);
    expect(fetched.headers["content-type"]).toContain("image/png");
    expect(Buffer.from(fetched.rawPayload).equals(png)).toBe(true);
  });

  it("rejects a non-image payload", async () => {
    process.env.DATABASE_URL = databaseUrl;
    prisma = createPrismaClient();
    const env = loadApiEnv({
      NODE_ENV: "test",
      DATABASE_URL: databaseUrl,
      JWT_SECRET: "upload-test-secret",
      ALLOW_STUB_AUTH: "true",
    });
    app = await buildApp(env, { prisma });
    const login = await app.inject({ method: "POST", url: "/auth/dev", payload: { displayName: `Upload bad ${Date.now()}` } });
    const upload = await app.inject({
      method: "POST",
      url: "/uploads",
      headers: { authorization: `Bearer ${login.json().accessToken as string}` },
      payload: { dataBase64: Buffer.from("not an image").toString("base64") },
    });
    expect(upload.statusCode).toBe(400);
    expect(upload.json()).toEqual({ error: "not_image" });
  });

  it("answers storage_unconfigured in production without CDN or Telegram", async () => {
    process.env.DATABASE_URL = databaseUrl;
    prisma = createPrismaClient();
    const env = loadApiEnv({
      NODE_ENV: "production",
      DATABASE_URL: databaseUrl,
      REDIS_URL: "redis://127.0.0.1:6379",
      JWT_SECRET: "upload-test-secret",
      ALLOW_STUB_AUTH: "true",
    });
    app = await buildApp(env, { prisma });
    const login = await app.inject({ method: "POST", url: "/auth/dev", payload: { displayName: `Upload prod ${Date.now()}` } });
    const upload = await app.inject({
      method: "POST",
      url: "/uploads",
      headers: { authorization: `Bearer ${login.json().accessToken as string}` },
      payload: { dataBase64: png.toString("base64") },
    });
    expect(upload.statusCode).toBe(503);
    expect(upload.json()).toEqual({ error: "storage_unconfigured" });
  });
});
