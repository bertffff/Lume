import { dnsPinned, oEmbedEndpoint, urlBlocked, type ParsedEmbed } from "@lume/contracts";
import { lookup } from "node:dns/promises";

export interface ResolvedMetadata {
  title: string | null;
  thumbnailUrl: string | null;
  durationMs: number | null;
}

export interface MetadataOptions {
  /** Test/local base. It receives `?url=<encoded source>` and must return oEmbed JSON. */
  oEmbedBaseUrl?: string;
  timeoutMs?: number;
  /** Local test servers only. Production leaves this off so private hosts are refused. */
  allowPrivateHosts?: boolean;
}

const mediaFile = /\.(mp4|webm|ogg|m3u8|mpd|mkv|avi|mov)(?:$|[?#])/i;
const pageReadCap = 512 * 1024;
const redirectStatuses = new Set([301, 302, 303, 307, 308]);

/** Literal host check plus DNS pinning so a public name cannot resolve to a private address. */
async function pageHostAllowed(url: string, allowPrivate: boolean): Promise<boolean> {
  if (allowPrivate) return true;
  if (urlBlocked(url)) return false;
  const hostname = new URL(url).hostname;
  return dnsPinned(hostname, async (host) => {
    const rows = await lookup(host, { all: true, verbatim: true });
    return rows.map((row) => row.address);
  });
}

async function readCapped(response: Response, limit: number): Promise<string> {
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

function numeric(value: unknown): number | null {
  const parsed = typeof value === "number" ? value : typeof value === "string" && value.trim() ? Number(value) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function positiveMs(value: unknown): number | null {
  const parsed = numeric(value);
  return parsed === null ? null : Math.round(parsed);
}

/** oEmbed `duration` is seconds. `duration_ms` and `durationMs` are already milliseconds. */
export function durationFromJson(body: Record<string, unknown>): number | null {
  const milliseconds = positiveMs(body.duration_ms ?? body.durationMs);
  if (milliseconds !== null) {
    return milliseconds;
  }
  const seconds = numeric(body.duration);
  return seconds === null ? null : Math.round(seconds * 1000);
}

/** ISO-8601 durations such as PT1H2M3.5S, used by schema.org itemprop=duration. */
export function durationFromIso(value: string): number | null {
  const match = value.trim().match(/^P(?:(\d+)D)?T(?:(\d+)H)?(?:(\d+)M)?(?:([\d.]+)S)?$/i);
  if (!match) {
    return null;
  }
  const days = Number(match[1] ?? 0);
  const hours = Number(match[2] ?? 0);
  const minutes = Number(match[3] ?? 0);
  const seconds = Number(match[4] ?? 0);
  const total = (((days * 24 + hours) * 60 + minutes) * 60 + seconds) * 1000;
  return total > 0 ? Math.round(total) : null;
}

function metaContent(html: string, key: string): string | null {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const direct = html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${escaped}["'][^>]*content=["']([^"']*)["']`, "i"));
  if (direct?.[1]) return direct[1];
  const reversed = html.match(new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]*(?:property|name)=["']${escaped}["']`, "i"));
  return reversed?.[1] ?? null;
}

function cleanTitle(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim().slice(0, 140) : null;
}

function cleanImage(value: unknown): string | null {
  return typeof value === "string" && value.startsWith("http") ? value : null;
}

function merge(base: ResolvedMetadata | null, next: ResolvedMetadata | null): ResolvedMetadata | null {
  if (!base && !next) return null;
  const merged: ResolvedMetadata = {
    title: base?.title ?? next?.title ?? null,
    thumbnailUrl: base?.thumbnailUrl ?? next?.thumbnailUrl ?? null,
    durationMs: base?.durationMs ?? next?.durationMs ?? null,
  };
  return merged.title || merged.thumbnailUrl || merged.durationMs ? merged : null;
}

function oEmbedUrl(item: ParsedEmbed, baseUrl?: string): string | null {
  if (baseUrl) {
    const separator = baseUrl.includes("?") ? "&" : "?";
    return `${baseUrl}${separator}url=${encodeURIComponent(item.url)}`;
  }
  return oEmbedEndpoint(item);
}

async function fetchJson(url: string, timeoutMs: number): Promise<Record<string, unknown> | null> {
  const response = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) }).catch(() => null);
  if (!response?.ok) return null;
  const body = (await response.json().catch(() => null)) as unknown;
  return body && typeof body === "object" ? (body as Record<string, unknown>) : null;
}

async function fetchOpenGraph(url: string, timeoutMs: number, allowPrivate: boolean): Promise<ResolvedMetadata | null> {
  let current = url;
  let html = "";
  for (let hop = 0; hop <= 3; hop += 1) {
    if (!(await pageHostAllowed(current, allowPrivate).catch(() => false))) return null;
    const response = await fetch(current, {
      headers: { accept: "text/html,application/xhtml+xml" },
      redirect: "manual",
      signal: AbortSignal.timeout(timeoutMs),
    }).catch(() => null);
    if (!response) return null;
    if (redirectStatuses.has(response.status)) {
      const location = response.headers.get("location");
      if (!location) return null;
      current = new URL(location, current).toString();
      continue;
    }
    if (!response.ok) return null;
    html = await readCapped(response, pageReadCap).catch(() => "");
    break;
  }
  if (!html) return null;
  const durationSeconds = numeric(metaContent(html, "og:video:duration") ?? metaContent(html, "video:duration"));
  const iso = html.match(/itemprop=["']duration["'][^>]*content=["']([^"']+)["']/i)?.[1] ?? null;
  const durationMs = iso ? durationFromIso(iso) : durationSeconds === null ? null : Math.round(durationSeconds * 1000);
  const result: ResolvedMetadata = {
    title: cleanTitle(metaContent(html, "og:title") ?? metaContent(html, "twitter:title")),
    thumbnailUrl: cleanImage(metaContent(html, "og:image") ?? metaContent(html, "twitter:image")),
    durationMs,
  };
  return result.title || result.thumbnailUrl || result.durationMs ? result : null;
}

/**
 * Resolves a real title, poster and duration. Provider oEmbed JSON first; pages
 * without a provider endpoint fall back to OpenGraph metadata.
 */
export async function resolveMetadata(item: ParsedEmbed, options: MetadataOptions = {}): Promise<ResolvedMetadata | null> {
  const timeoutMs = Math.max(200, options.timeoutMs ?? 2500);
  let resolved: ResolvedMetadata | null = null;
  const endpoint = oEmbedUrl(item, options.oEmbedBaseUrl);
  if (endpoint) {
    const body = await fetchJson(endpoint, timeoutMs);
    if (body) {
      resolved = merge(resolved, {
        title: cleanTitle(body.title),
        thumbnailUrl: cleanImage(body.thumbnail_url ?? body.thumbnailUrl),
        durationMs: durationFromJson(body),
      });
    }
  }
  const needsPage = !resolved?.title || resolved.durationMs === null || !resolved.thumbnailUrl;
  const canReadPage =
    needsPage &&
    !mediaFile.test(item.url) &&
    (options.allowPrivateHosts === true || !urlBlocked(item.url));
  if (canReadPage) {
    resolved = merge(resolved, await fetchOpenGraph(item.url, timeoutMs, options.allowPrivateHosts === true));
  }
  return resolved;
}
