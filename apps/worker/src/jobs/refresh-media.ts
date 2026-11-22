import { expiresAtFromUrl } from "@lume/media";
import type { PrismaClient } from "@lume/db";

export const mediaRefreshQueue = "media.refresh";
/** Every minute: the proactive refresher from F041. */
export const mediaRefreshRepeat = { pattern: "* * * * *" };

const leadMs = 5 * 60_000;

export interface RefreshStats {
  checked: number;
  refreshed: number;
  failed: number;
}

export function expiryFor(url: string, nowMs: number): Date | null {
  const parsed = expiresAtFromUrl(url, nowMs);
  return parsed === null ? null : new Date(parsed);
}

/**
 * Refreshes the playing stream URL of active rooms shortly before it expires.
 * A failed extraction keeps the old row untouched and is counted, never
 * reported as a successful refresh.
 */
export async function refreshDueStreamUrls(
  prisma: PrismaClient,
  resolve: (url: string) => Promise<{ playback: { url: string } | null } | null>,
  now = new Date(),
): Promise<RefreshStats> {
  const due = await prisma.queueItem.findMany({
    where: {
      expiresAt: { not: null, lte: new Date(now.getTime() + leadMs) },
      nowPlayingFor: { is: { status: { not: "ended" } } },
    },
    select: { id: true, url: true },
    take: 50,
  });

  const stats: RefreshStats = { checked: due.length, refreshed: 0, failed: 0 };
  for (const item of due) {
    const media = await resolve(item.url).catch(() => null);
    const nextUrl = media?.playback?.url;
    if (!nextUrl) {
      stats.failed += 1;
      continue;
    }
    await prisma.queueItem.update({
      where: { id: item.id },
      data: { url: nextUrl, expiresAt: expiryFor(nextUrl, now.getTime()) },
    });
    stats.refreshed += 1;
  }
  return stats;
}
