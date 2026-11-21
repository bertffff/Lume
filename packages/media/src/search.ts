import { detectSource } from "@lume/contracts";
import { fetchJson, type MediaConfig } from "./types.js";

export interface VideoSearchResult {
  title: string;
  url: string;
  source: string | null;
  thumbnailUrl: string | null;
  durationMs: number | null;
}

export interface VideoSearchResponse {
  results: VideoSearchResult[];
  unavailable: boolean;
  reason?: string;
}

interface SearxngBody {
  results?: Array<{
    title?: string;
    url?: string;
    img_src?: string;
    thumbnail?: string;
    length?: string;
  }>;
}

function durationMs(value: string | undefined): number | null {
  if (!value) return null;
  const parts = value.split(":").map((part) => Number(part));
  if (parts.some((part) => !Number.isFinite(part))) return null;
  const seconds = parts.reduce((total, part) => total * 60 + part, 0);
  return seconds > 0 ? Math.round(seconds * 1000) : null;
}

/** SearXNG video search, used by the queue/search panel. */
export async function searchVideos(
  config: MediaConfig,
  query: string,
  limit = 12,
): Promise<VideoSearchResponse> {
  if (!config.searxngUrl) {
    return { results: [], unavailable: true, reason: "searxng_unconfigured" };
  }
  const fetchImpl = config.fetchImpl ?? fetch;
  const timeoutMs = config.timeoutMs ?? 10_000;
  let endpoint: URL;
  try {
    endpoint = new URL("/search", config.searxngUrl);
  } catch {
    return { results: [], unavailable: true, reason: "searxng_invalid_url" };
  }
  endpoint.searchParams.set("q", query);
  endpoint.searchParams.set("format", "json");
  endpoint.searchParams.set("categories", "videos");
  endpoint.searchParams.set("language", "ru-RU");
  endpoint.searchParams.set("safesearch", "0");
  const body = (await fetchJson(fetchImpl, endpoint.toString(), { headers: { accept: "application/json" } }, timeoutMs)) as SearxngBody | null;
  if (!body) {
    return { results: [], unavailable: true, reason: "searxng_unavailable" };
  }
  return {
    results: (body.results ?? [])
      .filter((item): item is { title: string; url: string } & typeof item => Boolean(item.url))
      .slice(0, limit)
      .map((item) => ({
        title: item.title ?? "",
        url: item.url ?? "",
        source: detectSource(item.url)?.id ?? null,
        thumbnailUrl: item.img_src ?? item.thumbnail ?? null,
        durationMs: durationMs(item.length),
      })),
    unavailable: false,
  };
}
