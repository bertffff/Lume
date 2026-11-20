import { detectSource, dnsPinned, extractorsEnabled, hostAllowed, needsRange, parseAllowlist, planPlayback, refreshKeepsPlayback, rewriteDashManifest, rewriteHlsManifest, urlBlocked } from "@lume/contracts";
import { verifyAccessToken } from "@lume/contracts/node";
import { createMediaRegistry, expiresAtFromUrl, resolveMediaChain, searchVideos } from "@lume/media";
import type { PrismaClient } from "@lume/db";
import type { FastifyInstance } from "fastify";
import { lookup } from "node:dns/promises";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import { z } from "zod";
import type { ApiEnv } from "../env.js";
import type { RedisLike } from "../redis.js";

type StreamTarget = { response: Response } | { error: "blocked" | "host_not_allowed" | "upstream" };

const redirectCodes = new Set([301, 302, 303, 307, 308]);

/** A public hostname may still resolve to a private address; resolve it on every hop. */
async function resolvesPublic(hostname: string): Promise<boolean> {
  return dnsPinned(hostname, async (host) => {
    const rows = await lookup(host, { all: true, verbatim: true });
    return rows.map((row) => row.address);
  }).catch(() => false);
}

async function openStream(url: string, range: string, env: ApiEnv, allowlist: readonly string[], hop = 0): Promise<StreamTarget> {
  if (hop > 3) return { error: "upstream" };
  const parsed = new URL(url);
  const hostname = parsed.hostname.replace(/^\[|\]$/g, "");
  if (urlBlocked(url) && !env.STREAM_ALLOW_PRIVATE_HOSTS) return { error: "blocked" };
  if (!hostAllowed(hostname, allowlist)) return { error: "host_not_allowed" };
  if (!env.STREAM_ALLOW_PRIVATE_HOSTS && !(await resolvesPublic(hostname))) return { error: "blocked" };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), env.STREAM_HEADER_TIMEOUT_MS);
  const response = await fetch(url, {
    headers: range ? { range, accept: "*/*" } : { accept: "*/*" },
    redirect: "manual",
    signal: controller.signal,
  }).catch(() => null);
  clearTimeout(timer);
  if (!response) return { error: "upstream" };
  if (redirectCodes.has(response.status)) {
    const location = response.headers.get("location");
    if (!location) return { error: "upstream" };
    let next: string;
    try {
      next = new URL(location, url).toString();
    } catch {
      return { error: "upstream" };
    }
    return openStream(next, range, env, allowlist, hop + 1);
  }
  return { response };
}

function cappedBody(body: ReadableStream<Uint8Array>, maxBytes: number): Readable {
  let total = 0;
  const limiter = new Transform({
    transform(chunk: Buffer, _encoding, callback) {
      total += chunk.byteLength;
      if (total > maxBytes) {
        callback(new Error("too_large"));
        return;
      }
      callback(null, chunk);
    },
  });
  const source = Readable.fromWeb(body as never);
  void pipeline(source, limiter).catch(() => undefined);
  return limiter;
}

