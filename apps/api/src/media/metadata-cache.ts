import { createHash } from "node:crypto";
import { roomCategorySchema, type ParsedEmbed } from "@lume/contracts";
import type { RedisLike } from "../redis.js";
import { resolveMetadata, type MetadataOptions, type ResolvedMetadata } from "./metadata.js";

const defaultTtlMs = 5 * 60_000;

export interface MetadataCache {
  get(key: string): Promise<ResolvedMetadata | null>;
  set(key: string, value: ResolvedMetadata): Promise<void>;
}

function cacheKey(url: string): string {
  return `lume:meta:${createHash("sha256").update(url).digest("hex")}`;
}

function parse(raw: string | null): ResolvedMetadata | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<ResolvedMetadata>;
    if (
      value === null ||
      typeof value !== "object" ||
      (typeof value.title !== "string" && value.title !== null) ||
      (typeof value.thumbnailUrl !== "string" && value.thumbnailUrl !== null) ||
      (typeof value.durationMs !== "number" && value.durationMs !== null)
    ) {
      return null;
    }
    const category = roomCategorySchema.safeParse(value.category);
    return {
      title: value.title ?? null,
      thumbnailUrl: value.thumbnailUrl ?? null,
      durationMs: value.durationMs ?? null,
      ...(category.success ? { category: category.data } : {}),
      ...(typeof value.channel === "string" ? { channel: value.channel } : {}),
    };
  } catch {
    return null;
  }
}

export function createMetadataCache(redis: RedisLike | null, ttlMs = defaultTtlMs): MetadataCache {
  const memory = new Map<string, { value: ResolvedMetadata; expiresAt: number }>();
  return {
    async get(key) {
      if (redis) {
        return parse(await redis.get(cacheKey(key)).catch(() => null));
      }
      const row = memory.get(key);
      if (!row) return null;
      if (row.expiresAt <= Date.now()) {
        memory.delete(key);
        return null;
      }
      return row.value;
    },
    async set(key, value) {
      if (redis) {
        await redis.setWithTtl(cacheKey(key), JSON.stringify(value), ttlMs).catch(() => undefined);
        return;
      }
      memory.set(key, { value, expiresAt: Date.now() + ttlMs });
    },
  };
}

export interface CircuitBreaker {
  allow(): boolean;
  success(): void;
  failure(): void;
  readonly state: "closed" | "open";
}

/** Stops hammering an external metadata provider that just failed. */
export function createCircuitBreaker(options: {
  threshold?: number;
  cooldownMs?: number;
  now?: () => number;
} = {}): CircuitBreaker {
  const threshold = options.threshold ?? 5;
  const cooldownMs = options.cooldownMs ?? 30_000;
  const now = options.now ?? Date.now;
  let failures = 0;
  let openedAt = 0;

  return {
    get state() {
      if (openedAt === 0) return "closed";
      return now() - openedAt < cooldownMs ? "open" : "closed";
    },
    allow: () => {
      if (openedAt === 0) return true;
      if (now() - openedAt < cooldownMs) return false;
      openedAt = 0;
      failures = 0;
      return true;
    },
    success: () => {
      failures = 0;
      openedAt = 0;
    },
    failure: () => {
      failures += 1;
      if (failures >= threshold) openedAt = now();
    },
  };
}

export interface MetadataResolverDeps {
  cache: MetadataCache;
  breaker: CircuitBreaker;
  /** Whole-call deadline; a hung provider must not hang the API request. */
  timeoutMs?: number;
}

export type MetadataResolver = (item: ParsedEmbed) => Promise<ResolvedMetadata | null>;

export function createCachedMetadataResolver(
  options: MetadataOptions,
  deps: MetadataResolverDeps,
): MetadataResolver {
  const deadline = deps.timeoutMs ?? 8000;
  return async (item) => {
    const cached = await deps.cache.get(item.url).catch(() => null);
    if (cached) return cached;
    if (!deps.breaker.allow()) return null;
    let timer: NodeJS.Timeout | undefined;
    const timeout = new Promise<{ timedOut: true }>((resolve) => {
      timer = setTimeout(() => resolve({ timedOut: true }), deadline);
    });
    try {
      const outcome = await Promise.race([
        resolveMetadata(item, options).then((value) => ({ value })),
        timeout,
      ]);
      if ("timedOut" in outcome) {
        deps.breaker.failure();
        return null;
      }
      if (outcome.value) {
        await deps.cache.set(item.url, outcome.value).catch(() => undefined);
      }
      deps.breaker.success();
      return outcome.value;
    } catch {
      deps.breaker.failure();
      return null;
    } finally {
      if (timer) clearTimeout(timer);
    }
  };
}
