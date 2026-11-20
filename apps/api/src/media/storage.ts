import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ApiEnv } from "../env.js";

export type MediaBackend = "s3" | "telegram" | "local";
export type StorageBackend = MediaBackend | "none";

export class StorageUnconfiguredError extends Error {
  constructor() {
    super("storage_unconfigured");
    this.name = "StorageUnconfiguredError";
  }
}

export interface PutInput {
  key: string;
  bytes: Buffer;
  mimeType: string;
}

export interface PutResult {
  backend: MediaBackend;
  storageKey: string;
  publicUrl: string | null;
  telegramFileId: string | null;
}

/** The subset of a persisted `MediaObject` row the reader needs. */
export interface StoredRef {
  backend: string;
  storageKey: string;
  publicUrl: string | null;
  telegramFileId: string | null;
  mimeType: string;
}

export type ReadResult =
  | { kind: "redirect"; url: string }
  | { kind: "bytes"; bytes: Buffer; mimeType: string };

export interface MediaStorage {
  readonly backend: StorageBackend;
  put(input: PutInput): Promise<PutResult>;
  read(ref: StoredRef): Promise<ReadResult | null>;
}

interface S3Like {
  send(command: PutObjectCommand | GetObjectCommand): Promise<unknown>;
}

export interface StorageOptions {
  env: ApiEnv;
  fetchImpl?: typeof fetch;
  /** Tests point this at a local `node:http` server instead of Telegram. */
  telegramApiBase?: string;
  s3Client?: S3Like;
}

const telegramCacheTtlMs = 60 * 60_000;

function extensionFor(mimeType: string): string {
  const known: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/gif": "gif",
    "image/webp": "webp",
  };
  return known[mimeType] ?? "bin";
}

function localPath(key: string): string {
  return join(tmpdir(), "lume-uploads", key);
}

function s3Configured(env: ApiEnv): boolean {
  return Boolean(env.CDN_ENDPOINT && env.CDN_BUCKET && env.CDN_ACCESS_KEY && env.CDN_SECRET_KEY);
}

function publicUrlFor(env: ApiEnv, key: string): string {
  if (env.CDN_PUBLIC_URL) {
    return `${env.CDN_PUBLIC_URL.replace(/\/$/, "")}/${key}`;
  }
  const endpoint = (env.CDN_ENDPOINT ?? "").replace(/\/$/, "");
  return `${endpoint}/${env.CDN_BUCKET}/${key}`;
}

/** S3/R2 first, then Telegram storage, else local disk in development only. */
export function resolveStorageBackend(env: ApiEnv): StorageBackend {
  if (s3Configured(env)) return "s3";
  if (env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_STORAGE_CHAT) return "telegram";
  if (env.NODE_ENV !== "production") return "local";
  return "none";
}

export function createMediaStorage(options: StorageOptions): MediaStorage {
  const { env } = options;
  const doFetch = options.fetchImpl ?? fetch;
  const backend = resolveStorageBackend(env);
  const telegramBase = options.telegramApiBase ?? "https://api.telegram.org";
  const telegramPaths = new Map<string, { path: string; expiresAt: number }>();
  const s3 =
    backend === "s3"
      ? (options.s3Client ??
        new S3Client({
          region: env.CDN_REGION ?? "auto",
          endpoint: env.CDN_ENDPOINT,
          forcePathStyle: true,
          credentials: {
            accessKeyId: env.CDN_ACCESS_KEY as string,
            secretAccessKey: env.CDN_SECRET_KEY as string,
          },
        }))
      : null;

  async function telegramUpload(input: PutInput): Promise<PutResult> {
    const form = new FormData();
    form.set("chat_id", env.TELEGRAM_STORAGE_CHAT as string);
    form.set(
      "document",
      new Blob([new Uint8Array(input.bytes)], { type: input.mimeType }),
      `${input.key}.${extensionFor(input.mimeType)}`,
    );
    const response = await doFetch(`${telegramBase}/bot${env.TELEGRAM_BOT_TOKEN}/sendDocument`, {
      method: "POST",
      body: form,
      signal: AbortSignal.timeout(30_000),
    });
    const payload = (await response.json().catch(() => null)) as
      | { ok?: boolean; result?: { document?: { file_id?: string } } }
      | null;
    const fileId = payload?.result?.document?.file_id;
    if (!response.ok || !payload?.ok || !fileId) {
      throw new Error(`telegram_upload_failed:${response.status}`);
    }
    return { backend: "telegram", storageKey: fileId, publicUrl: null, telegramFileId: fileId };
  }

  async function telegramPath(fileId: string): Promise<string | null> {
    const cached = telegramPaths.get(fileId);
    if (cached && cached.expiresAt > Date.now()) return cached.path;
    const response = await doFetch(
      `${telegramBase}/bot${env.TELEGRAM_BOT_TOKEN}/getFile?file_id=${encodeURIComponent(fileId)}`,
      { signal: AbortSignal.timeout(15_000) },
    );
    const payload = (await response.json().catch(() => null)) as
      | { ok?: boolean; result?: { file_path?: string } }
      | null;
    const path = payload?.result?.file_path;
    if (!response.ok || !payload?.ok || !path) return null;
    telegramPaths.set(fileId, { path, expiresAt: Date.now() + telegramCacheTtlMs });
    return path;
  }

  return {
    backend,
    async put(input) {
      if (backend === "s3" && s3) {
        await s3.send(
          new PutObjectCommand({
            Bucket: env.CDN_BUCKET,
            Key: input.key,
            Body: input.bytes,
            ContentType: input.mimeType,
            CacheControl: "public, max-age=31536000, immutable",
          }),
        );
        const publicUrl = publicUrlFor(env, input.key);
        return { backend: "s3", storageKey: input.key, publicUrl, telegramFileId: null };
      }
      if (backend === "telegram") {
        return telegramUpload(input);
      }
      if (backend === "local") {
        const path = localPath(input.key);
        await mkdir(join(tmpdir(), "lume-uploads"), { recursive: true });
        await writeFile(path, input.bytes);
        return { backend: "local", storageKey: input.key, publicUrl: null, telegramFileId: null };
      }
      throw new StorageUnconfiguredError();
    },
    async read(ref) {
      if (ref.backend === "s3") {
        if (ref.publicUrl) return { kind: "redirect", url: ref.publicUrl };
        if (!s3) return null;
        const result = (await s3.send(
          new GetObjectCommand({ Bucket: env.CDN_BUCKET, Key: ref.storageKey }),
        )) as { Body?: { transformToByteArray?: () => Promise<Uint8Array> } };
        const bytes = await result.Body?.transformToByteArray?.();
        return bytes ? { kind: "bytes", bytes: Buffer.from(bytes), mimeType: ref.mimeType } : null;
      }
      if (ref.backend === "telegram") {
        if (!ref.telegramFileId) return null;
        const path = await telegramPath(ref.telegramFileId);
        if (!path) return null;
        const response = await doFetch(`${telegramBase}/file/bot${env.TELEGRAM_BOT_TOKEN}/${path}`, {
          signal: AbortSignal.timeout(30_000),
        });
        if (!response.ok) return null;
        return { kind: "bytes", bytes: Buffer.from(await response.arrayBuffer()), mimeType: ref.mimeType };
      }
      if (ref.backend === "local") {
        const bytes = await readFile(localPath(ref.storageKey)).catch(() => null);
        return bytes ? { kind: "bytes", bytes, mimeType: ref.mimeType } : null;
      }
      return null;
    },
  };
}
