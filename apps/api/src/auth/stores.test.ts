import { describe, expect, it } from "vitest";
import { createAuthStores } from "./stores.js";
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
    take: async (key) => {
      const row = rows.get(key);
      if (!row) return null;
      rows.delete(key);
      return row.value;
    },
    incr: async () => 1,
    expire: async () => 1,
    ping: async () => true,
    quit: async () => undefined,
  };
}

describe("auth stores", () => {
  it("rotates a refresh token exactly once", async () => {
    const stores = createAuthStores();
    const token = await stores.refresh.issue("user-1");
    const rotated = await stores.refresh.rotate(token);
    expect(rotated?.userId).toBe("user-1");
    expect(await stores.refresh.rotate(token)).toBeNull();
  });

  it("rejects a refresh token after logout", async () => {
    const stores = createAuthStores();
    const token = await stores.refresh.issue("user-2");
    await stores.refresh.revoke(token);
    expect(await stores.refresh.rotate(token)).toBeNull();
  });

  it("expires refresh tokens", async () => {
    const stores = createAuthStores();
    const token = await stores.refresh.issue("user-3", 1_000);
    expect(await stores.refresh.rotate(token, 1_000 + 8 * 24 * 60 * 60 * 1000)).toBeNull();
  });

  it("consumes a magic link once and keeps the email", async () => {
    const stores = createAuthStores();
    const { token } = await stores.magic.issue("a@example.com");
    expect(await stores.magic.consume(token)).toBe("a@example.com");
    expect(await stores.magic.consume(token)).toBeNull();
  });

  it("writes namespaced keys to Redis and sets a TTL", async () => {
    const redis = fakeRedis();
    const stores = createAuthStores({ redis, keyPrefix: "lume:test:abc" });
    const token = await stores.refresh.issue("user-4");
    const key = `lume:test:abc:auth:refresh:${token}`;
    expect(redis.rows.has(key)).toBe(true);
    expect(redis.rows.get(key)?.ttlMs).toBe(7 * 24 * 60 * 60 * 1000);
  });

  it("never reuses a token across key prefixes", async () => {
    const redis = fakeRedis();
    const first = createAuthStores({ redis, keyPrefix: "lume:test:one" });
    const second = createAuthStores({ redis, keyPrefix: "lume:test:two" });
    const token = await first.refresh.issue("user-5");
    expect(await second.refresh.rotate(token)).toBeNull();
    expect((await first.refresh.rotate(token))?.userId).toBe("user-5");
  });

  it("round-trips magic links through Redis", async () => {
    const redis = fakeRedis();
    const stores = createAuthStores({ redis, keyPrefix: "lume:test:magic" });
    const { token } = await stores.magic.issue("b@example.com");
    expect(await stores.magic.consume(token)).toBe("b@example.com");
    expect(await stores.magic.consume(token)).toBeNull();
  });
});
