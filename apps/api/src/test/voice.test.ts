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

  it("signs a join token for the member identity without voice priority", async () => {
    const token = await mintLiveKitToken({
      apiKey: "devkey",
      apiSecret: "devsecret-devsecret-devsecret",
      identity: "user_1",
      name: "Аня",
      roomName: "lume_room_1",
      ttlSeconds: 600,
    });
    const payload = JSON.parse(Buffer.from(token.split(".")[1] ?? "", "base64url").toString()) as {
      sub?: string;
      name?: string;
      metadata?: string;
      video?: { room?: string; roomJoin?: boolean; canPublish?: boolean; canSubscribe?: boolean };
    };
    expect(payload.sub).toBe("user_1");
    expect(payload.name).toBe("Аня");
    expect(payload.video).toMatchObject({
      room: "lume_room_1",
      roomJoin: true,
      canPublish: true,
      canSubscribe: true,
    });
    expect(JSON.parse(payload.metadata ?? "{}")).toEqual({ "voice.priority": false });
  });
});
