import { z } from "zod";

export const entitlementKindSchema = z.enum([
  "theme",
  "flair",
  "decoration",
  "nameplate",
  "capability",
]);

export type EntitlementKind = z.infer<typeof entitlementKindSchema>;

export const premiumEntitlementSchema = z.object({
  id: z.string().min(1),
  userId: z.string().min(1),
  sku: z.string().min(1),
  kind: entitlementKindSchema,
  active: z.boolean(),
  expiresAt: z.string().datetime().nullable(),
});

export type PremiumEntitlement = z.infer<typeof premiumEntitlementSchema>;

/**
 * Server-heavy extras. They are modeled now and denied unless an active
 * capability entitlement exists. Nothing in this list is sold yet.
 */
export const heavyCapabilities = [
  "ai.moderation",
  "history.extended",
  "voice.priority",
] as const;

export type HeavyCapability = (typeof heavyCapabilities)[number];

const heavySet = new Set<string>(heavyCapabilities);

export function isEntitlementActive(
  entitlement: PremiumEntitlement,
  nowMs: number,
): boolean {
  if (!entitlement.active) {
    return false;
  }
  if (entitlement.expiresAt === null) {
    return true;
  }
  return Date.parse(entitlement.expiresAt) > nowMs;
}

export function themeAccess(
  theme: { id: string; premium: boolean },
  entitlements: readonly PremiumEntitlement[],
  nowMs: number,
): "allowed" | "locked" {
  if (!theme.premium) {
    return "allowed";
  }
  const sku = `theme.${theme.id}`;
  const hit = entitlements.find(
    (item) => item.kind === "theme" && item.sku === sku && isEntitlementActive(item, nowMs),
  );
  return hit ? "allowed" : "locked";
}

/**
 * Core product features stay allowed. Only the explicit heavy list is gated.
 */
export function capabilityAllowed(
  capability: string,
  entitlements: readonly PremiumEntitlement[],
  nowMs: number,
): boolean {
  if (!heavySet.has(capability)) {
    return true;
  }
  return entitlements.some(
    (item) =>
      item.kind === "capability" &&
      item.sku === capability &&
      isEntitlementActive(item, nowMs),
  );
}
