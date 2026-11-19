import { detectSource, hostAllowed, needsRange, parseAllowlist, planPlayback, refreshKeepsPlayback, rewriteDashManifest, rewriteHlsManifest, urlBlocked } from "@lume/contracts";
import { verifyAccessToken } from "@lume/contracts/node";
import type { PrismaClient } from "@lume/db";
import type { FastifyInstance } from "fastify";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import { z } from "zod";
import type { ApiEnv } from "../env.js";

type StreamTarget = { response: Response } | { error: "blocked" | "host_not_allowed" | "upstream" };

const redirectCodes = new Set([301, 302, 303, 307, 308]);

async function openStream(url: string, range: string, env: ApiEnv, allowlist: readonly string[], hop = 0): Promise<StreamTarget> {
  if (hop > 3) return { error: "upstream" };
  const parsed = new URL(url);
  if (urlBlocked(url) && !env.STREAM_ALLOW_PRIVATE_HOSTS) return { error: "blocked" };
  if (!hostAllowed(parsed.hostname, allowlist)) return { error: "host_not_allowed" };
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

async function boundedText(response: Response, limit = 2 * 1024 * 1024): Promise<string> {
  if (!response.body) return "";
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (total < limit) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      const slice = value.byteLength > limit - total ? value.slice(0, limit - total) : value;
      chunks.push(slice);
      total += slice.byteLength;
    }
  } finally {
    await reader.cancel().catch(() => undefined);
  }
  return Buffer.concat(chunks.map((chunk) => Buffer.from(chunk))).toString("utf8");
}

export function registerVideoRoutes(app: FastifyInstance, env: ApiEnv, prisma: PrismaClient | null = null): void {
  const allowlist = parseAllowlist(env.STREAM_ALLOWLIST);

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
    const body = z.object({ url: z.string().min(1), positionMs: z.number().optional(), playing: z.boolean().optional() }).safeParse(request.body);
    if (!body.success) return reply.code(400).send({ error: "invalid_body" });
    return reply.send({ url: body.data.url, ...refreshKeepsPlayback(body.data.positionMs ?? 0, body.data.playing === true) });
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
      return reply.send({ results: [], unavailable: true });
    }
    try {
      const url = new URL("/search", env.SEARXNG_URL);
      url.searchParams.set("q", query.data.q);
      url.searchParams.set("format", "json");
      url.searchParams.set("categories", "videos");
      const response = await fetch(url, { signal: AbortSignal.timeout(10_000) });
      if (!response.ok) return reply.send({ results: [], unavailable: true });
      const payload = (await response.json()) as { results?: Array<{ title?: string; url?: string }> };
      return reply.send({
        results: (payload.results ?? []).slice(0, 12).map((item) => ({
          title: item.title ?? "",
          url: item.url ?? "",
          source: item.url ? detectSource(item.url)?.id ?? null : null,
        })),
        unavailable: false,
      });
    } catch {
      return reply.send({ results: [], unavailable: true });
    }
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
      const body = await boundedText(upstream);
      if (body.includes("#EXTM3U")) {
        return reply
          .header("cache-control", "private, max-age=60")
          .type("application/vnd.apple.mpegurl")
          .send(rewriteHlsManifest(body, query.data.url, query.data.source, "/video/hls-proxy"));
      }
      if (body.includes("<MPD")) {
        return reply
          .header("cache-control", "private, max-age=60")
          .type("application/dash+xml")
          .send(rewriteDashManifest(body, query.data.url, query.data.source, "/video/hls-proxy"));
      }
      return reply
        .header("cache-control", "private, max-age=60")
        .type(textLikeContent.test(contentType) ? contentType : "text/plain")
        .send(body);
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
