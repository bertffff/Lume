import { describe, expect, it } from "vitest";
import {
  applyPause,
  applyPlay,
  applySeek,
  estimateClockOffset,
  initialPlayback,
  positionAt,
} from "./playback.js";

describe("playback clock", () => {
  it("advances only while playing and freezes on pause", () => {
    const start = initialPlayback("host", 1_000);
    expect(positionAt(start, 5_000)).toBe(0);

    const playing = applyPlay(start, "host", 1_000);
    expect(positionAt(playing, 4_000)).toBe(3_000);

    const paused = applyPause(playing, "host", 4_000);
    expect(paused.anchorPositionMs).toBe(3_000);
    expect(positionAt(paused, 9_000)).toBe(3_000);
    expect(applyPause(paused, "host", 9_000)).toBe(paused);
  });

  it("seeks without changing play state and bumps the version", () => {
    const playing = applyPlay(initialPlayback("host", 0), "host", 0);
    const sought = applySeek(playing, "host", 2_000, 8_500.8);
    expect(sought.status).toBe("playing");
    expect(sought.anchorPositionMs).toBe(8_500);
    expect(sought.version).toBe(playing.version + 1);
    expect(positionAt(sought, 2_400)).toBe(8_900);
  });

  it("estimates clock offset and leaves it unused by the anchor", () => {
    const offset = estimateClockOffset({ t0: 100, t1: 180, t2: 190, t3: 220 });
    expect(offset).toBe(25);
  });
});
