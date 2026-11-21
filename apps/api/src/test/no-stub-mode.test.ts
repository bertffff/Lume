import { afterEach, describe, expect, it } from "vitest";
import { buildApp } from "../app.js";
import { loadApiEnv } from "../env.js";

describe("no-stub mode with empty provider keys", () => {
  let app: Awaited<ReturnType<typeof buildApp>> | undefined;

  afterEach(async () => {
    await app?.close();
  });

  it("answers with clear statuses instead of a 500 or an unhandled rejection", async () => {
    const env = loadApiEnv({
      NODE_ENV: "test",
      WEB_ORIGIN: "http://127.0.0.1:5173",
      JWT_SECRET: "no-stub-secret",
      ALLOW_STUB_AUTH: "false",
      ALLOW_STUB_VOICE: "false",
    });
    app = await buildApp(env);

    const health = await app.inject({ method: "GET", url: "/health" });
    expect(health.statusCode).toBe(200);

    const ready = await app.inject({ method: "GET", url: "/ready" });
    expect(ready.statusCode).toBe(200);
    expect(ready.json()).toMatchObject({
      status: "ready",
      checks: { telegram: "missing", livekit: "disabled" },
    });

    const dev = await app.inject({ method: "POST", url: "/auth/dev", payload: { displayName: "Гость" } });
    expect(dev.statusCode).toBe(403);
    expect(dev.json()).toMatchObject({ error: "stub_auth_disabled" });

    const telegram = await app.inject({
      method: "POST",
      url: "/auth/telegram",
      payload: { initData: "user=%7B%22id%22%3A1%2C%22first_name%22%3A%22A%22%7D&hash=x" },
    });
    expect(telegram.statusCode).toBe(501);
    expect(telegram.json()).toMatchObject({ error: "telegram_unconfigured" });

    const widget = await app.inject({
      method: "POST",
      url: "/auth/telegram-widget",
      payload: { id: "1", auth_date: "1", hash: "x" },
    });
    expect(widget.statusCode).toBe(501);
    expect(widget.json()).toMatchObject({ error: "telegram_unconfigured" });

    const voice = await app.inject({ method: "GET", url: "/voice/livekit" });
    expect(voice.statusCode).toBe(200);
    expect(voice.json()).toEqual({ enabled: false, stub: false });

    const token = await app.inject({ method: "POST", url: "/voice/livekit/token", payload: { roomId: "room" } });
    expect(token.statusCode).toBe(503);
    expect(token.json()).toMatchObject({ error: "livekit_disabled" });

    const mute = await app.inject({
      method: "POST",
      url: "/voice/livekit/mute",
      payload: { roomId: "room" },
    });
    expect(mute.statusCode).toBe(503);
    expect(mute.json()).toMatchObject({ error: "livekit_disabled" });

    // Without SMTP the magic link is returned in the response rather than pretending it was mailed.
    const magic = await app.inject({
      method: "POST",
      url: "/auth/magic-link",
      payload: { email: "guest@example.com" },
    });
    expect(magic.statusCode).toBe(200);
    expect(String(magic.json().magicLink)).toContain("?magic=");

    const metrics = await app.inject({ method: "GET", url: "/metrics" });
    expect(metrics.statusCode).toBe(200);
    expect(metrics.body).toContain("lume_sentry_configured 0");
  });

  it("refuses guest auth without a JWT secret instead of minting an unusable token", async () => {
    const env = loadApiEnv({
      NODE_ENV: "test",
      WEB_ORIGIN: "http://127.0.0.1:5173",
      ALLOW_STUB_AUTH: "true",
      ALLOW_STUB_VOICE: "true",
    });
    app = await buildApp(env);

    const dev = await app.inject({ method: "POST", url: "/auth/dev", payload: { displayName: "Гость" } });
    expect(dev.statusCode).toBe(503);
    expect(dev.json()).toMatchObject({ error: "database_unconfigured" });

    const token = await app.inject({
      method: "POST",
      url: "/auth/token",
      payload: { userId: "u1", displayName: "Гость" },
    });
    expect(token.statusCode).toBe(503);
    expect(token.json()).toMatchObject({ error: "jwt_unconfigured" });

    // The voice panel learns that the stub is on even when LiveKit keys are empty.
    const voice = await app.inject({ method: "GET", url: "/voice/livekit" });
    expect(voice.json()).toEqual({ enabled: false, stub: true });
  });
});
