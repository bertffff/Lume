import { createHash, createHmac } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { buildApp } from "../app.js";
import { loadApiEnv } from "../env.js";
import { verifyLoginWidget, verifyTelegramInitData } from "../auth/telegram.js";

const BOT = "123456:TEST_TOKEN";
const USER = JSON.stringify({ id: 42, first_name: "Аня", username: "anya" });
const AUTH_DATE = "1700000000";
const FROZEN_HASH = "e81a54d659799d68603c9927b8e2d6747f44c863f4b0747545bbbc70aff63568";

function signedInitData(hash: string): string {
  const params = new URLSearchParams();
  params.set("auth_date", AUTH_DATE);
  params.set("query_id", "AAE");
  params.set("user", USER);
  params.set("hash", hash);
  return params.toString();
}

describe("telegram auth", () => {
  let app: Awaited<ReturnType<typeof buildApp>> | undefined;

  afterEach(async () => {
    await app?.close();
  });

  it("matches the frozen WebAppData HMAC vector", () => {
    const params = new URLSearchParams(signedInitData(FROZEN_HASH));
    const secret = createHmac("sha256", "WebAppData").update(BOT).digest();
    const check = ["auth_date=1700000000", "query_id=AAE", `user=${USER}`].join("\n");
    const expected = createHmac("sha256", secret).update(check).digest("hex");
    expect(expected).toBe(FROZEN_HASH);
    const result = verifyTelegramInitData(params.toString(), {
      botToken: BOT,
      nowMs: 1_700_000_000_000 + 5_000,
      maxAgeSeconds: 60,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.user.username).toBe("anya");
    }
  });

  it("rejects a bad hash and an expired auth date", () => {
    expect(
      verifyTelegramInitData(signedInitData("aa"), {
        botToken: BOT,
        nowMs: 1_700_000_010_000,
        maxAgeSeconds: 60 * 60,
      }).ok,
    ).toBe(false);
    const expired = verifyTelegramInitData(signedInitData(FROZEN_HASH), {
      botToken: BOT,
      nowMs: Date.parse("2026-11-04T00:00:00.000Z"),
      maxAgeSeconds: 60 * 60 * 24,
    });
    expect(expired).toEqual({ ok: false, reason: "expired" });
    const future = verifyTelegramInitData(signedInitData(FROZEN_HASH), {
      botToken: BOT,
      nowMs: 1_700_000_000_000 - 31_000,
      maxAgeSeconds: 300,
    });
    expect(future).toEqual({ ok: false, reason: "expired" });
  });

  it("rejects registration in production when Redis is down", async () => {
    app = await buildApp(loadApiEnv({ NODE_ENV: "production" }));
    const response = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: { email: "a@b.co", password: "password1", displayName: "Аня" },
    });
    expect(response.statusCode).toBe(503);
    expect(response.json()).toEqual({ error: "redis_unconfigured" });
  });

  it("checks a Telegram Login Widget hash", () => {
    const fields = { id: "42", first_name: "Аня", auth_date: AUTH_DATE };
    const secret = createHash("sha256").update(BOT).digest();
    const check = Object.keys(fields).sort().map((key) => `${key}=${fields[key as keyof typeof fields]}`).join("\n");
    const hash = createHmac("sha256", secret).update(check).digest("hex");
    expect(verifyLoginWidget({ ...fields, hash }, BOT, 1_700_000_000_000 + 5_000, 300)).toBe(true);
    expect(verifyLoginWidget({ ...fields, hash: "aa" }, BOT, 1_700_000_000_000, 300)).toBe(false);
  });

  it("refuses telegram login until a bot token or the stub flag is set", async () => {
    app = await buildApp(loadApiEnv({ NODE_ENV: "test" }));
    const response = await app.inject({
      method: "POST",
      url: "/auth/telegram",
      payload: { initData: signedInitData(FROZEN_HASH) },
    });
    expect(response.statusCode).toBe(501);
  });

  it("mints a stub JWT only when the stub flag and secret are present", async () => {
    app = await buildApp(
      loadApiEnv({
        NODE_ENV: "test",
        ALLOW_STUB_AUTH: "true",
        JWT_SECRET: "test-secret-not-for-production",
      }),
    );
    const denied = await app.inject({
      method: "POST",
      url: "/auth/token",
      payload: {},
    });
    expect(denied.statusCode).toBe(400);

    const minted = await app.inject({
      method: "POST",
      url: "/auth/token",
      payload: { userId: "user_1", telegramId: "42" },
    });
    expect(minted.statusCode).toBe(200);
    const token = minted.json().accessToken as string;
    expect(token.split(".")).toHaveLength(3);
  });
});
