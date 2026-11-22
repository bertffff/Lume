import { describe, expect, it } from "vitest";
import { dayPartOf } from "./greeting.js";

describe("dayPartOf", () => {
  it("splits the day at 5, 11, 17 and 23 o'clock", () => {
    expect([0, 4, 5, 10, 11, 16, 17, 22, 23].map(dayPartOf)).toEqual(["night", "night", "morning", "morning", "day", "day", "evening", "evening", "night"]);
  });

  it("wraps hours outside 0–23 instead of failing", () => {
    expect(dayPartOf(24)).toBe("night");
    expect(dayPartOf(-1)).toBe("night");
    expect(dayPartOf(29)).toBe("morning");
    expect(dayPartOf(12.7)).toBe("day");
  });
});
