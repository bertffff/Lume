import type { FastifyReply } from "fastify";
import { describe, expect, it, vi } from "vitest";
import { createRoomJoinLimiter, limitFor, takeMemoryLimit, takeRedisLimit } from "./limit.js";

describe("route limits", () => {
  it("skips ordinary reads and caps login", () => {
    expect(limitFor("GET", "/rooms")).toBeNull();
    expect(limitFor("POST", "/auth/login")?.limit).toBe(20);
    expect(takeMemoryLimit("login:test", 2, 1_000, 0)).toBe(true);
    expect(takeMemoryLimit("login:test", 2, 1_000, 10)).toBe(true);
    expect(takeMemoryLimit("login:test", 2, 1_000, 20)).toBe(false);
  });

  it("gives joins a stricter IP budget than ordinary writes", () => {
    expect(limitFor("POST", "/rooms/join")).toEqual({ limit: 24, windowMs: 60_000 });
  });

  it("fails closed when production Redis cannot enforce a join limit", async () => {
    const incrWithTtl = vi.fn().mockRejectedValue(new Error("Redis unavailable"));
    const reply = { code: vi.fn().mockReturnThis(), send: vi.fn() } as unknown as FastifyReply;
    const take = createRoomJoinLimiter({ incrWithTtl }, "test", true);
    expect(await take(reply, "account", "user-id")).toBe(false);
    expect(incrWithTtl).toHaveBeenCalledWith("test:rl:room-join:account:user-id", 60_000);
    expect(reply.code).toHaveBeenCalledWith(503);
    expect(reply.send).toHaveBeenCalledWith({ error: "rate_limit_unavailable" });
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
