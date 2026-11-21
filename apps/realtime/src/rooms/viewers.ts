import { viewerKey } from "./keys.js";

export interface ViewerPhase {
  userId: string;
  phase: "buffering" | "ready";
}

export interface ViewerRedis {
  hset(key: string, field: string, value: string): Promise<unknown>;
  hdel(key: string, field: string): Promise<unknown>;
  hgetall(key: string): Promise<Record<string, string>>;
}

export async function setViewerPhase(
  redis: ViewerRedis,
  roomId: string,
  userId: string,
  phase: ViewerPhase["phase"],
): Promise<void> {
  await redis.hset(viewerKey(roomId), userId, phase);
}

export async function clearViewerPhase(redis: ViewerRedis, roomId: string, userId: string): Promise<void> {
  await redis.hdel(viewerKey(roomId), userId);
}

export async function listViewerPhases(redis: ViewerRedis, roomId: string): Promise<ViewerPhase[]> {
  const raw = await redis.hgetall(viewerKey(roomId));
  const viewers: ViewerPhase[] = [];
  for (const [userId, phase] of Object.entries(raw)) {
    if (phase === "buffering" || phase === "ready") {
      viewers.push({ userId, phase });
    }
  }
  return viewers;
}
