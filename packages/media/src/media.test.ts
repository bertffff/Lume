import { createServer, type IncomingMessage, type Server } from "node:http";
import { afterEach, describe, expect, it } from "vitest";
import {
  createCobaltExtractor,
  createMediaRegistry,
  createRutubeExtractor,
  createTwitchExtractor,
  createVkExtractor,
  createYouTubeExtractor,
  createYtDlpExtractor,
  resolveMediaChain,
  searchVideos,
} from "./index.js";

const servers: Server[] = [];

afterEach(async () => {
  await Promise.all(
    servers.splice(0).map((server) => new Promise<void>((resolve) => server.close(() => resolve()))),
  );
});

async function serve(
  handler: (request: IncomingMessage, body: string) => { status?: number; body: string },
): Promise<string> {
  const server = createServer((request, response) => {
    const chunks: Buffer[] = [];
    request.on("data", (chunk: Buffer) => chunks.push(chunk));
    request.on("end", () => {
      const result = handler(request, Buffer.concat(chunks).toString("utf8"));
      response.writeHead(result.status ?? 200, { "content-type": "application/json" });
      response.end(result.body);
    });
  });
  servers.push(server);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
  const address = server.address();
  return typeof address === "object" && address ? `http://127.0.0.1:${address.port}` : "";
}

