import { describe, expect, it } from "vitest";
import { shouldRefresh } from "./client.js";

describe("session refresh", () => {
  it("retries once when a refresh token is stored", () => {
    expect(shouldRefresh(401, "abc", false)).toBe(true);
    expect(shouldRefresh(401, "abc", true)).toBe(false);
    expect(shouldRefresh(403, "abc", false)).toBe(false);
    expect(shouldRefresh(401, undefined, false)).toBe(false);
  });
});