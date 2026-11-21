import { allowHit, type RateBucket } from "@lume/contracts";

const memory = new Map<string, RateBucket>();

export function limitFor(method: string, path: string): { limit: number; windowMs: number } | null {
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
