import { Redis } from "ioredis";

/**
 * The subset of Redis the API needs for auth state and health checks.
 * A fake can implement it in tests without a live server.
 */
export interface RedisLike {
  get(key: string): Promise<string | null>;
  setWithTtl(key: string, value: string, ttlMs: number): Promise<void>;
  delete(key: string): Promise<void>;
  /** Atomically returns the value and removes the key. */
  take(key: string): Promise<string | null>;
  incr(key: string): Promise<number>;
  expire(key: string, seconds: number): Promise<number>;
  ping(): Promise<boolean>;
  quit(): Promise<void>;
}

const TAKE_SCRIPT = `
local value = redis.call('GET', KEYS[1])
if value then
  redis.call('DEL', KEYS[1])
end
return value
`;

export function redisAdapter(client: Redis): RedisLike {
  return {
    get: (key) => client.get(key),
    setWithTtl: async (key, value, ttlMs) => {
      await client.set(key, value, "PX", ttlMs);
    },
    delete: async (key) => {
      await client.del(key);
    },
    take: async (key) => (await client.eval(TAKE_SCRIPT, 1, key)) as string | null,
    incr: (key) => client.incr(key),
    expire: (key, seconds) => client.expire(key, seconds),
    ping: async () => (await client.ping()) === "PONG",
    quit: async () => {
      await client.quit();
    },
  };
}

export function createRedis(url: string): Redis {
  return new Redis(url, { maxRetriesPerRequest: 1, enableOfflineQueue: false });
}

/** Bounded readiness probe: a hanging socket must not hang `/ready`. */
export async function pingRedis(redis: RedisLike, timeoutMs = 3000): Promise<boolean> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<boolean>((resolve) => {
    timer = setTimeout(() => resolve(false), timeoutMs);
  });
  try {
    return await Promise.race([redis.ping().catch(() => false), timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
