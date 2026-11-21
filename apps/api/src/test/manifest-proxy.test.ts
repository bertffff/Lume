import { createServer, type Server } from "node:http";
import { afterEach, describe, expect, it } from "vitest";
import { buildApp } from "../app.js";
import { loadApiEnv } from "../env.js";

async function listen(server: Server): Promise<string> {
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("no address");
  return `http://127.0.0.1:${address.port}`;
}

describe("manifest proxy", () => {
  let app: Awaited<ReturnType<typeof buildApp>> | undefined;
  let server: Server | undefined;

  afterEach(async () => {
    await app?.close();
    await new Promise<void>((resolve, reject) => {
      if (!server?.listening) {
        resolve();
        return;
      }
      server.close((error) => (error ? reject(error) : resolve()));
    });
    server = undefined;
  });

  it("rewrites master, media and DASH chains and passes segments through unchanged", async () => {
    server = createServer((request, response) => {
      const url = new URL(request.url ?? "/", "http://127.0.0.1");
      if (url.pathname === "/master.m3u8") {
        response.writeHead(200, { "content-type": "application/vnd.apple.mpegurl" });
        response.end("#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=800000\nvariant.m3u8\n");
        return;
      }
      if (url.pathname === "/variant.m3u8") {
        response.writeHead(200, { "content-type": "application/vnd.apple.mpegurl" });
        response.end("#EXTM3U\n#EXT-X-TARGETDURATION:4\n#EXT-X-KEY:METHOD=AES-128,URI=\"key.bin\"\n#EXTINF:4,\nseg.ts?token=1\n#EXT-X-ENDLIST\n");
        return;
      }
      if (url.pathname === "/seg.ts") {
        response.writeHead(200, { "content-type": "video/mp2t" });
        response.end(Buffer.from([0, 1, 2, 255, 10]));
        return;
      }
      if (url.pathname === "/playlist") {
        response.writeHead(200, { "content-type": "application/octet-stream" });
        response.end("#EXTM3U\n#EXTINF:4,\nseg.ts\n#EXT-X-ENDLIST\n");
        return;
      }
      if (url.pathname === "/soft404.m3u8") {
        response.writeHead(200, { "content-type": "text/html" });
        response.end("<html>not a playlist</html>");
        return;
      }
      if (url.pathname === "/huge.m3u8") {
        // No content-length: the cap must be enforced while reading, not only from the header.
        response.writeHead(200, { "content-type": "application/vnd.apple.mpegurl" });
        response.write("#EXTM3U\n");
        response.write("a".repeat(1_100_000));
        response.end();
        return;
      }
      if (url.pathname === "/manifest.mpd") {
        response.writeHead(200, { "content-type": "application/dash+xml" });
        response.end(`<?xml version="1.0"?>
<MPD xmlns="urn:mpeg:dash:schema:mpd:2011" type="static">
  <BaseURL>dash/</BaseURL>
  <Period><AdaptationSet><Representation>
    <SegmentTemplate media="seg-$RepresentationID$-$Number%05d$.m4s" initialization="init.mp4" />
  </Representation></AdaptationSet></Period>
</MPD>`);
        return;
      }
      response.writeHead(404);
      response.end();
    });
    const base = await listen(server);
    const env = loadApiEnv({
      NODE_ENV: "test",
      JWT_SECRET: "manifest-test-secret",
      ALLOW_STUB_AUTH: "true",
      WEB_ORIGIN: "http://127.0.0.1:5173",
      STREAM_ALLOWLIST: "127.0.0.1",
      STREAM_ALLOW_PRIVATE_HOSTS: "true",
    });
    app = await buildApp(env);

    const masterUrl = `${base}/master.m3u8`;
    const master = await app.inject({ method: "GET", url: `/video/hls-proxy?url=${encodeURIComponent(masterUrl)}&source=direct` });
    expect(master.statusCode).toBe(200);
    expect(master.headers["content-type"]).toContain("mpegurl");
    expect(master.body).toContain(`/video/hls-proxy?url=${encodeURIComponent(`${base}/variant.m3u8`)}`);

    const variant = await app.inject({ method: "GET", url: `/video/hls-proxy?url=${encodeURIComponent(`${base}/variant.m3u8`)}&source=rutube` });
    expect(variant.statusCode).toBe(200);
    expect(variant.body).toContain(`/video/hls-proxy?url=${encodeURIComponent(`${base}/seg.ts?token=1`)}`);
    expect(variant.body).toContain(`URI="/video/hls-proxy?url=${encodeURIComponent(`${base}/key.bin`)}`);
    expect(variant.body).toContain("#EXT-X-PLAYLIST-TYPE:VOD");
    expect(variant.body).toContain("#EXT-X-ENDLIST");

    const segment = await app.inject({ method: "GET", url: `/video/hls-proxy?url=${encodeURIComponent(`${base}/seg.ts?token=1`)}&source=direct` });
    expect(segment.statusCode).toBe(200);
    expect([...segment.rawPayload]).toEqual([0, 1, 2, 255, 10]);

    const dash = await app.inject({ method: "GET", url: `/video/hls-proxy?url=${encodeURIComponent(`${base}/manifest.mpd`)}&source=direct` });
    expect(dash.statusCode).toBe(200);
    expect(dash.headers["content-type"]).toContain("dash+xml");
    expect(dash.body).toContain(`/video/hls-proxy?url=${encodeURIComponent(`${base}/dash/`)}`);
    expect(dash.body).toContain("seg-$RepresentationID$-$Number%05d$.m4s");
    expect(dash.body).not.toContain("%24");
    expect(dash.body).not.toContain("dash/dash");
    expect(dash.body).toContain(`/video/hls-proxy?url=${encodeURIComponent(`${base}/dash/init.mp4`)}`);
    expect(dash.body).toContain("&amp;source=direct");

    const disallowed = await app.inject({ method: "GET", url: `/video/hls-proxy?url=${encodeURIComponent("https://evil.example.com/master.m3u8")}&source=direct` });
    expect(disallowed.statusCode).toBe(403);

    const extensionless = await app.inject({ method: "GET", url: `/video/hls-proxy?url=${encodeURIComponent(`${base}/playlist`)}&source=direct` });
    expect(extensionless.statusCode).toBe(200);
    expect(extensionless.headers["content-type"]).toContain("mpegurl");
    expect(extensionless.body).toContain(`/video/hls-proxy?url=${encodeURIComponent(`${base}/seg.ts`)}`);

    const soft404 = await app.inject({ method: "GET", url: `/video/hls-proxy?url=${encodeURIComponent(`${base}/soft404.m3u8`)}&source=direct` });
    expect(soft404.statusCode).toBe(200);
    expect(soft404.body).toContain("not a playlist");

    const huge = await app.inject({ method: "GET", url: `/video/hls-proxy?url=${encodeURIComponent(`${base}/huge.m3u8`)}&source=direct` });
    expect(huge.statusCode).toBe(413);
    expect(huge.json()).toMatchObject({ error: "too_large" });
  });
});
