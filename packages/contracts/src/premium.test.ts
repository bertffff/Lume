import { describe, expect, it } from "vitest";
import { capabilityAllowed, themeAccess, type PremiumEntitlement } from "./premium.js";

const now = Date.parse("2026-11-04T00:00:00.000Z");

function entitlement(partial: Partial<PremiumEntitlement> & Pick<PremiumEntitlement, "sku" | "kind">): PremiumEntitlement {
  return {
    id: "ent",
    userId: "user",
    active: true,
    expiresAt: null,
    ...partial,
  };
}

describe("premium gate", () => {
  it("lets everyone use a free theme and locks a premium theme", () => {
    expect(themeAccess({ id: "ember", premium: false }, [], now)).toBe("allowed");
    expect(themeAccess({ id: "aurora", premium: true }, [], now)).toBe("locked");
    expect(
      themeAccess(
        { id: "aurora", premium: true },
        [entitlement({ sku: "theme.aurora", kind: "theme" })],
        now,
      ),
    ).toBe("allowed");
  });

  it("ignores an expired cosmetic entitlement", () => {
    expect(
      themeAccess(
        { id: "aurora", premium: true },
        [
          entitlement({
            sku: "theme.aurora",
            kind: "theme",
            expiresAt: "2020-01-01T00:00:00.000Z",
          }),
        ],
        now,
      ),
    ).toBe("locked");
  });

  it("gates only the heavy capability list", () => {
    expect(capabilityAllowed("chat.send", [], now)).toBe(true);
    expect(capabilityAllowed("ai.moderation", [], now)).toBe(false);
    expect(
      capabilityAllowed(
        "ai.moderation",
        [entitlement({ sku: "ai.moderation", kind: "capability" })],
        now,
      ),
    ).toBe(true);
  });
});
