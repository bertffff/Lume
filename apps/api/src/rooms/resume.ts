import { positionAt, type PlaybackAnchor } from "@lume/contracts";
import type { ResumeCard, ResumePlayback, ResumeSnapshotInput } from "../../../../packages/contracts/src/resume.js";
import type { RedisLike } from "../redis.js";

/**
 * The realtime service owns this key (`apps/realtime/src/rooms/keys.ts`). The API
 * only reads it at teardown and seeds it for a freshly restored room; it never
 * accepts a client position and never writes to a source room being resumed.
 */
export function resumePlaybackKey(roomId: string): string {
  return `lume:room:${roomId}:playback`;
}

/** Realtime replaces the anchor with a TTL-free SET on its first playback command. */
const SEEDED_ANCHOR_TTL_MS = 30 * 24 * 60 * 60 * 1000;

function nonNegative(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function isAnchor(value: unknown): value is PlaybackAnchor {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return (
    (record.status === "playing" || record.status === "paused") &&
    nonNegative(record.anchorPositionMs) &&
    nonNegative(record.anchorServerTimeMs) &&
    nonNegative(record.version) &&
    typeof record.updatedBy === "string" && record.updatedBy.length > 0
  );
}

/** Returns a known position only from a valid server anchor; otherwise "unknown" (null). */
export async function readPlaybackPositionMs(
  redis: Pick<RedisLike, "get"> | null,
  roomId: string,
  nowMs: number,
): Promise<number | null> {
  if (!redis) return null;
  try {
    const raw = await redis.get(resumePlaybackKey(roomId));
    if (!raw) return null;
    let stored: unknown;
    try {
      stored = JSON.parse(raw);
    } catch {
      return null;
    }
    if (!isAnchor(stored)) return null;
    const position = positionAt(stored, nowMs);
    return nonNegative(position) ? Math.floor(position) : null;
  } catch {
    return null;
  }
}

function knownDurationMs(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? Math.floor(value) : null;
}

function knownPosterUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:" ? parsed.href : null;
  } catch {
    return null;
  }
}

/** Only trusted persisted media metadata; never invent a poster or a duration. */
export function resumeMediaFields(item: {
  thumbnail?: string | null;
  thumbnailUrl?: string | null;
  durationMs?: number | null;
} | null | undefined): { posterUrl: string | null; durationMs: number | null } {
  return {
    posterUrl: knownPosterUrl(item?.thumbnail ?? item?.thumbnailUrl),
    durationMs: knownDurationMs(item?.durationMs),
  };
}

/** Tolerates snapshots written before position/media fields existed. */
export function resumeCardFor(snapshot: ResumeSnapshotInput | null | undefined): ResumeCard | null {
  if (!snapshot) return null;
  return {
    title: typeof snapshot.title === "string" ? snapshot.title : "",
    positionMs: nonNegative(snapshot.positionMs) ? Math.floor(snapshot.positionMs) : null,
    ...resumeMediaFields({ thumbnailUrl: snapshot.posterUrl, durationMs: snapshot.durationMs }),
    queueCount: Array.isArray(snapshot.queue) ? snapshot.queue.length : 0,
    historyCount: nonNegative(snapshot.historyCount) ? Math.floor(snapshot.historyCount) : 0,
  };
}

/** Seeds only the newly created room with a paused anchor at the known position. */
export async function writePausedPlayback(
  redis: RedisLike | null,
  roomId: string,
  actorId: string,
  positionMs: number | null,
  nowMs: number,
): Promise<ResumePlayback | null> {
  if (!redis || positionMs === null) return null;
  const anchor: PlaybackAnchor = {
    status: "paused",
    anchorPositionMs: positionMs,
    anchorServerTimeMs: nowMs,
    version: 0,
    updatedBy: actorId,
  };
  try {
    await redis.setWithTtl(resumePlaybackKey(roomId), JSON.stringify(anchor), SEEDED_ANCHOR_TTL_MS);
  } catch {
    // A Redis outage must not fail a resume: the HTTP response still states the
    // paused position, and realtime will start from its normal default.
  }
  return { status: "paused", positionMs };
}