const textLikeContent = /^(text\/|application\/(xml|json|x-mpegurl|vnd\.apple\.mpegurl|dash\+xml|octet-stream))/i;
const binaryExtension = /\.(ts|m4s|mp4|m4a|m4v|aac|webm|vtt|key|bin|jpg|jpeg|png|gif)(?:$|[?#])/i;
const manifestReadCap = 1024 * 1024;

async function boundedText(response: Response, limit = manifestReadCap): Promise<{ text: string; truncated: boolean }> {
  if (!response.body) return { text: "", truncated: false };
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  let truncated = false;
  try {
    while (total < limit) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      const slice = value.byteLength > limit - total ? value.slice(0, limit - total) : value;
      if (slice.byteLength < value.byteLength) truncated = true;
      chunks.push(slice);
      total += slice.byteLength;
    }
    if (!truncated && total >= limit) {
      const extra = await reader.read();
      if (!extra.done && extra.value && extra.value.byteLength > 0) truncated = true;
    }
  } finally {
    await reader.cancel().catch(() => undefined);
  }
  return { text: Buffer.concat(chunks.map((chunk) => Buffer.from(chunk))).toString("utf8"), truncated };
}

export interface VideoRouteOptions {
  redis?: RedisLike | null;
}

export function registerVideoRoutes(
  app: FastifyInstance,
  env: ApiEnv,
  prisma: PrismaClient | null = null,
  _options: VideoRouteOptions = {},
): void {
  const allowlist = parseAllowlist(env.STREAM_ALLOWLIST);
  const mediaEnabled = extractorsEnabled(env.FF_EXTRACTORS);
  const mediaConfig = {
    ...(env.COBALT_API_URL ? { cobaltApiUrl: env.COBALT_API_URL } : {}),
    ...(env.YTDLP_PATH ? { ytdlpPath: env.YTDLP_PATH } : {}),
    ...(env.VK_COOKIES ? { vkCookies: env.VK_COOKIES } : {}),
    ...(env.TWITCH_CLIENT_ID ? { twitchClientId: env.TWITCH_CLIENT_ID } : {}),
    ...(env.TWITCH_CLIENT_SECRET ? { twitchClientSecret: env.TWITCH_CLIENT_SECRET } : {}),
    ...(env.SEARXNG_URL ? { searxngUrl: env.SEARXNG_URL } : {}),
    timeoutMs: env.MEDIA_EXTRACTOR_TIMEOUT_MS,
  };

  app.get("/video/range", async (request, reply) => {
    const query = z.object({ url: z.string().url() }).safeParse(request.query);
    if (!query.success) return reply.code(400).send({ error: "blocked" });
    if (urlBlocked(query.data.url) && !env.STREAM_ALLOW_PRIVATE_HOSTS) return reply.code(400).send({ error: "blocked" });
    const range = request.headers.range;
    if (typeof range !== "string" || needsRange(range)) return reply.code(416).send({ error: "range_required" });
    const opened = await openStream(query.data.url, range, env, allowlist);
    if ("error" in opened) {
      const status = opened.error === "host_not_allowed" ? 403 : opened.error === "blocked" ? 400 : 502;
      return reply.code(status).send({ error: opened.error });
    }
    const upstream = opened.response;
    if (upstream.status === 403 || upstream.status === 410) {
      return reply.code(410).header("x-lume-retry", "true").send({ error: "expired" });
    }
    const length = Number(upstream.headers.get("content-length") ?? "0");
    if (Number.isFinite(length) && length > env.STREAM_MAX_BYTES) {
      return reply.code(413).send({ error: "too_large" });
    }
    reply.header("accept-ranges", "bytes");
    reply.header("cache-control", "private, max-age=1800");
    if (upstream.headers.get("content-range")) reply.header("content-range", upstream.headers.get("content-range") ?? "");
    if (upstream.headers.get("content-length") && length <= env.STREAM_MAX_BYTES) reply.header("content-length", String(length));
    if (upstream.headers.get("content-type")) reply.header("content-type", upstream.headers.get("content-type") ?? "application/octet-stream");
    if (!upstream.body) return reply.code(upstream.status).send();
    return reply.code(upstream.status).send(cappedBody(upstream.body, env.STREAM_MAX_BYTES));
  });

  app.post("/video/refresh", async (request, reply) => {
    const body = z
      .object({
        url: z.string().min(1),
        roomId: z.string().min(1).optional(),
        positionMs: z.number().optional(),
        playing: z.boolean().optional(),
      })
      .safeParse(request.body);
    if (!body.success) return reply.code(400).send({ error: "invalid_body" });
    if (!mediaEnabled) {
      return reply.code(503).send({ error: "extractors_disabled" });
    }
    const report = createMediaRegistry(mediaConfig);
    const outcome = await resolveMediaChain(report, body.data.url, env.MEDIA_EXTRACTOR_TIMEOUT_MS);
    if (outcome.status === "no_extractor") {
      return reply.code(422).send({ error: "no_extractor" });
    }
    if (outcome.status === "failed") {
      request.log.warn({ attempts: outcome.attempts }, "stream refresh failed");
      return reply.code(502).send({ error: "refresh_failed", attempts: outcome.attempts });
    }
    const nextUrl = outcome.media.playback?.url;
    if (!nextUrl) {
      return reply.code(502).send({ error: "refresh_failed" });
    }
    const expiresAt = expiresAtFromUrl(nextUrl);
    if (prisma) {
      await prisma.queueItem.updateMany({
        where: {
          url: body.data.url,
          ...(body.data.roomId ? { roomId: body.data.roomId } : {}),
        },
        data: { url: nextUrl, expiresAt: expiresAt === null ? null : new Date(expiresAt) },
      });
    }
    return reply.send({
      url: nextUrl,
      ...(expiresAt === null ? {} : { expiresAt: new Date(expiresAt).toISOString() }),
      ...refreshKeepsPlayback(body.data.positionMs ?? 0, body.data.playing === true),
    });
  });

  app.post("/video/detect", async (request, reply) => {
    const body = z.object({ url: z.string().min(1) }).safeParse(request.body);
    if (!body.success) return reply.code(400).send({ error: "invalid_body" });
    const source = detectSource(body.data.url);
    let premium = false;
    const header = request.headers.authorization;
    if (prisma && env.JWT_SECRET && header?.startsWith("Bearer ")) {
      try {
        const actor = await verifyAccessToken(env.JWT_SECRET, header.slice("Bearer ".length));
        const user = await prisma.user.findUnique({ where: { id: actor.userId }, select: { isPremium: true } });
        premium = Boolean(user?.isPremium);
      } catch {
        premium = false;
      }
    }
    return reply.send({ source: source?.id ?? null, plan: planPlayback({ url: body.data.url, premium }) });
  });

  app.get("/video/search", async (request, reply) => {
    const query = z.object({ q: z.string().min(1) }).safeParse(request.query);
    if (!query.success) return reply.code(400).send({ error: "invalid_body" });
    if (!env.SEARXNG_URL) {
      return reply.send({ results: [], unavailable: true, reason: "searxng_unconfigured" });
    }
    const response = await searchVideos(mediaConfig, query.data.q).catch(() => null);
    if (!response) return reply.send({ results: [], unavailable: true, reason: "searxng_unavailable" });
    return reply.send(response);
  });

  app.get("/video/hls-proxy", async (request, reply) => {
    const query = z.object({ url: z.string().url(), source: z.string().default("direct") }).safeParse(request.query);
    if (!query.success) return reply.code(400).send({ error: "blocked" });
    if (urlBlocked(query.data.url) && !env.STREAM_ALLOW_PRIVATE_HOSTS) return reply.code(400).send({ error: "blocked" });
    const requestedRange = typeof request.headers.range === "string" ? request.headers.range : "";
    const opened = await openStream(query.data.url, requestedRange, env, allowlist);
    if ("error" in opened) {
      const status = opened.error === "host_not_allowed" ? 403 : opened.error === "blocked" ? 400 : 502;
      return reply.code(status).send({ error: opened.error });
    }
    const upstream = opened.response;
    if (upstream.status === 403 || upstream.status === 410) {
      return reply.code(410).header("x-lume-retry", "true").send({ error: "expired" });
    }
    if (!upstream.ok) return reply.code(502).send({ error: "upstream" });
    const pathname = new URL(query.data.url).pathname;
    const contentType = upstream.headers.get("content-type") ?? "";
    const sniffText = !binaryExtension.test(pathname) && !/^(video|audio|image)\//i.test(contentType);
    if (sniffText) {
      const declared = Number(upstream.headers.get("content-length") ?? "0");
      if (Number.isFinite(declared) && declared > manifestReadCap) {
        return reply.code(413).send({ error: "too_large" });
      }
      const body = await boundedText(upstream);
      if (body.truncated) {
        return reply.code(413).send({ error: "too_large" });
      }
      const manifest = body.text;
      if (manifest.includes("#EXTM3U")) {
        return reply
          .header("cache-control", "private, max-age=60")
          .type("application/vnd.apple.mpegurl")
          .send(rewriteHlsManifest(manifest, query.data.url, query.data.source, "/video/hls-proxy"));
      }
      if (manifest.includes("<MPD")) {
        return reply
          .header("cache-control", "private, max-age=60")
          .type("application/dash+xml")
          .send(rewriteDashManifest(manifest, query.data.url, query.data.source, "/video/hls-proxy"));
      }
      return reply
        .header("cache-control", "private, max-age=60")
        .type(textLikeContent.test(contentType) ? contentType : "text/plain")
        .send(manifest);
    }
    reply.header("cache-control", "private, max-age=300");
    reply.header("accept-ranges", "bytes");
    if (upstream.headers.get("content-range")) reply.header("content-range", upstream.headers.get("content-range") ?? "");
    if (upstream.headers.get("content-type")) reply.header("content-type", upstream.headers.get("content-type") ?? "application/octet-stream");
    if (upstream.headers.get("content-length")) reply.header("content-length", upstream.headers.get("content-length") ?? "");
    if (!upstream.body) return reply.code(upstream.status).send();
    return reply.code(upstream.status).send(cappedBody(upstream.body, env.STREAM_MAX_BYTES));
  });
}
