import { describe, expect, it } from "vitest";
import { ru } from "../../i18n/ru.js";
import { formatDuration } from "./format.js";

const t = (key: "time.hoursMinutes" | "time.minutesSeconds" | "time.seconds", params: Record<string, number> = {}) =>
  ru[key].replace(/\{(\w+)\}/g, (_, name: string) => String(params[name] ?? ""));

describe("formatDuration", () => {
  it("shows hours instead of thousands of minutes", () => {
    expect(formatDuration(1_140_000, t)).toBe("316 ч 40 мин");
    expect(formatDuration(4_440, t)).toBe("1 ч 14 мин");
  });
  it("falls back to minutes and seconds, and never prints NaN", () => {
    expect(formatDuration(125, t)).toBe("2 мин 5 с");
    expect(formatDuration(9, t)).toBe("9 с");
    expect(formatDuration(Number.NaN, t)).toBe("0 с");
    expect(formatDuration(-4, t)).toBe("0 с");
  });
});
