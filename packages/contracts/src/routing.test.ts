import { describe, expect, it } from "vitest";
import { foreignOwnerIndex, replicaForRoom, roomHash } from "./routing.js";

describe("room hash routing", () => {
  it("is stable for the same room id", () => {
    expect(roomHash("room_demo")).toBe(1_590_751_732);
    expect(replicaForRoom("room_demo", 4)).toBe(0);
    expect(replicaForRoom("alpha", 4)).toBe(3);
    expect(replicaForRoom("вечер", 4)).toBe(0);
  });

  it("rejects an empty replica set", () => {
    expect(() => replicaForRoom("alpha", 0)).toThrow(/replicaCount/);
  });

  it("names the replica that should own writes", () => {
    expect(foreignOwnerIndex("alpha", 3, 4)).toBeNull();
    expect(foreignOwnerIndex("alpha", 0, 4)).toBe(3);
  });
});
