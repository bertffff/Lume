import { describe, expect, it } from "vitest";
import { loadBotEnv, miniAppBase } from "./env.js";
import { miniAppUrl, roomCodeFromStartPayload } from "./links.js";

describe("telegram start payloads", () => {
  it("reads room_<code> and bare codes", () => {
    expect(roomCodeFromStartPayload("room_abc123")).toBe("abc123");
    expect(roomCodeFromStartPayload("abc123")).toBe("abc123");
    expect(roomCodeFromStartPayload(" room_abc123 ")).toBe("abc123");
  });

  it("rejects user ids and malformed codes", () => {
    expect(roomCodeFromStartPayload("user_42")).toBeNull();
    expect(roomCodeFromStartPayload("room_")).toBeNull();
    expect(roomCodeFromStartPayload("room_a")).toBeNull();
    expect(roomCodeFromStartPayload("room_has space")).toBeNull();
    expect(roomCodeFromStartPayload(undefined)).toBeNull();
  });
});

describe("mini app url", () => {
  it("carries the room code into tgWebAppStartParam", () => {
    const url = new URL(miniAppUrl("https://app.example/", "abc123"));
    expect(url.searchParams.get("tgWebAppStartParam")).toBe("room_abc123");
  });

  it("keeps an existing query string", () => {
    const url = new URL(miniAppUrl("https://app.example/?theme=dark", "abc123"));
    expect(url.searchParams.get("theme")).toBe("dark");
    expect(url.searchParams.get("tgWebAppStartParam")).toBe("room_abc123");
  });

  it("adds no start param for a plain start", () => {
    expect(new URL(miniAppUrl("https://app.example/", null)).search).toBe("");
  });
});

describe("bot env", () => {
  it("prefers WEBAPP_URL over MINI_APP_URL", () => {
    expect(
      miniAppBase({ WEBAPP_URL: "https://a.example", MINI_APP_URL: "https://b.example" }),
    ).toBe("https://a.example");
    expect(miniAppBase({ MINI_APP_URL: "https://b.example" })).toBe("https://b.example");
    expect(miniAppBase({})).toBeNull();
  });

  it("rejects a non-URL mini app base", () => {
    expect(() => loadBotEnv({ WEBAPP_URL: "not-a-url" })).toThrow("Invalid bot environment");
    expect(loadBotEnv({ WEBAPP_URL: "https://app.example" }).WEBAPP_URL).toBe("https://app.example");
  });
});
