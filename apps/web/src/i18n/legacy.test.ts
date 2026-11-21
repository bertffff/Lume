import { describe, expect, it } from "vitest";
import { legacyText } from "./legacy.js";

describe("legacy locales", () => {
  it("loads every old namespace", () => {
    expect(legacyText("ru", "common", "nav.home")).toBe("Главная");
    expect(legacyText("en", "common", "nav.home")).toBe("Home");
    expect(legacyText("ru", "chat", "header")).toBe("Чат");
  });
});
