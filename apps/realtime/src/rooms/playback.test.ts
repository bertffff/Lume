import { decideCas, initialPlayback } from "@lume/contracts";
import { describe, expect, it } from "vitest";
import { commitPlayback } from "./playback.js";

function memoryRedis() {
  const data = new Map<string, string>();
  return {
    async get(key: string) {
      return data.get(key) ?? null;
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
    if (again === "version_conflict") {
      return;
    }
    expect(again.version).toBe(playing.version);

    const paused = await commitPlayback(redis, roomId, { type: "pause", actorId: "host" });
    expect(paused).not.toBe("version_conflict");
    if (paused !== "version_conflict") {
      expect(paused.status).toBe("paused");
      expect(paused.version).toBe(playing.version + 1);
    }
  });
});
