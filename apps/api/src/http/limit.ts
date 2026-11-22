import { allowHit, type RateBucket } from "@lume/contracts";
import type { FastifyReply } from "fastify";
import type { RedisLike } from "../redis.js";

const memory = new Map<string, RateBucket>();
const joinWindowMs = 60_000;
// The per-account cap is strict; the shared IP must allow several participants behind one NAT.
export const roomJoinLimits = { ip: 24, account: 6 } as const;
export const roomJoinPath = "/rooms/join";

export function createRoomJoinLimiter(redis: Pick<RedisLike, "incrWithTtl"> | null, keyPrefix: string, production: boolean) {
  const local = new Map<string, { hits: RateBucket; expiresAt: number }>();
  let nextCleanup = 0;
  return async (reply: FastifyReply, scope: keyof typeof roomJoinLimits, identity: string): Promise<boolean> => {
    const key = `${scope}:${identity}`;
    const limit = roomJoinLimits[scope];
    let allowed: boolean | undefined;
    if (redis) {
      try {
        const count = await redis.incrWithTtl?.(`${keyPrefix}:rl:room-join:${key}`, joinWindowMs);
        if (count !== undefined) allowed = count <= limit;
      } catch {
        // In production, falling back per replica would multiply the guess budget.
      }
    }
    if (allowed === undefined && production) {
      await reply.code(503).send({ error: "rate_limit_unavailable" });
      return false;
    }
    if (allowed === undefined) {
      const now = Date.now();
      if (now >= nextCleanup) {
        for (const [id, bucket] of local) if (bucket.expiresAt <= now) local.delete(id);
        nextCleanup = now + joinWindowMs;
      }
      const decision = allowHit(local.get(key)?.hits ?? { hits: [] }, now, limit, joinWindowMs);
      if (decision.ok) local.set(key, { hits: decision.bucket, expiresAt: now + joinWindowMs });
      allowed = decision.ok;
    }
    if (!allowed) {
      await reply.header("Retry-After", String(joinWindowMs / 1_000)).code(429).send({ error: "rate_limited" });
    }
    return allowed;
  };
}

export type RoomJoinLimiter = ReturnType<typeof createRoomJoinLimiter>;

export function limitFor(method: string, path: string): { limit: number; windowMs: number } | null {
  if (method === "POST" && path === roomJoinPath) return { limit: roomJoinLimits.ip, windowMs: joinWindowMs };
  if (method === "GET" && !path.startsWith("/auth")) {
    return null;
  }
  if (path.startsWith("/auth/login") || path.startsWith("/auth/register")) {
    return { limit: 20, windowMs: 15 * 60_000 };
  }
  if (path.startsWith("/auth/magic-link")) {
    return { limit: 5, windowMs: 15 * 60_000 };
  }
  return { limit: 120, windowMs: 60_000 };
}

export function takeMemoryLimit(key: string, limit: number, windowMs: number, nowMs: number): boolean {
  const decision = allowHit(memory.get(key) ?? { hits: [] }, nowMs, limit, windowMs);
  memory.set(key, decision.bucket);
  return decision.ok;
}

export async function takeRedisLimit(
  redis: { incr: (key: string) => Promise<number>; expire: (key: string, seconds: number) => Promise<number> },
  key: string,
  limit: number,
  windowMs: number,
): Promise<boolean> {
  const count = await redis.incr(key);
  if (count === 1) {
    await redis.expire(key, Math.ceil(windowMs / 1000));
  }
  return count <= limit;
}
