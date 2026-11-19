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

describe("stream proxy", () => {
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

  it("enforces the host allowlist, caps the size and streams a ranged body", async () => {
    server = createServer((request, response) => {
      if (request.url === "/redirect") {
        response.writeHead(302, { location: "/ok" });
        response.end();
        return;
      }
      if (request.url === "/escape") {
        response.writeHead(302, { location: "https://evil.example.com/x" });
        response.end();
        return;
      }
      if (request.url === "/slow") {
        response.writeHead(206, {
          "content-type": "video/mp4",
          "content-range": "bytes 0-7/8",
          "content-length": "8",
          "accept-ranges": "bytes",
        });
        response.write("start");
        setTimeout(() => response.end("end"), 200);
        return;
      }
      if (request.url === "/big") {
        const body = Buffer.alloc(4096, 7);
        response.writeHead(200, { "content-type": "video/mp4", "content-length": String(body.length), "accept-ranges": "bytes" });
        response.end(body);
        return;
      }
      if (request.url === "/ok") {
        const body = Buffer.from("hello");
        response.writeHead(206, {
          "content-type": "video/mp4",
          "content-range": `bytes 0-4/${body.length + 5}`,
          "content-length": String(body.length),
          "accept-ranges": "bytes",
        });
        response.end(body);
        return;
      }
      response.writeHead(404);
      response.end();
    });
    const base = await listen(server);
    const env = loadApiEnv({
      NODE_ENV: "test",
      JWT_SECRET: "stream-test-secret",
      ALLOW_STUB_AUTH: "true",
      WEB_ORIGIN: "http://127.0.0.1:5173",
      STREAM_ALLOWLIST: "127.0.0.1",
      STREAM_MAX_BYTES: "8",
      STREAM_ALLOW_PRIVATE_HOSTS: "true",
      STREAM_HEADER_TIMEOUT_MS: "50",
    });
    app = await buildApp(env);

    const ok = await app.inject({
      method: "GET",
      url: `/video/range?url=${encodeURIComponent(`${base}/ok`)}`,
      headers: { range: "bytes=0-4" },
    });
    expect(ok.statusCode).toBe(206);
    expect(ok.body).toBe("hello");
    expect(ok.headers["content-range"]).toBe("bytes 0-4/10");
    expect(ok.headers["accept-ranges"]).toBe("bytes");
    expect(ok.headers["content-type"]).toContain("video/mp4");

    const redirected = await app.inject({
      method: "GET",
      url: `/video/range?url=${encodeURIComponent(`${base}/redirect`)}`,
      headers: { range: "bytes=0-4" },
    });
    expect(redirected.statusCode).toBe(206);
    expect(redirected.body).toBe("hello");

    const escaped = await app.inject({
      method: "GET",
      url: `/video/range?url=${encodeURIComponent(`${base}/escape`)}`,
      headers: { range: "bytes=0-4" },
    });
    expect(escaped.statusCode).toBe(403);
    expect(escaped.json()).toMatchObject({ error: "host_not_allowed" });

    const slow = await app.inject({
      method: "GET",
      url: `/video/range?url=${encodeURIComponent(`${base}/slow`)}`,
      headers: { range: "bytes=0-" },
    });
    expect(slow.statusCode).toBe(206);
    expect(slow.body).toBe("startend");

    const big = await app.inject({
      method: "GET",
      url: `/video/range?url=${encodeURIComponent(`${base}/big`)}`,
      headers: { range: "bytes=0-4" },
    });
    expect(big.statusCode).toBe(413);
    expect(big.json()).toMatchObject({ error: "too_large" });

    const disallowed = await app.inject({
      method: "GET",
      url: `/video/range?url=${encodeURIComponent("https://evil.example.com/video.mp4")}`,
      headers: { range: "bytes=0-4" },
    });
    expect(disallowed.statusCode).toBe(403);
    expect(disallowed.json()).toMatchObject({ error: "host_not_allowed" });

    const noRange = await app.inject({
      method: "GET",
      url: `/video/range?url=${encodeURIComponent(`${base}/ok`)}`,
    });
    expect(noRange.statusCode).toBe(416);
  });
});
