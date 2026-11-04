import { describe, expect, it } from "vitest";
import { canActOnMember, canControlPlayback } from "./roles.js";
import { roomOverMemberCap, sessionSoftWarn, SESSION_SOFT_WARN_MS } from "./limits.js";
import { decideCas } from "./decide-cas.js";

describe("roles and limits", () => {
  it("lets host and mod drive playback and blocks a viewer", () => {
    expect(canControlPlayback("host")).toBe(true);
    expect(canControlPlayback("mod")).toBe(true);
    expect(canControlPlayback("viewer")).toBe(false);
  });

  it("lets the host act on others and a mod act only on viewers", () => {
    expect(canActOnMember("host", "mod")).toBe(true);
    expect(canActOnMember("host", "viewer")).toBe(true);
    expect(canActOnMember("mod", "viewer")).toBe(true);
    expect(canActOnMember("mod", "mod")).toBe(false);
    expect(canActOnMember("viewer", "viewer")).toBe(false);
    expect(canActOnMember("host", "host")).toBe(false);
  });

  it("caps a free room at 25 and warns after four hours", () => {
    expect(roomOverMemberCap(24)).toBe(false);
    expect(roomOverMemberCap(25)).toBe(true);
    const start = 1_000;
    expect(sessionSoftWarn(start, start + SESSION_SOFT_WARN_MS - 1)).toBe(false);
    expect(sessionSoftWarn(start, start + SESSION_SOFT_WARN_MS)).toBe(true);
  });

  it("accepts a create or a matching playback version", () => {
    expect(decideCas(null, "")).toBe("ok");
    expect(decideCas(null, "0")).toBe("conflict");
    expect(decideCas(2, "2")).toBe("ok");
    expect(decideCas(2, "1")).toBe("conflict");
  });
});
