export type DriftStatus = "synced" | "soft-correcting" | "hard-seeking" | "waiting";

export interface DriftSeek {
  atMs: number;
  targetMs: number;
}

export interface DriftPlan {
  status: DriftStatus;
  seekToMs: number | null;
  playbackRate: number | null;
}

function softThreshold(embed: boolean): number {
  return embed ? 1_000 : 150;
}

function hardThreshold(embed: boolean, loadedAgoMs: number): number {
  if (loadedAgoMs < 10_000) {
    return 500;
  }
  return embed ? 3_000 : 1_500;
}

function nudgeRate(absDrift: number, behind: boolean): number {
  let magnitude = 1.05;
  if (absDrift < 500) {
    magnitude = 1.02;
  } else if (absDrift < 1_500) {
    magnitude = 1.04;
  }
  return behind ? magnitude : 2 - magnitude;
}

export function planDrift(input: {
  localMs: number;
  expectedMs: number;
  embed: boolean;
  loadedAgoMs: number;
  bufferedToMs: number | null;
  recentSeeks: readonly DriftSeek[];
  nowMs: number;
  buffering: boolean;
  bufferEndedAtMs: number | null;
}): DriftPlan {
  if (input.buffering || (input.bufferEndedAtMs !== null && input.nowMs - input.bufferEndedAtMs < 5_000)) {
    return { status: "waiting", seekToMs: null, playbackRate: null };
  }
  const drift = input.localMs - input.expectedMs;
  const absDrift = Math.abs(drift);
  const hard = hardThreshold(input.embed, input.loadedAgoMs);
  if (absDrift >= hard) {
    const near = input.recentSeeks.filter(
      (seek) => input.nowMs - seek.atMs < 8_000 && Math.abs(seek.targetMs - input.expectedMs) <= 3_000,
    );
    if (near.length >= 2) {
      return { status: "waiting", seekToMs: null, playbackRate: null };
    }
    if (input.bufferedToMs !== null && input.expectedMs > input.bufferedToMs) {
      return { status: "waiting", seekToMs: null, playbackRate: null };
    }
    return { status: "hard-seeking", seekToMs: input.expectedMs, playbackRate: null };
  }
  if (absDrift >= softThreshold(input.embed)) {
    return { status: "soft-correcting", seekToMs: null, playbackRate: nudgeRate(absDrift, drift < 0) };
  }
  return { status: "synced", seekToMs: null, playbackRate: null };
}
