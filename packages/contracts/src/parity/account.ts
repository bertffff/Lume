export function scheduledDeletion(nowMs: number): number {
  return nowMs + 30 * 24 * 60 * 60 * 1000;
}

export function linkedLabel(accounts: { email: boolean; telegram: boolean }): string {
  const parts = [accounts.email ? "почта" : null, accounts.telegram ? "Telegram" : null].filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : "нет";
}

export function unlinkAllowed(hasEmail: boolean): boolean {
  return hasEmail;
}

export function magicTokenFromSearch(search: string): string | null {
  const token = new URLSearchParams(search).get("magic");
  return token && token.length >= 8 ? token : null;
}

export function registerAvailability(nodeEnv: string, redisConfigured: boolean): "ok" | "redis_unconfigured" {
  return nodeEnv === "production" && !redisConfigured ? "redis_unconfigured" : "ok";
}

export function passwordIssue(password: string): "short" | "long" | "shape" | null {
  if (password.length < 8) return "short";
  if (password.length > 128) return "long";
  if (!/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/\d/.test(password)) return "shape";
  return null;
}

export interface ResumeSnapshot {
  title: string;
  description: string;
  isPublic: boolean;
  maxMembers: number;
  videoUrl: string | null;
  positionMs: number;
  queue: Array<{ url: string; title: string }>;
  historyCount: number;
}

export function resumeCard(snapshot: ResumeSnapshot | null): {
  title: string;
  positionMs: number;
  queueCount: number;
  historyCount: number;
} | null {
  if (!snapshot?.videoUrl && snapshot?.queue.length === 0) {
    return snapshot
      ? { title: snapshot.title, positionMs: snapshot.positionMs, queueCount: 0, historyCount: snapshot.historyCount }
      : null;
  }
  if (!snapshot) return null;
  return {
    title: snapshot.title,
    positionMs: snapshot.positionMs,
    queueCount: snapshot.queue.length,
    historyCount: snapshot.historyCount,
  };
}

export interface RateBucket {
  hits: number[];
}

export function allowHit(bucket: RateBucket, nowMs: number, limit: number, windowMs: number): { ok: boolean; bucket: RateBucket } {
  const hits = bucket.hits.filter((hit) => nowMs - hit < windowMs);
  if (hits.length >= limit) {
    return { ok: false, bucket: { hits } };
  }
  hits.push(nowMs);
  return { ok: true, bucket: { hits } };
}

export function tempMuteExpiry(nowMs: number, seconds: number): number | null {
  if (seconds < 30 || seconds > 24 * 60 * 60) {
    return null;
  }
  return nowMs + seconds * 1000;
}

export function slowModeAllows(lastMessageAtMs: number | null, nowMs: number, intervalSeconds: number, host: boolean): boolean {
  if (host || intervalSeconds <= 0 || lastMessageAtMs === null) {
    return true;
  }
  return nowMs - lastMessageAtMs >= intervalSeconds * 1000;
}
