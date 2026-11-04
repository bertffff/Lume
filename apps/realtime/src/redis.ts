import { Redis } from "ioredis";

export interface RedisPair {
  pub: Redis;
  sub: Redis;
}

export async function connectRedis(url: string | undefined): Promise<RedisPair | null> {
  if (!url) {
    return null;
  }
  const pub = new Redis(url, {
    maxRetriesPerRequest: 2,
    lazyConnect: true,
    connectTimeout: 2_000,
  });
  const sub = pub.duplicate();
  try {
    await pub.connect();
    await sub.connect();
    return { pub, sub };
  } catch (error) {
    pub.disconnect();
    sub.disconnect();
    console.error("redis_unavailable", error instanceof Error ? error.message : error);
    return null;
  }
}
