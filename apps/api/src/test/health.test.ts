import { afterEach, describe, expect, it } from "vitest";
import { buildApp } from "../app.js";
import { loadApiEnv } from "../env.js";
import type { RedisLike } from "../redis.js";

const env = loadApiEnv({ NODE_ENV: "test" });

function fakeRedis(up: boolean): RedisLike {
  return {
    get: async () => null,
    setWithTtl: async () => undefined,
    delete: async () => undefined,
    take: async () => null,
    incr: async () => 1,
    expire: async () => 1,
    ping: async () => {
      if (!up) throw new Error("redis_down");
      return true;
    },
    quit: async () => undefined,
  };
}

describe("health", () => {
  let app: Awaited<ReturnType<typeof buildApp>> | undefined;

  afterEach(async () => {
    await app?.close();
  });

  it("answers liveness and reports missing dependencies in test mode", async () => {
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

    expect(ready.json()).toMatchObject({
      status: "ready",
      mode: "live",
      checks: { livekit: "disabled", jwt: "missing", database: "missing", redis: "missing" },
    });
  });

  it("probes Redis for real in production and returns 503 when it is down", async () => {
    const production = loadApiEnv({ NODE_ENV: "production", REDIS_URL: "redis://127.0.0.1:6379" });
    app = await buildApp(production, { redis: fakeRedis(false) });
    const notReady = await app.inject({ method: "GET", url: "/ready" });
    expect(notReady.statusCode).toBe(503);
    expect(notReady.json()).toMatchObject({ status: "not_ready", checks: { redis: "down" } });
  });

  it("reports ready in production when Redis answers", async () => {
    const production = loadApiEnv({ NODE_ENV: "production", REDIS_URL: "redis://127.0.0.1:6379" });
    app = await buildApp(production, { redis: fakeRedis(true) });
    const ready = await app.inject({ method: "GET", url: "/ready" });
    // DATABASE_URL is still missing, so production stays not ready — but Redis itself is up.
    expect(ready.json()).toMatchObject({ checks: { redis: "up", database: "missing" } });
    expect(ready.statusCode).toBe(503);
  });
});
