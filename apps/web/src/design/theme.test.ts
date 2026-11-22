import { describe, expect, it } from "vitest";
import { personHue, resolveMode } from "./theme.js";

describe("appearance", () => {
  it("resolves system mode and stable person hues", () => {
    expect(resolveMode("system", true)).toBe("light");
    expect(resolveMode("system", false)).toBe("dark");
    expect(resolveMode("light", false)).toBe("light");
    expect(personHue("альберт")).toBe(personHue("альберт"));
    expect(["lisa", "me", "artem", "mark", "dasha", "sonya", "nick", "katya"]).toContain(personHue("маркус"));
  });
});
