export const playbackStatuses = ["playing", "paused"] as const;
export type PlaybackStatus = (typeof playbackStatuses)[number];

/**
 * Server-authoritative playback clock.
 *
 * While playing, position = anchorPositionMs + (serverNow - anchorServerTimeMs).
 * While paused, position = anchorPositionMs.
 * The anchor moves on play, pause, and seek. Version rejects stale writes.
 */
export interface PlaybackAnchor {
  status: PlaybackStatus;
  anchorPositionMs: number;
  anchorServerTimeMs: number;
  version: number;
  updatedBy: string;
}

export function positionAt(anchor: PlaybackAnchor, serverNowMs: number): number {
  if (anchor.status === "paused") {
    return anchor.anchorPositionMs;
  }
  const elapsed = serverNowMs - anchor.anchorServerTimeMs;
  return Math.max(0, anchor.anchorPositionMs + elapsed);
}

export function initialPlayback(actorId: string, serverNowMs: number): PlaybackAnchor {
  return {
    status: "paused",
    anchorPositionMs: 0,
    anchorServerTimeMs: serverNowMs,
    version: 0,
    updatedBy: actorId,
  };
}

export function applyPlay(
  anchor: PlaybackAnchor,
  actorId: string,
  serverNowMs: number,
): PlaybackAnchor {
  if (anchor.status === "playing") {
    return anchor;
  }
  return {
    status: "playing",
    anchorPositionMs: positionAt(anchor, serverNowMs),
    anchorServerTimeMs: serverNowMs,
    version: anchor.version + 1,
    updatedBy: actorId,
  };
}

export function applyPause(
  anchor: PlaybackAnchor,
  actorId: string,
  serverNowMs: number,
): PlaybackAnchor {
  if (anchor.status === "paused") {
    return anchor;
  }
  return {
    status: "paused",
    anchorPositionMs: positionAt(anchor, serverNowMs),
    anchorServerTimeMs: serverNowMs,
    version: anchor.version + 1,
    updatedBy: actorId,
  };
}

export function applySeek(
  anchor: PlaybackAnchor,
  actorId: string,
  serverNowMs: number,
  positionMs: number,
): PlaybackAnchor {
  return {
    status: anchor.status,
    anchorPositionMs: Math.max(0, Math.floor(positionMs)),
    anchorServerTimeMs: serverNowMs,
    version: anchor.version + 1,
    updatedBy: actorId,
  };
}

/**
 * Advisory client/server offset from one NTP-style sample.
 * Playback authority stays on the server anchor; this does not move it.
 * t0 client send, t1 server receive, t2 server send, t3 client receive.
 */
export function estimateClockOffset(sample: {
  t0: number;
  t1: number;
  t2: number;
  t3: number;
}): number {
  return (sample.t1 - sample.t0 + (sample.t2 - sample.t3)) / 2;
}
