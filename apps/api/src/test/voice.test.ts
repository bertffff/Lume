import { afterEach, describe, expect, it } from "vitest";
import { buildApp } from "../app.js";
import { loadApiEnv } from "../env.js";
import { mintLiveKitToken } from "../voice/livekit.js";

describe("livekit token", () => {
  let app: Awaited<ReturnType<typeof buildApp>> | undefined;

  afterEach(async () => {
    await app?.close();
  });

  it("stays disabled until the three LiveKit variables are set", async () => {
    app = await buildApp(loadApiEnv({ NODE_ENV: "test" }));
    const response = await app.inject({
      method: "POST",
      url: "/voice/livekit/token",
      payload: { roomId: "room_1", identity: "user_1", name: "Аня" },
    });
    expect(response.statusCode).toBe(503);
    expect(response.json()).toEqual({ error: "livekit_disabled" });
  });

  it("signs a token locally when credentials exist", async () => {
    const token = await mintLiveKitToken({
      apiKey: "devkey",
      apiSecret: "devsecret-devsecret-devsecret",
      identity: "user_1",
      name: "Аня",
      roomName: "room_1",
      ttlSeconds: 600,
    });
    expect(token.split(".")).toHaveLength(3);
  });
});
