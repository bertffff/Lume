import { describe, expect, it } from "vitest";
import { pickSplash, splashes, usableName } from "./splashes.js";

describe("home splashes", () => {
  it("ships at least ten lines per language, with the same number of each", () => {
    expect(splashes.ru.length).toBeGreaterThanOrEqual(10);
    expect(splashes.en).toHaveLength(splashes.ru.length);
  });

  it("only shows time-of-day lines in their own part of the day", () => {
    const texts = (part: "morning" | "day" | "evening" | "night") => {
      const seen = new Set<string>();
      for (let step = 0; step < 200; step += 1) seen.add(pickSplash("ru", part, "Аня", () => step / 200));
      return seen;
    };
    expect(texts("night").has("Не спится? Нам тоже.")).toBe(true);
    expect(texts("day").has("Не спится? Нам тоже.")).toBe(false);
    expect(texts("evening").has("Ещё одну серию — и спать.")).toBe(true);
    expect(texts("morning").has("Ещё одну серию — и спать.")).toBe(false);
  });

  it("fills in the first name, and never leaves a placeholder for a guest", () => {
    const named = new Set<string>();
    for (let step = 0; step < 200; step += 1) named.add(pickSplash("ru", "day", "Аня", () => step / 200));
    expect(named.has("Аня, плед при тебе?")).toBe(true);
    for (let step = 0; step < 200; step += 1) expect(pickSplash("ru", "day", "", () => step / 200)).not.toContain("{name}");
  });

  it("only splices in names that read well as a bare word", () => {
    expect(usableName("Аня")).toBe("Аня");
    expect(usableName("xX_Killer_Xx")).toBe("xX_Killer_Xx");
    expect(usableName("Картошка")).toBe("Картошка");
    for (const bad of ["", "   ", "Очень Длинное Имя Пользователя", "ОченьДлинноеИмяПользователяБезПробелов", "😀😀", "12345", "<b>hi</b>", "https://x.y"]) {
      expect(usableName(bad), bad).toBe("");
    }
    for (let step = 0; step < 100; step += 1) expect(pickSplash("ru", "day", "😀😀", () => step / 100)).not.toContain("{name}");
  });

  it("is deterministic for a fixed random source and tolerates the extreme values", () => {
    expect(pickSplash("en", "day", "", () => 0)).toBe(pickSplash("en", "day", "", () => 0));
    expect(pickSplash("en", "day", "", () => 0.9999999)).toBeTruthy();
    expect(pickSplash("ru", "night", "", () => 1)).toBeTruthy();
  });
});
