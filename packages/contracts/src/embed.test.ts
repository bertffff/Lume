import { describe, expect, it } from "vitest";
import { embedSrc, parseEmbedInput } from "./embed.js";

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

  it("builds an iframe src the page can drop in", () => {
    const parsed = parseEmbedInput("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
    expect(parsed).not.toBeNull();
    expect(embedSrc(parsed!, "localhost")).toContain("youtube.com/embed/dQw4w9WgXcQ");
    const twitch = parseEmbedInput("https://twitch.tv/nasa");
    expect(embedSrc(twitch!, "localhost:5173")).toContain("parent=localhost");
  });
});
