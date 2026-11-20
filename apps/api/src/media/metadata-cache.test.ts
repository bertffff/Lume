import { describe, expect, it } from "vitest";
import { parseEmbedInput } from "@lume/contracts";
import {
  createCachedMetadataResolver,
  createCircuitBreaker,
  createMetadataCache,
} from "./metadata-cache.js";
import type { RedisLike } from "../redis.js";

function fakeRedis(): RedisLike & { rows: Map<string, { value: string; ttlMs: number }> } {
  const rows = new Map<string, { value: string; ttlMs: number }>();
  return {
    rows,
    get: async (key) => rows.get(key)?.value ?? null,
    setWithTtl: async (key, value, ttlMs) => {
      rows.set(key, { value, ttlMs });
    },
    delete: async (key) => {
      rows.delete(key);
    },
    take: async (key) => rows.get(key)?.value ?? null,
    incr: async () => 1,
    expire: async () => 1,
    ping: async () => true,
    quit: async () => undefined,
  };
}

const item = parseEmbedInput("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
if (!item) throw new Error("test fixture must parse");

describe("metadata cache", () => {
  it("writes a namespaced key with a TTL", async () => {
    const redis = fakeRedis();
    const cache = createMetadataCache(redis, 60_000);
    await cache.set(item.url, { title: "T", thumbnailUrl: null, durationMs: 1000 });
    const [key, row] = [...redis.rows.entries()][0] ?? [];
    expect(key?.startsWith("lume:meta:")).toBe(true);
    expect(row?.ttlMs).toBe(60_000);
    expect(await cache.get(item.url)).toEqual({ title: "T", thumbnailUrl: null, durationMs: 1000 });
  });

  it("returns cached metadata without touching the network", async () => {
    const cache = createMetadataCache(null);
    await cache.set(item.url, { title: "cached", thumbnailUrl: null, durationMs: null });
    const resolve = createCachedMetadataResolver(
      { allowPrivateHosts: false },
      { cache, breaker: createCircuitBreaker() },
    );
    expect(await resolve(item)).toEqual({ title: "cached", thumbnailUrl: null, durationMs: null });
  });

  it("ignores a corrupted cache entry", async () => {
    const redis = fakeRedis();
    redis.rows.set("lume:meta:missing", { value: "{not json", ttlMs: 1000 });
    const cache = createMetadataCache(redis);
    expect(await cache.get("https://example.com/x")).toBeNull();
  });
});

describe("circuit breaker", () => {
  it("opens after the threshold and closes after the cooldown", () => {
    let now = 1000;
    const breaker = createCircuitBreaker({ threshold: 2, cooldownMs: 5000, now: () => now });
    expect(breaker.allow()).toBe(true);
    breaker.failure();
    expect(breaker.allow()).toBe(true);
    breaker.failure();
    expect(breaker.allow()).toBe(false);
    now += 5001;
    expect(breaker.allow()).toBe(true);
    expect(breaker.state).toBe("closed");
  });

  it("resets failures after a success", () => {
    const breaker = createCircuitBreaker({ threshold: 2, now: () => 0 });
    breaker.failure();
    breaker.success();
    breaker.failure();
    expect(breaker.allow()).toBe(true);
  });
});
