import { detectSource, planPlayback, refreshKeepsPlayback, rewriteHlsManifest, urlBlocked } from "@lume/contracts";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { ApiEnv } from "../env.js";

export function registerVideoRoutes(app: FastifyInstance, env: ApiEnv): void {
  app.get("/video/range", async (request, reply) => {
    const query = z.object({ url: z.string().url() }).safeParse(request.query);
    if (!query.success || urlBlocked(query.data.url)) return reply.code(400).send({ error: "blocked" });
    const range = request.headers.range;
    if (!range) return reply.code(416).send({ error: "range_required" });
    const upstream = await fetch(query.data.url, { headers: { range }, signal: AbortSignal.timeout(10_000) }).catch(() => null);
    if (!upstream) return reply.code(502).send({ error: "upstream" });
    reply.header("accept-ranges", "bytes");
    if (upstream.headers.get("content-range")) reply.header("content-range", upstream.headers.get("content-range") ?? "");
    return reply.code(upstream.status).send(Buffer.from(await upstream.arrayBuffer()));
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
    return reply.send({ source: source?.id ?? null, plan: planPlayback({ url: body.data.url, premium: false }) });
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
    if (env.FF_EXTRACTORS !== "true") {
      return reply.code(404).send({ error: "extractors_disabled" });
    }
    const query = z.object({ url: z.string().url(), source: z.string().default("direct") }).safeParse(request.query);
    if (!query.success || urlBlocked(query.data.url)) {
      return reply.code(400).send({ error: "blocked" });
    }
    const upstream = await fetch(query.data.url, { signal: AbortSignal.timeout(15_000) }).catch(() => null);
    if (!upstream) return reply.code(502).send({ error: "upstream" });
    if (upstream.status === 403 || upstream.status === 410) {
      return reply.code(410).header("x-lume-retry", "true").send({ error: "expired" });
    }
    const body = await upstream.text();
    if (body.includes("#EXTM3U") || body.includes("<MPD")) {
      return reply.type("application/vnd.apple.mpegurl").send(rewriteHlsManifest(body, query.data.url, query.data.source, "/video/hls-proxy"));
    }
    return reply.send(body);
  });
}
