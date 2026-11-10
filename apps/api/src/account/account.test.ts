import bcrypt from "bcryptjs";
import { describe, expect, it } from "vitest";
import { banBlocksJoin } from "../access/gates.js";
import { exportZip, isDueForPurge, purgeRepeat } from "./archive.js";
import { hashPassword, verifyPassword } from "./passwords.js";

describe("account decisions", () => {
  it("stores scrypt and still accepts a legacy bcrypt hash", async () => {
    const stored = await hashPassword("GoodPass1");
    expect(stored.startsWith("scrypt$")).toBe(true);
    expect(await verifyPassword("GoodPass1", stored)).toBe(true);
    expect(await verifyPassword("WrongPass1", stored)).toBe(false);
    const legacy = bcrypt.hashSync("GoodPass1", 4);
    expect(await verifyPassword("GoodPass1", legacy)).toBe(true);
    expect(await verifyPassword("WrongPass1", legacy)).toBe(false);
  });

  it("packs a GDPR export as a zip and knows when a deletion is due", () => {
    const bytes = exportZip({ "README.txt": "export", "profile.json": "{}" });
    expect(bytes[0]).toBe(0x50);
    expect(bytes[1]).toBe(0x4b);
    const now = new Date("2026-12-01T00:00:00.000Z");
    expect(isDueForPurge({ deletedAt: now, scheduledDeletionAt: new Date("2026-11-01T00:00:00.000Z") }, now)).toBe(true);
    expect(isDueForPurge({ deletedAt: now, scheduledDeletionAt: new Date("2027-01-01T00:00:00.000Z") }, now)).toBe(false);
    expect(purgeRepeat.pattern).toBe("0 3 * * *");
  });

  it("blocks a join for a room ban and for the owner's blacklist", () => {
    const room = { id: "room", ownerId: "host" };
    const now = new Date("2026-11-10T00:00:00.000Z");
    expect(
      banBlocksJoin(
        [{ type: "permanent", roomId: "room", ownerId: "host", liftedAt: null, expiresAt: null }],
        room,
        now,
      ),
    ).toBe(true);
    expect(
      banBlocksJoin(
        [{ type: "blacklist", roomId: null, ownerId: "host", liftedAt: null, expiresAt: null }],
        room,
        now,
      ),
    ).toBe(true);
    expect(
      banBlocksJoin(
        [{ type: "session", roomId: "room", ownerId: "host", liftedAt: null, expiresAt: new Date("2026-11-09T00:00:00.000Z") }],
        room,
        now,
      ),
    ).toBe(false);
  });
});
