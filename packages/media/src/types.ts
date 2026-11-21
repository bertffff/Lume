import type { ResolvedMedia } from "@lume/contracts";

export type ExecFileImpl = (
  file: string,
  args: readonly string[],
  options: { timeout: number; maxBuffer: number },
) => Promise<string>;

export interface MediaConfig {
  fetchImpl?: typeof fetch;
  execFileImpl?: ExecFileImpl;
  cobaltApiUrl?: string;
  ytdlpPath?: string;
  vkCookies?: string;
  twitchClientId?: string;
  twitchClientSecret?: string;
  searxngUrl?: string;
  /** Test seams. Production uses the public endpoints. */
  youtubeApiBase?: string;
  rutubeApiBase?: string;
  vkBaseUrl?: string;
  twitchGqlUrl?: string;
  usherBaseUrl?: string;
  timeoutMs?: number;
}

export interface ExtractOptions {
  /** Override the HTTP client, used by tests. */
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

export type Playback = NonNullable<ResolvedMedia["playback"]>;

export function media(
  provider: string,
  externalId: string,
  title: string,
  playback: Playback,
  extras: { durationMs?: number | null; aspectRatio?: number | null } = {},
): ResolvedMedia {
  return {
    provider,
    externalId,
    title: title.trim().slice(0, 300) || provider,
    durationMs: extras.durationMs ?? null,
    aspectRatio: extras.aspectRatio ?? null,
    playback,
  };
}

/** Providers put the expiry in the query string (`expire`, `expires`, `exp`). */
export function expiresAtFromUrl(url: string, nowMs = Date.now()): number | null {
  try {
    const parsed = new URL(url);
    for (const key of ["expire", "expires", "exp"]) {
      const raw = parsed.searchParams.get(key);
      if (!raw) continue;
      const value = Number(raw);
      if (!Number.isFinite(value) || value <= 0) continue;
      // YouTube uses seconds since epoch; Twitch uses the same.
      return value > 1_000_000_000_000 ? value : value * 1000;
    }
  } catch {
    return null;
  }
  void nowMs;
  return null;
}

export function aspectFrom(width?: number | null, height?: number | null): number | null {
  if (!width || !height || width <= 0 || height <= 0) return null;
  return Math.round((width / height) * 1000) / 1000;
}

export async function fetchJson(
  fetchImpl: typeof fetch,
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Record<string, unknown> | null> {
  const response = await fetchImpl(url, {
    ...init,
    signal: AbortSignal.timeout(timeoutMs),
  }).catch(() => null);
  if (!response?.ok) return null;
  const body = (await response.json().catch(() => null)) as unknown;
  return body && typeof body === "object" ? (body as Record<string, unknown>) : null;
}

export async function fetchText(
  fetchImpl: typeof fetch,
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<string | null> {
  const response = await fetchImpl(url, {
    ...init,
    signal: AbortSignal.timeout(timeoutMs),
  }).catch(() => null);
  if (!response?.ok) return null;
  return response.text().catch(() => null);
}

export function nested<T = Record<string, unknown>>(value: unknown): T | null {
  return value && typeof value === "object" ? (value as T) : null;
}
