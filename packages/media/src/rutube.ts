import type { MediaExtractor } from "@lume/contracts";
import { aspectFrom, expiresAtFromUrl, fetchJson, media, type MediaConfig } from "./types.js";

const rutubeId = /rutube\.ru\/(?:video|shorts|embed)\/([0-9a-f]{32})/i;

export function rutubeVideoId(input: string): string | null {
  return input.match(rutubeId)?.[1] ?? null;
}

interface PlayOptions {
  title?: string;
  duration?: number;
  video_balancer?: { m3u8?: string; default?: string };
  video_url?: string;
}

export function createRutubeExtractor(config: MediaConfig = {}): MediaExtractor {
  const fetchImpl = config.fetchImpl ?? fetch;
  const timeoutMs = config.timeoutMs ?? 15_000;
  const base = config.rutubeApiBase ?? "https://rutube.ru";

  return {
    id: "rutube",
    canHandle: (input) => rutubeVideoId(input) !== null,
    async resolve(input) {
      const id = rutubeVideoId(input);
      if (!id) throw new Error("rutube_invalid_url");
      const body = (await fetchJson(
        fetchImpl,
        `${base}/api/play/options/${id}/?no_404=true`,
        {
          headers: {
            accept: "application/json",
            referer: `${base}/`,
            "user-agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Lume",
          },
        },
        timeoutMs,
      )) as PlayOptions | null;
      if (!body) throw new Error("rutube_unreachable");
      const title = body.title ?? `Rutube ${id}`;
      const durationMs =
        typeof body.duration === "number" && body.duration > 0
          ? Math.round(body.duration * 1000)
          : null;
      const hls = body.video_balancer?.m3u8;
      if (hls) {
        return media("rutube", id, title, { kind: "hls", url: hls }, { durationMs, aspectRatio: aspectFrom(16, 9) });
      }
      const file = body.video_balancer?.default ?? body.video_url;
      if (file) {
        return media("rutube", id, title, { kind: "file", url: file }, { durationMs, aspectRatio: aspectFrom(16, 9) });
      }
      throw new Error("rutube_no_stream");
    },
  };
}

export function rutubeExpiry(url: string): number | null {
  return expiresAtFromUrl(url);
}
