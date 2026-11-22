import { describe, expect, it } from "vitest";
import { formatClock, heatLevel, weekdayOf } from "./time.js";

describe("home time helpers", () => {
  it("formats clocks with and without hours", () => {
    expect(formatClock(4_364_000)).toBe("1:12:44");
    expect(formatClock(754_000)).toBe("12:34");
    expect(formatClock(-5)).toBe("0:00");
    expect(formatClock(Number.NaN)).toBe("0:00");
  });

  it("maps watch seconds onto five heat steps", () => {
    expect([0, 1, 1800, 5400, 10800].map(heatLevel)).toEqual([0, 1, 2, 3, 4]);
    expect(heatLevel(Number.NaN)).toBe(0);
  });

  it("returns a Monday-based weekday and tolerates fixture ids", () => {
    expect(weekdayOf("2026-11-22")).toBe(6);
    expect(weekdayOf("2026-11-23")).toBe(0);
    expect(weekdayOf("shot-3")).toBe(0);
  });
});
