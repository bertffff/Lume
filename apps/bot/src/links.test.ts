import { describe, expect, it } from "vitest";
import { loadBotEnv, miniAppBase } from "./env.js";
import { miniAppUrl, roomCodeFromStartPayload } from "./links.js";

describe("telegram start payloads", () => {
  it("reads room_<code> and bare codes", () => {
    expect(roomCodeFromStartPayload("room_7kq2mx")).toBe("7kq2mx");
    expect(roomCodeFromStartPayload("7KQ2MX")).toBe("7kq2mx");
    expect(roomCodeFromStartPayload(" room_7KQ-2MX ")).toBe("7kq2mx");
  });

  it.each(["7kq2m", "7kq2mxz", "7kq2mxzz", "7KQ-2M0", "7K-Q2MX"])("rejects %s in both invite shapes", (input) => {
    expect(roomCodeFromStartPayload(input)).toBeNull();
    expect(roomCodeFromStartPayload(`room_${input}`)).toBeNull();
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
    const url = new URL(miniAppUrl("https://app.example/", "7KQ-2MX"));
    expect(url.searchParams.get("tgWebAppStartParam")).toBe("room_7kq2mx");
  });

  it("keeps an existing query string", () => {
    const url = new URL(miniAppUrl("https://app.example/?theme=dark", "7kq2mx"));
    expect(url.searchParams.get("theme")).toBe("dark");
    expect(url.searchParams.get("tgWebAppStartParam")).toBe("room_7kq2mx");
  });

  it("adds no start param for a plain start", () => {
    expect(new URL(miniAppUrl("https://app.example/", null)).search).toBe("");
  });

  it("does not propagate a room payload already present in the base on invalid start", () => {
    const base = "https://app.example/?tgWebAppStartParam=room_7kq2mxzz";
    expect(new URL(miniAppUrl(base, null)).search).toBe("");
    expect(new URL(miniAppUrl(base, "7kq2mxzz")).search).toBe("");
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
