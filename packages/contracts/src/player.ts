import type { EmbedProvider } from "./embed.js";

/** Viewers seek only when local media is further than this from the server clock. */
export const SYNC_DRIFT_MS = 1_500;

export const adapterPhases = [
  "idle",
  "loading",
  "ready",
  "playing",
  "paused",
  "buffering",
  "ended",
  "error",
] as const;

export type AdapterPhase = (typeof adapterPhases)[number];

export interface PlayerObservation {
  phase: AdapterPhase;
  positionMs: number;
  durationMs: number | null;
  bufferedMs: number | null;
  aspectRatio: number | null;
}

/**
 * One mounted player. Times are milliseconds.
 * `limited` means the third-party frame may ignore play, pause, and seek.
 */
export interface PlayerAdapter {
  readonly provider: EmbedProvider;
  readonly limited: boolean;
  play(): Promise<void>;
  pause(): Promise<void>;
  seek(positionMs: number): Promise<void>;
  setPlaybackRate?(rate: number): void;
  getCurrentTime(): number;
  getDuration(): number | null;
  getBuffered(): number | null;
  onState(listener: (state: PlayerObservation) => void): () => void;
  destroy(): void;
}

export function shouldCorrectDrift(
  localMs: number,
  authorityMs: number,
  thresholdMs: number = SYNC_DRIFT_MS,
): boolean {
  if (!Number.isFinite(localMs) || !Number.isFinite(authorityMs)) {
    return false;
  }
  return Math.abs(localMs - authorityMs) > thresholdMs;
}

export interface FollowerSyncPlan {
  seekToMs: number | null;
  play: boolean;
  pause: boolean;
}

/** What a viewer should do to match the server clock. The host does not use this. */
export function planFollowerSync(input: {
  playback: "playing" | "paused";
  adapterPhase: AdapterPhase;
  localMs: number;
  authorityMs: number;
  thresholdMs?: number;
}): FollowerSyncPlan {
  const drifted = shouldCorrectDrift(input.localMs, input.authorityMs, input.thresholdMs);
  if (input.playback === "paused") {
    return {
      seekToMs: drifted ? input.authorityMs : null,
      play: false,
      pause: input.adapterPhase !== "paused" && input.adapterPhase !== "idle" && input.adapterPhase !== "loading",
    };
  }
  return {
    seekToMs: drifted ? input.authorityMs : null,
    play: input.adapterPhase !== "playing" && input.adapterPhase !== "buffering",
    pause: false,
  };
}
