import { createServer, type Server } from "node:http";
import { afterEach, describe, expect, it } from "vitest";
import { loadApiEnv } from "../env.js";
import {
  createMediaStorage,
  resolveStorageBackend,
  StorageUnconfiguredError,
} from "./storage.js";

const servers: Server[] = [];

afterEach(async () => {
  await Promise.all(
    servers.splice(0).map((server) => new Promise<void>((resolve) => server.close(() => resolve()))),
  );
});

function envFor(overrides: Record<string, string | undefined>) {
  return loadApiEnv({
    NODE_ENV: "development",
    ...overrides,
  });
}

describe("storage backend selection", () => {
  it("uses local disk in development when nothing is configured", () => {
    expect(resolveStorageBackend(envFor({}))).toBe("local");
  });

  it("refuses uploads in production without storage", () => {
    expect(resolveStorageBackend(envFor({ NODE_ENV: "production", REDIS_URL: "redis://x" }))).toBe("none");
  });

  it("requires the full S3 credential set", () => {
    expect(
      resolveStorageBackend(
        envFor({ CDN_ENDPOINT: "https://cdn.example", CDN_BUCKET: "b", CDN_ACCESS_KEY: "a" }),
      ),
    ).toBe("local");
    expect(
      resolveStorageBackend(
        envFor({
          CDN_ENDPOINT: "https://cdn.example",
          CDN_BUCKET: "b",
          CDN_ACCESS_KEY: "a",
          CDN_SECRET_KEY: "s",
        }),
      ),
    ).toBe("s3");
  });

  it("requires both the bot token and the storage chat for Telegram", () => {
    expect(resolveStorageBackend(envFor({ TELEGRAM_STORAGE_CHAT: "-100" }))).toBe("local");
    expect(resolveStorageBackend(envFor({ TELEGRAM_BOT_TOKEN: "bot" }))).toBe("local");
    expect(
      resolveStorageBackend(
        envFor({ TELEGRAM_BOT_TOKEN: "bot", TELEGRAM_STORAGE_CHAT: "-100" }),
      ),
    ).toBe("telegram");
  });
});

describe("local storage", () => {
  it("writes bytes and reads them back", async () => {
    const storage = createMediaStorage({ env: envFor({}) });
    const bytes = Buffer.from("hello");
    const stored = await storage.put({ key: "unit-local", bytes, mimeType: "image/png" });
    expect(stored.backend).toBe("local");
    const read = await storage.read({
      backend: stored.backend,
      storageKey: stored.storageKey,
      publicUrl: stored.publicUrl,
      telegramFileId: stored.telegramFileId,
      mimeType: "image/png",
    });
    expect(read?.kind).toBe("bytes");
    if (read?.kind === "bytes") expect(read.bytes.equals(bytes)).toBe(true);
  });
});

describe("production without storage", () => {
  it("throws storage_unconfigured instead of faking a URL", async () => {
    const storage = createMediaStorage({
      env: envFor({ NODE_ENV: "production", REDIS_URL: "redis://x" }),
    });
    await expect(
      storage.put({ key: "x", bytes: Buffer.from("x"), mimeType: "image/png" }),
    ).rejects.toBeInstanceOf(StorageUnconfiguredError);
  });
});

describe("telegram storage", () => {
  it("uploads a document and resolves the file path on read", async () => {
    const seen: string[] = [];
    const server = createServer((request, response) => {
      seen.push(request.url ?? "");
      if (request.url?.endsWith("/sendDocument")) {
        response.writeHead(200, { "content-type": "application/json" });
        response.end(JSON.stringify({ ok: true, result: { document: { file_id: "FILE1" } } }));
        return;
      }
      if (request.url?.startsWith("/botTEST/getFile")) {
        response.writeHead(200, { "content-type": "application/json" });
        response.end(JSON.stringify({ ok: true, result: { file_path: "documents/file.png" } }));
        return;
      }
      if (request.url === "/file/botTEST/documents/file.png") {
        response.writeHead(200, { "content-type": "image/png" });
        response.end(Buffer.from("telegram-bytes"));
        return;
      }
      response.writeHead(404);
      response.end();
    });
    servers.push(server);
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
    const address = server.address();
    const base =
      typeof address === "object" && address ? `http://127.0.0.1:${address.port}` : "";

    const storage = createMediaStorage({
      env: envFor({ TELEGRAM_BOT_TOKEN: "TEST", TELEGRAM_STORAGE_CHAT: "-100" }),
      telegramApiBase: base,
    });
    const stored = await storage.put({
      key: "tg",
      bytes: Buffer.from("upload"),
      mimeType: "image/png",
    });
    expect(stored).toMatchObject({ backend: "telegram", telegramFileId: "FILE1" });

    const read = await storage.read({
      backend: stored.backend,
      storageKey: stored.storageKey,
      publicUrl: stored.publicUrl,
      telegramFileId: stored.telegramFileId,
      mimeType: "image/png",
    });
    expect(read?.kind).toBe("bytes");
    if (read?.kind === "bytes") expect(read.bytes.toString()).toBe("telegram-bytes");
    expect(seen.some((url) => url.includes("sendDocument"))).toBe(true);
    expect(seen.some((url) => url.includes("getFile"))).toBe(true);
  });
});
