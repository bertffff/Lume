import { describe, expect, it } from "vitest";
import { extractorsEnabled } from "./extractors.js";
import { playerKind } from "./embed.js";
import { planFollowerSync, shouldCorrectDrift } from "./player.js";

describe("player selection and drift", () => {
  it("picks an adapter from the url", () => {
    expect(playerKind({ provider: "youtube", url: "https://youtu.be/dQw4w9WgXcQ" })).toBe("youtube");
    expect(playerKind({ provider: "vimeo", url: "https://vimeo.com/1" })).toBe("vimeo");
    expect(playerKind({ provider: "twitch", url: "https://twitch.tv/nasa" })).toBe("twitch");
    expect(playerKind({ provider: "vk", url: "https://vk.com/video-1_2" })).toBe("vk");
    expect(playerKind({ provider: "rutube", url: "https://rutube.ru/video/abc" })).toBe("rutube");
    expect(playerKind({ provider: "direct", url: "https://cdn.example/film.mp4" })).toBe("file");
    expect(playerKind({ provider: "direct", url: "https://cdn.example/live/index.m3u8" })).toBe("hls");
  });

  it("seeks a follower only past the drift threshold", () => {
    expect(shouldCorrectDrift(1_000, 2_000)).toBe(false);
    expect(shouldCorrectDrift(1_000, 3_000)).toBe(true);
    const caughtUp = planFollowerSync({
      playback: "playing",
      adapterPhase: "playing",
      localMs: 5_000,
      authorityMs: 5_400,
    });
    expect(caughtUp).toEqual({ seekToMs: null, play: false, pause: false });
    const behind = planFollowerSync({
      playback: "playing",
      adapterPhase: "paused",
      localMs: 1_000,
      authorityMs: 8_000,
    });
    expect(behind.seekToMs).toBe(8_000);
    expect(behind.play).toBe(true);
    const holding = planFollowerSync({
      playback: "paused",
      adapterPhase: "playing",
      localMs: 4_000,
      authorityMs: 4_000,
    });
    expect(holding.pause).toBe(true);
    expect(holding.seekToMs).toBeNull();
  });

  it("keeps extractors off unless the flag is set", () => {
    expect(extractorsEnabled(undefined)).toBe(false);
    expect(extractorsEnabled("false")).toBe(false);
    expect(extractorsEnabled("true")).toBe(true);
    expect(extractorsEnabled("1")).toBe(true);
  });
});
