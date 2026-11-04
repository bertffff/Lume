import {
  applyPause,
  applyPlay,
  applySeek,
  initialPlayback,
  positionAt,
  toPlaybackSnapshot,
  type PlaybackAnchor,
  type PlaybackSnapshot,
} from "@lume/contracts";
import { playbackKey } from "./keys.js";

interface PlaybackRedis {
  get(key: string): Promise<string | null>;
  eval(
    script: string,
    numKeys: number,
    key: string,
    expected: string,
    nextJson: string,
  ): Promise<unknown>;
}

const CAS_LUA = `
local raw = redis.call('GET', KEYS[1])
if raw == false then
  if ARGV[1] ~= '' then
    return {'conflict', ''}
  end
  redis.call('SET', KEYS[1], ARGV[2])
  return {'ok', ARGV[2]}
end
local ok, decoded = pcall(cjson.decode, raw)
if not ok then
  return {'conflict', raw}
end
if tostring(decoded['version']) ~= ARGV[1] then
  return {'conflict', raw}
end
redis.call('SET', KEYS[1], ARGV[2])
return {'ok', ARGV[2]}
`;

export type PlaybackOp =
  | { type: "play"; actorId: string }
  | { type: "pause"; actorId: string }
  | { type: "seek"; actorId: string; positionMs: number };

function isAnchor(value: unknown): value is PlaybackAnchor {
  if (!value || typeof value !== "object") {
    return false;
  }
  const record = value as Record<string, unknown>;
  return (
    (record.status === "playing" || record.status === "paused") &&
    typeof record.anchorPositionMs === "number" &&
    typeof record.anchorServerTimeMs === "number" &&
    typeof record.version === "number" &&
    typeof record.updatedBy === "string"
  );
}

function parseAnchor(raw: string | null): PlaybackAnchor | null {
  if (!raw) {
    return null;
  }
  try {
    const value: unknown = JSON.parse(raw);
    return isAnchor(value) ? value : null;
  } catch {
    return null;
  }
}

export async function readPlayback(redis: PlaybackRedis, roomId: string): Promise<PlaybackAnchor | null> {
  return parseAnchor(await redis.get(playbackKey(roomId)));
}

export function snapshotFor(
  roomId: string,
  anchor: PlaybackAnchor,
  serverTimeMs: number,
): PlaybackSnapshot {
  return toPlaybackSnapshot(roomId, anchor, positionAt(anchor, serverTimeMs), serverTimeMs);
}

function nextAnchor(current: PlaybackAnchor, op: PlaybackOp, serverNowMs: number): PlaybackAnchor {
  if (op.type === "play") {
    return applyPlay(current, op.actorId, serverNowMs);
  }
  if (op.type === "pause") {
    return applyPause(current, op.actorId, serverNowMs);
  }
  return applySeek(current, op.actorId, serverNowMs, op.positionMs);
}

export async function commitPlayback(
  redis: PlaybackRedis,
  roomId: string,
  op: PlaybackOp,
): Promise<PlaybackSnapshot | "version_conflict"> {
  const key = playbackKey(roomId);
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const serverNowMs = Date.now();
    const stored = parseAnchor(await redis.get(key));
    const current = stored ?? initialPlayback(op.actorId, serverNowMs);
    const next = nextAnchor(current, op, serverNowMs);
    if (stored && next.version === stored.version) {
      return snapshotFor(roomId, stored, serverNowMs);
    }
    const expected = stored ? String(stored.version) : "";
    const result = (await redis.eval(CAS_LUA, 1, key, expected, JSON.stringify(next))) as
      | [string, string]
      | null;
    const status = result?.[0];
    if (status === "ok") {
      return snapshotFor(roomId, next, serverNowMs);
    }
  }
  return "version_conflict";
}
