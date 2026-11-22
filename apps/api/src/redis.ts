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
  /** Counter and initial TTL in one operation. Required for production invite throttling. */
  incrWithTtl?(key: string, ttlMs: number): Promise<number>;
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

const INCR_WITH_TTL_SCRIPT = `
local value = redis.call('INCR', KEYS[1])
if value == 1 then
  redis.call('PEXPIRE', KEYS[1], ARGV[1])
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
    incrWithTtl: async (key, ttlMs) => (await client.eval(INCR_WITH_TTL_SCRIPT, 1, key, ttlMs)) as number,
    expire: (key, seconds) => client.expire(key, seconds),
    ping: async () => (await client.ping()) === "PONG",
    quit: async () => {
      await client.quit();
    },
  };
}

export function createRedis(url: string): Redis {
  const client = new Redis(url, { maxRetriesPerRequest: 1, enableOfflineQueue: false });
  // Without a listener ioredis re-prints every reconnect attempt. Readiness and
  // the startup probe still report the outage explicitly.
  client.on("error", () => undefined);
  return client;
}

/**
 * Startup probe. `enableOfflineQueue: false` makes requests fail immediately
 * when disconnected, so the first PING needs an established socket; wait for
 * the `ready` event instead of racing the handshake.
 */
export async function waitForRedisReady(client: Redis, timeoutMs = 5000): Promise<boolean> {
  if (client.status === "ready") return true;
  return new Promise<boolean>((resolve) => {
    const finish = (ok: boolean) => {
      clearTimeout(timer);
      client.off("ready", onReady);
      resolve(ok);
    };
    const onReady = () => finish(true);
    const timer = setTimeout(() => finish(false), timeoutMs);
    client.once("ready", onReady);
  });
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
