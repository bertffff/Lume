export function slowRemainingMs(
  lastSentAtMs: number | null,
  nowMs: number,
  intervalSeconds: number,
  host: boolean,
): number {
  if (host || intervalSeconds <= 0 || lastSentAtMs === null) {
    return 0;
  }
  return Math.max(0, intervalSeconds * 1000 - (nowMs - lastSentAtMs));
}

export function moveQueueItem(ids: readonly string[], id: string, direction: -1 | 1): string[] {
  const index = ids.indexOf(id);
  const target = index + direction;
  if (index < 0 || target < 0 || target >= ids.length) {
    return [...ids];
  }
  const next = [...ids];
  const [item] = next.splice(index, 1);
  next.splice(target, 0, item ?? id);
  return next;
}

export function shouldRefreshLink(expiresAtMs: number, nowMs: number, leadMs = 5 * 60 * 1000): boolean {
  return expiresAtMs - nowMs <= leadMs;
}

export interface ExtractHit {
  url: string;
  title: string;
  expiresAtMs: number;
}

export function runExtractorChain(
  steps: readonly (() => ExtractHit | null)[],
): ExtractHit | { error: "unconfigured" } {
  for (const step of steps) {
    const hit = step();
    if (hit) {
      return hit;
    }
  }
  return { error: "unconfigured" };
}

export function vkFromFixture(fixture: { hls?: string; title?: string; expiresAtMs?: number } | null): ExtractHit | null {
  if (!fixture?.hls) return null;
  return { url: fixture.hls, title: fixture.title ?? "VK", expiresAtMs: fixture.expiresAtMs ?? 0 };
}

export function rutubeFromFixture(fixture: { m3u8?: string; title?: string; expiresAtMs?: number } | null): ExtractHit | null {
  if (!fixture?.m3u8) return null;
  return { url: fixture.m3u8, title: fixture.title ?? "Rutube", expiresAtMs: fixture.expiresAtMs ?? 0 };
}

export function twitchFromFixture(fixture: { url?: string; title?: string; expiresAtMs?: number } | null): ExtractHit | null {
  if (!fixture?.url) return null;
  return { url: fixture.url, title: fixture.title ?? "Twitch", expiresAtMs: fixture.expiresAtMs ?? 0 };
}

export function innertubeFromFixture(fixture: { playability?: string; url?: string; title?: string; expiresAtMs?: number } | null): ExtractHit | null {
  if (!fixture || fixture.playability !== "OK" || !fixture.url) {
    return null;
  }
  return { url: fixture.url, title: fixture.title ?? "YouTube", expiresAtMs: fixture.expiresAtMs ?? 0 };
}

export function imageKind(bytes: Uint8Array): "jpeg" | "png" | "gif" | "webp" | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "jpeg";
  if (bytes.length >= 4 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "png";
  if (bytes.length >= 3 && bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) return "gif";
  if (bytes.length >= 12 && bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[8] === 0x57 && bytes[9] === 0x45) return "webp";
  return null;
}

export function dayScore(watchSeconds: number, messages: number, reactions: number): number {
  return watchSeconds + 30 * messages + 5 * reactions;
}

export interface RefreshRow {
  userId: string;
  expiresAt: number;
}

export function rotateRefresh(
  store: Map<string, RefreshRow>,
  current: string,
  next: string,
  nowMs: number,
  ttlMs: number,
): string | null {
  const row = store.get(current);
  if (!row || row.expiresAt <= nowMs) {
    return null;
  }
  store.delete(current);
  store.set(next, { userId: row.userId, expiresAt: nowMs + ttlMs });
  return row.userId;
}

export interface MagicRow {
  email: string;
  expiresAt: number;
  used: boolean;
}

export function yearHeatmap(now: Date, scores: Readonly<Record<string, number>>): Array<{ day: string; score: number }> {
  const days: Array<{ day: string; score: number }> = [];
  for (let index = 364; index >= 0; index -= 1) {
    const date = new Date(now);
    date.setUTCDate(date.getUTCDate() - index);
    const day = date.toISOString().slice(0, 10);
    days.push({ day, score: scores[day] ?? 0 });
  }
  return days;
}

export function pageSlice<T>(items: readonly T[], page: number, size: number): { page: number; pages: number; items: T[] } {
  const safeSize = Math.max(1, size);
  const pages = Math.max(1, Math.ceil(items.length / safeSize));
  const safePage = Math.min(Math.max(0, page), pages - 1);
  const start = safePage * safeSize;
  return { page: safePage, pages, items: items.slice(start, start + safeSize) };
}

export function gestureDelta(zone: "left" | "center" | "right", taps: number): number | "toggle" | null {
  if (zone === "center" && taps === 1) return "toggle";
  if (taps >= 2 && zone === "left") return -10;
  if (taps >= 2 && zone === "right") return 10;
  return null;
}

export function autoQuality(downlinkMbps: number | null): "low" | "auto" | "high" {
  if (downlinkMbps === null) return "auto";
  if (downlinkMbps <= 0.5) return "low";
  if (downlinkMbps >= 5) return "high";
  return "auto";
}

export function playerShortcut(key: string, host: boolean): "play" | "back" | "forward" | "help" | null {
  if (key === "?") return "help";
  if (!host) return null;
  if (key === " " || key === "k") return "play";
  if (key === "j" || key === "ArrowLeft") return "back";
  if (key === "l" || key === "ArrowRight") return "forward";
  return null;
}

export const onboardingSteps = ["зал", "чат", "голос"] as const;

export const notificationChannels = ["web", "telegram", "email", "push"] as const;
export const notificationKinds = [
  "FRIEND_REQUEST",
  "FRIEND_ACCEPTED",
  "ROOM_INVITE",
  "ACHIEVEMENT_UNLOCKED",
  "SYSTEM",
  "MOD_ACTION",
] as const;

export const playbackRates = [0.5, 0.75, 1, 1.25, 1.5, 2] as const;

export function heartbeatLag(nowMs: number, sentAtMs: number): number {
  return Math.max(0, nowMs - sentAtMs);
}

export function shouldHoldForReady(wait: boolean, buffering: number): boolean {
  return wait && buffering > 0;
}

export function hlsProxyUrl(apiBase: string, source: string): string {
  return `${apiBase}/video/hls-proxy?url=${encodeURIComponent(source)}`;
}

export function typingLine(names: readonly string[]): string {
  if (names.length === 0) return "";
  if (names.length === 1) return `${names[0]} печатает…`;
  return `${names[0]} и ещё ${names.length - 1} печатают…`;
}

export function duplicateQueue(urls: readonly string[], next: string): boolean {
  return urls.includes(next);
}

export function consumeMagic(store: Map<string, MagicRow>, token: string, nowMs: number): string | null {
  const row = store.get(token);
  if (!row || row.used || row.expiresAt <= nowMs) {
    return null;
  }
  row.used = true;
  return row.email;
}