describe("youtube innerTube", () => {
  it("returns the HLS manifest from a live player response", async () => {
    const base = await serve(() => ({
      body: JSON.stringify({
        playabilityStatus: { status: "OK" },
        videoDetails: {
          videoId: "dQw4w9WgXcQ",
          title: "Видео",
          lengthSeconds: "213",
          thumbnail: { thumbnails: [{ width: 1920, height: 1080 }] },
        },
        streamingData: {
          hlsManifestUrl: "https://manifest.example/live.m3u8?expire=1999999999",
        },
      }),
    }));
    const extractor = createYouTubeExtractor({ youtubeApiBase: base });
    const resolved = await extractor.resolve("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
    expect(resolved.provider).toBe("youtube");
    expect(resolved.durationMs).toBe(213_000);
    expect(resolved.playback?.kind).toBe("hls");
  });

  it("reports an unplayable status instead of inventing a stream", async () => {
    const base = await serve(() => ({
      body: JSON.stringify({ playabilityStatus: { status: "LOGIN_REQUIRED" } }),
    }));
    const extractor = createYouTubeExtractor({ youtubeApiBase: base });
    await expect(extractor.resolve("https://youtu.be/dQw4w9WgXcQ")).rejects.toThrow("youtube_login_required");
  });
});

describe("rutube", () => {
  it("reads the play options balancer", async () => {
    const id = "0f1e2d3c4b5a69788796a5b4c3d2e1f0";
    const base = await serve((request) => {
      expect(request.url).toContain(`/api/play/options/${id}/`);
      return {
        body: JSON.stringify({
          title: "Rutube clip",
          duration: 60,
          video_balancer: { m3u8: "https://rutube.example/master.m3u8" },
        }),
      };
    });
    const extractor = createRutubeExtractor({ rutubeApiBase: base });
    const resolved = await extractor.resolve(`https://rutube.ru/video/${id}/`);
    expect(resolved.playback).toEqual({ kind: "hls", url: "https://rutube.example/master.m3u8" });
    expect(resolved.durationMs).toBe(60_000);
  });
});

describe("vk", () => {
  it("extracts HLS from the embed page", async () => {
    const base = await serve(() => ({
      body: `<html><title>VK clip</title><script>{"hls":"https:\\/\\/vk.example\\/live.m3u8?expire=1999999999"}</script></html>`,
    }));
    const extractor = createVkExtractor({ vkBaseUrl: base, vkCookies: "remixlang=0" });
    const resolved = await extractor.resolve("https://vk.com/video-123_456");
    expect(resolved.title).toBe("VK clip");
    expect(resolved.playback?.kind).toBe("hls");
    expect(resolved.playback?.url).toContain("vk.example");
  });

  it("rotates past a cookie that only returns a login wall", async () => {
    let calls = 0;
    const base = await serve(() => {
      calls += 1;
      return calls === 1
        ? { body: "<html>Вход</html>" }
        : { body: `<script>{"mp4_720":"https:\\/\\/vk.example\\/v.mp4"}</script>` };
    });
    const extractor = createVkExtractor({ vkBaseUrl: base, vkCookies: "a=1||b=2" });
    const resolved = await extractor.resolve("https://vk.com/video1_2");
    expect(resolved.playback).toEqual({ kind: "file", url: "https://vk.example/v.mp4" });
  });
});

describe("twitch", () => {
  it("builds an usher HLS url from the playback token", async () => {
    const base = await serve(() => ({
      body: JSON.stringify({
        data: {
          streamPlaybackAccessToken: {
            signature: "sig",
            value: JSON.stringify({ expires: 1_999_999_999 }),
          },
        },
      }),
    }));
    const extractor = createTwitchExtractor({
      twitchClientId: "client",
      twitchGqlUrl: base,
      usherBaseUrl: "https://usher.example",
    });
    const resolved = await extractor.resolve("https://www.twitch.tv/somechannel");
    expect(resolved.playback?.kind).toBe("hls");
    expect(resolved.playback?.url).toContain("https://usher.example/api/channel/hls/somechannel.m3u8");
    expect(resolved.playback?.url).toContain("sig=sig");
  });

  it("is unavailable without a client id", () => {
    const extractor = createTwitchExtractor({});
    expect(extractor.canHandle("https://www.twitch.tv/x")).toBe(false);
  });
});

describe("cobalt", () => {
  it("follows a tunnel response", async () => {
    const base = await serve(() => ({
      body: JSON.stringify({ status: "tunnel", url: "https://cdn.example/file.mp4", filename: "Clip" }),
    }));
    const extractor = createCobaltExtractor({ cobaltApiUrl: base });
    const resolved = await extractor.resolve("https://example.com/watch/1");
    expect(resolved.title).toBe("Clip");
    expect(resolved.playback).toEqual({ kind: "file", url: "https://cdn.example/file.mp4" });
  });

  it("surfaces a provider error", async () => {
    const base = await serve(() => ({
      status: 400,
      body: JSON.stringify({ status: "error", error: { code: "link.unsupported" } }),
    }));
    const extractor = createCobaltExtractor({ cobaltApiUrl: base });
    await expect(extractor.resolve("https://example.com/x")).rejects.toThrow("cobalt_unreachable");
  });
});

describe("yt-dlp", () => {
  it("parses dump-json output", async () => {
    const extractor = createYtDlpExtractor({
      ytdlpPath: "/usr/bin/yt-dlp",
      execFileImpl: async () =>
        JSON.stringify({
          title: "Yt clip",
          duration: 30,
          width: 1280,
          height: 720,
          url: "https://cdn.example/v.mp4",
          ext: "mp4",
          id: "abc",
          extractor_key: "Youtube",
        }),
    });
    const resolved = await extractor.resolve("https://example.com/watch/abc");
    expect(resolved.provider).toBe("youtube");
    expect(resolved.playback).toEqual({ kind: "file", url: "https://cdn.example/v.mp4" });
    expect(resolved.durationMs).toBe(30_000);
  });

  it("reports bad output instead of a fake media record", async () => {
    const extractor = createYtDlpExtractor({
      ytdlpPath: "/usr/bin/yt-dlp",
      execFileImpl: async () => "not json",
    });
    await expect(extractor.resolve("https://example.com/x")).rejects.toThrow("ytdlp_bad_output");
  });
});

describe("registry", () => {
  it("lists configured adapters and skips the rest", () => {
    const report = createMediaRegistry({ twitchClientId: "id" });
    expect(report.enabled).toContain("youtube-innertube");
    expect(report.enabled).toContain("twitch");
    expect(report.disabled.map((entry) => entry.id)).toEqual(
      expect.arrayContaining(["cobalt", "ytdlp"]),
    );
    expect(report.registry.find("https://www.youtube.com/watch?v=abc123")).not.toBeNull();
  });
});

describe("searxng search", () => {
  it("returns an honest unavailable response without a URL", async () => {
    expect(await searchVideos({}, "клип")).toEqual({
      results: [],
      unavailable: true,
      reason: "searxng_unconfigured",
    });
  });

  it("maps video results", async () => {
    const base = await serve(() => ({
      body: JSON.stringify({
        results: [
          {
            title: "Clip",
            url: "https://www.youtube.com/watch?v=abc",
            img_src: "https://img.example/i.jpg",
            length: "02:03",
          },
        ],
      }),
    }));
    const response = await searchVideos({ searxngUrl: base }, "clip");
    expect(response.unavailable).toBe(false);
    expect(response.results[0]).toMatchObject({
      title: "Clip",
      source: "youtube",
      durationMs: 123_000,
    });
  });
});

describe("fallback chain", () => {
  it("falls through a failing provider adapter to cobalt", async () => {
    const cobaltBase = await serve(() => ({
      body: JSON.stringify({ status: "tunnel", url: "https://cdn.example/fallback.mp4" }),
    }));
    // No youtubeApiBase override: the InnerTube attempt targets the real host and
    // fails offline; the chain must continue instead of giving up.
    const report = createMediaRegistry({
      cobaltApiUrl: cobaltBase,
      youtubeApiBase: "http://127.0.0.1:1",
      timeoutMs: 500,
    });
    const outcome = await resolveMediaChain(report, "https://youtu.be/dQw4w9WgXcQ", 500);
    expect(outcome.status).toBe("resolved");
    if (outcome.status === "resolved") {
      expect(outcome.extractorId).toBe("cobalt");
      expect(outcome.media.playback?.url).toBe("https://cdn.example/fallback.mp4");
    }
  });

  it("reports every failed attempt when no adapter succeeds", async () => {
    const report = createMediaRegistry({ youtubeApiBase: "http://127.0.0.1:1", timeoutMs: 300 });
    const outcome = await resolveMediaChain(report, "https://youtu.be/dQw4w9WgXcQ", 300);
    expect(outcome.status).toBe("failed");
    if (outcome.status === "failed") {
      expect(outcome.attempts.length).toBeGreaterThan(0);
    }
  });
});
