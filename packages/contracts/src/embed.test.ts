import { describe, expect, it } from "vitest";
import { embedCommand, embedSrc, parseEmbedEvent, parseEmbedInput } from "./embed.js";

describe("embed adapters", () => {
  it("parses the first-wave providers and a direct url", () => {
    expect(parseEmbedInput("https://youtu.be/dQw4w9WgXcQ")?.provider).toBe("youtube");
    expect(parseEmbedInput("https://vk.com/video-200_123")?.externalId).toBe("-200_123");
    expect(parseEmbedInput("https://rutube.ru/video/abcdef12/")?.provider).toBe("rutube");
    expect(parseEmbedInput("https://www.twitch.tv/videos/99")?.externalId).toBe("video:99");
    expect(parseEmbedInput("https://vimeo.com/1084537")?.provider).toBe("vimeo");
    expect(parseEmbedInput("https://cdn.example/film.mp4")?.provider).toBe("direct");
    expect(parseEmbedInput("not a url")).toBeNull();
  });

  it("builds VK and Rutube embeds with their JS APIs enabled", () => {
    const vk = parseEmbedInput("https://vk.com/video-200_123");
    const vkSrc = embedSrc(vk!, "localhost");
    expect(vkSrc).toContain("vk.com/video_ext.php");
    expect(vkSrc).toContain("oid=-200");
    expect(vkSrc).toContain("id=123");
    expect(vkSrc).toContain("js_api=1");
    expect(vkSrc).toContain("hide_logo=1");
    const rutube = parseEmbedInput("https://rutube.ru/video/abcdef12/");
    expect(embedSrc(rutube!, "localhost")).toContain("rutube.ru/play/embed/abcdef12?controls=false");
  });

  it("serializes VK and Rutube postMessage commands and events", () => {
    expect(JSON.parse(embedCommand("vk", { type: "play" }))).toMatchObject({ method: "play" });
    expect(JSON.parse(embedCommand("vk", { type: "seek", positionMs: 42_000 }))).toMatchObject({ method: "seek", seek: 42 });
    expect(JSON.parse(embedCommand("rutube", { type: "pause" }))).toMatchObject({ type: "player:pause" });
    expect(JSON.parse(embedCommand("rutube", { type: "seek", positionMs: 7_500 }))).toMatchObject({ type: "player:seek", time: 7.5 });

    expect(parseEmbedEvent("vk", JSON.stringify({ event: "ready" }))).toEqual({ kind: "ready" });
    expect(parseEmbedEvent("vk", { event: "timeupdate", time: 12.5 })).toEqual({ kind: "time", positionMs: 12_500 });
    expect(parseEmbedEvent("vk", { event: "durationchange", duration: 90 })).toEqual({ kind: "duration", durationMs: 90_000 });
    expect(parseEmbedEvent("rutube", JSON.stringify({ type: "player:ready" }))).toEqual({ kind: "ready" });
    expect(parseEmbedEvent("rutube", { type: "timeUpdate", currentTime: 3.2 })).toEqual({ kind: "time", positionMs: 3_200 });
    expect(parseEmbedEvent("rutube", { type: "waiting" })).toEqual({ kind: "buffering" });
    expect(parseEmbedEvent("rutube", { type: "player:bogus" })).toBeNull();
    expect(parseEmbedEvent("vk", "not json")).toBeNull();
  });

  it("builds an iframe src the page can drop in", () => {
    const parsed = parseEmbedInput("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
    expect(parsed).not.toBeNull();
    expect(embedSrc(parsed!, "localhost")).toContain("youtube.com/embed/dQw4w9WgXcQ");
    const twitch = parseEmbedInput("https://twitch.tv/nasa");
    expect(embedSrc(twitch!, "localhost:5173")).toContain("parent=localhost");
  });
});
