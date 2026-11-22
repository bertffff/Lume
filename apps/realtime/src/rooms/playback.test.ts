import { decideCas, holdPlaybackOp, initialPlayback } from "@lume/contracts";
import { describe, expect, it } from "vitest";
import { commitPlayback, rememberHeldPlay, resumeHeldPlayback } from "./playback.js";
import { setViewerPhase } from "./viewers.js";

function memoryRedis() {
  const data = new Map<string, string>();
  const hashes = new Map<string, Map<string, string>>();
  return {
    async get(key: string) {
      return data.get(key) ?? null;
    },
    async set(key: string, value: string, _mode?: "PX", _ttl?: number) {
      data.set(key, value);
      return "OK";
    },
    async del(key: string) {
      data.delete(key);
      return 1;
    },
    async eval(_script: string, _keys: number, key: string, expected: string, nextJson: string) {
      const raw = data.get(key) ?? null;
      const version = raw === null ? null : (JSON.parse(raw) as { version: number }).version;
      if (decideCas(version, expected) === "conflict") {
        return ["conflict", raw ?? ""];
      }
      data.set(key, nextJson);
      return ["ok", nextJson];
    },
    async hset(key: string, field: string, value: string) {
      const hash = hashes.get(key) ?? new Map<string, string>();
      hash.set(field, value);
      hashes.set(key, hash);
      return 1;
    },
    async hdel(key: string, field: string) {
      hashes.get(key)?.delete(field);
      return 1;
    },
    async hgetall(key: string) {
      return Object.fromEntries(hashes.get(key) ?? new Map<string, string>());
    },
  };
}

describe("playback cas", () => {
  it("stores play, ignores a repeated play, and pauses on the next version", async () => {
    const redis = memoryRedis();
    const roomId = "room-cas";
    const playing = await commitPlayback(redis, roomId, { type: "play", actorId: "host" });
    expect(playing).not.toBe("version_conflict");
    if (playing === "version_conflict") {
      return;
    }
    expect(playing.status).toBe("playing");
    expect(playing.version).toBe(initialPlayback("host", 0).version + 1);

    const again = await commitPlayback(redis, roomId, { type: "play", actorId: "host" });
    expect(again).not.toBe("version_conflict");
    if (again !== "version_conflict") expect(again.version).toBe(playing.version);

    const paused = await commitPlayback(redis, roomId, { type: "pause", actorId: "host" });
    expect(paused).not.toBe("version_conflict");
    if (paused !== "version_conflict") {
      expect(paused.status).toBe("paused");
      expect(paused.version).toBe(playing.version + 1);
    }
  });

  it("stores a pause when play is held for a buffering viewer", async () => {
    const redis = memoryRedis();
    const held = holdPlaybackOp({ type: "play" as const, actorId: "host" }, 1);
    expect(held.type).toBe("pause");
    const stored = await commitPlayback(redis, "room-hold", held);
    expect(stored).not.toBe("version_conflict");
    if (stored !== "version_conflict") expect(stored.status).toBe("paused");
    const free = holdPlaybackOp({ type: "play" as const, actorId: "host" }, 0);
    expect(free.type).toBe("play");
  });

  it("keeps a held play paused while a viewer buffers and resumes it when they leave", async () => {
    const redis = memoryRedis();
    const roomId = "room-held-resume";
    const held = holdPlaybackOp({ type: "play" as const, actorId: "host" }, 1);
    await commitPlayback(redis, roomId, held);
    await rememberHeldPlay(redis, roomId, "host");
    await setViewerPhase(redis, roomId, "guest", "buffering");

    // Still buffering: nothing resumes and the intent is kept.
    await expect(resumeHeldPlayback(redis, roomId)).resolves.toBeNull();

    // The buffering viewer disconnected / left: room:leave and disconnect clear the phase.
    await redis.hdel(`lume:room:${roomId}:viewers`, "guest");
    const resumed = await resumeHeldPlayback(redis, roomId);
    expect(resumed).not.toBeNull();
    expect(resumed).not.toBe("version_conflict");
    if (resumed && resumed !== "version_conflict") {
      expect(resumed.status).toBe("playing");
    }

    // The intent is consumed once, so a later viewer change does not replay it.
    await expect(resumeHeldPlayback(redis, roomId)).resolves.toBeNull();
  });

  it("keeps the held play when the resume loses the CAS race", async () => {
    const redis = memoryRedis();
    const conflicting = {
      ...redis,
      async eval() {
        return ["conflict", ""] as [string, string];
      },
    };
    await rememberHeldPlay(conflicting, "room-held-conflict", "host");
    await expect(resumeHeldPlayback(conflicting, "room-held-conflict")).resolves.toBe("version_conflict");
    await expect(conflicting.get("lume:room:room-held-conflict:held-play")).resolves.toBe("host");
  });
});
