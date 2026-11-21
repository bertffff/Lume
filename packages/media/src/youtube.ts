import type { MediaExtractor } from "@lume/contracts";
import { aspectFrom, expiresAtFromUrl, fetchJson, media, type MediaConfig } from "./types.js";

/** Public InnerTube web key used by the documented player endpoint. */
const INNERTUBE_KEY = "AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8";

const clientContext = {
  client: {
    clientName: "ANDROID",
    clientVersion: "19.29.37",
    androidSdkVersion: 30,
    hl: "ru",
    gl: "RU",
  },
};

interface Format {
  itag?: number;
  url?: string;
  mimeType?: string;
  width?: number;
  height?: number;
  contentLength?: string;
}

interface PlayerBody {
  playabilityStatus?: { status?: string; reason?: string };
  videoDetails?: {
    videoId?: string;
    title?: string;
    lengthSeconds?: string;
    thumbnail?: { thumbnails?: Array<{ width?: number; height?: number }> };
  };
  streamingData?: {
    expiresInSeconds?: string;
    hlsManifestUrl?: string;
    formats?: Format[];
    adaptiveFormats?: Format[];
  };
}

export function youtubeVideoId(input: string): string | null {
  try {
    const url = new URL(input);
    if (url.hostname.endsWith("youtu.be")) return url.pathname.slice(1) || null;
    if (!/(^|\.)youtube\.com$/.test(url.hostname)) return null;
    if (url.searchParams.get("v")) return url.searchParams.get("v");
    const match = url.pathname.match(/\/(?:embed|shorts|live)\/([\w-]{6,})/);
    return match?.[1] ?? null;
  } catch {
    return null;
  }
}

export function createYouTubeExtractor(config: MediaConfig = {}): MediaExtractor {
  const fetchImpl = config.fetchImpl ?? fetch;
  const timeoutMs = config.timeoutMs ?? 15_000;
  const base = config.youtubeApiBase ?? "https://www.youtube.com";

  return {
    id: "youtube-innertube",
    canHandle: (input) => youtubeVideoId(input) !== null,
    async resolve(input) {
      const videoId = youtubeVideoId(input);
      if (!videoId) throw new Error("youtube_invalid_url");
      const body = (await fetchJson(
        fetchImpl,
        `${base}/youtubei/v1/player?key=${INNERTUBE_KEY}`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-youtube-client-name": "3",
            "x-youtube-client-version": "19.29.37",
            origin: base,
            referer: `${base}/`,
          },
          body: JSON.stringify({
            context: clientContext,
            videoId,
            contentCheckOk: true,
            racyCheckOk: true,
          }),
        },
        timeoutMs,
      )) as PlayerBody | null;
      if (!body) throw new Error("youtube_unreachable");
      const status = body.playabilityStatus?.status ?? "UNPLAYABLE";
      if (status !== "OK" && status !== "LIVE_STREAM_OFFLINE") {
        throw new Error(`youtube_${status.toLowerCase()}`);
      }
      const title = body.videoDetails?.title ?? videoId;
      const durationSeconds = Number(body.videoDetails?.lengthSeconds ?? "0");
      const thumbs = body.videoDetails?.thumbnail?.thumbnails ?? [];
      const thumb = thumbs[thumbs.length - 1];
      const extras = {
        durationMs: Number.isFinite(durationSeconds) && durationSeconds > 0 ? Math.round(durationSeconds * 1000) : null,
        aspectRatio: aspectFrom(thumb?.width, thumb?.height),
      };
      const streaming = body.streamingData;
      if (streaming?.hlsManifestUrl) {
        return media("youtube", videoId, title, { kind: "hls", url: streaming.hlsManifestUrl }, extras);
      }
      const progressive = (streaming?.formats ?? []).find(
        (format) => format.url && /^video\/mp4/i.test(format.mimeType ?? ""),
      );
      if (progressive?.url) {
        return media("youtube", videoId, title, { kind: "file", url: progressive.url }, extras);
      }
      // Adaptive video-only: the client plays the matching audio track in sync.
      const adaptive = (streaming?.adaptiveFormats ?? []).find(
        (format) => format.url && /^video\/(mp4|webm)/i.test(format.mimeType ?? ""),
      );
      if (adaptive?.url) {
        return media("youtube", videoId, title, { kind: "file", url: adaptive.url }, extras);
      }
      throw new Error("youtube_no_stream");
    },
  };
}

export function youtubeExpiry(url: string): number | null {
  return expiresAtFromUrl(url);
}
