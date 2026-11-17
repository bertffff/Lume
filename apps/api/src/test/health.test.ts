import { afterEach, describe, expect, it } from "vitest";
import { buildApp } from "../app.js";
import { loadApiEnv } from "../env.js";

const env = loadApiEnv({ NODE_ENV: "test" });

describe("health", () => {
  let app: Awaited<ReturnType<typeof buildApp>> | undefined;

  afterEach(async () => {
    await app?.close();
  });

  it("answers liveness and config readiness", async () => {
    app = await buildApp(env);
    const health = await app.inject({ method: "GET", url: "/health" });
    expect(health.statusCode).toBe(200);
    expect(health.json()).toEqual({ status: "ok" });
    const blocked = await app.inject({ method: "GET", url: "/video/range?url=http://127.0.0.1/a.mp4", headers: { range: "bytes=0-1" } });
    expect(blocked.statusCode).toBe(400);

    const ready = await app.inject({ method: "GET", url: "/ready" });
    expect(ready.statusCode).toBe(200);
    const metrics = await app.inject({ method: "GET", url: "/metrics" });
    expect(metrics.statusCode).toBe(200);
    expect(metrics.body).toContain("lume_up 1");
    expect(metrics.body).toContain("lume_sentry_configured 0");

    const down = await buildApp(loadApiEnv({ NODE_ENV: "production" }));
    const notReady = await down.inject({ method: "GET", url: "/ready" });
    expect(notReady.statusCode).toBe(503);
    await down.close();

    expect(ready.json()).toMatchObject({
      status: "ready",
      mode: "config",
      checks: { livekit: "disabled", jwt: "missing" },
    });
  });
});
