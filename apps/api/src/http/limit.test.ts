import { describe, expect, it } from "vitest";
import { limitFor, takeMemoryLimit, takeRedisLimit } from "./limit.js";

describe("route limits", () => {
  it("skips ordinary reads and caps login", () => {
    expect(limitFor("GET", "/rooms")).toBeNull();
    expect(limitFor("POST", "/auth/login")?.limit).toBe(20);
    expect(takeMemoryLimit("login:test", 2, 1_000, 0)).toBe(true);
    expect(takeMemoryLimit("login:test", 2, 1_000, 10)).toBe(true);
    expect(takeMemoryLimit("login:test", 2, 1_000, 20)).toBe(false);
  });

  it("uses a redis counter when one is provided", async () => {
    let count = 0;
    const redis = {
      incr: async () => {
        count += 1;
        return count;
      },
      expire: async () => 1,
    };
    expect(await takeRedisLimit(redis, "k", 1, 1000)).toBe(true);
    expect(await takeRedisLimit(redis, "k", 1, 1000)).toBe(false);
  });
});
