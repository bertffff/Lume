import { describe, expect, it } from "vitest";
import { previewThemeParams, themeParamsToCssVars } from "./adapter.js";

describe("telegram theme params", () => {
  it("maps the preview palette onto lume variables", () => {
    expect(themeParamsToCssVars(previewThemeParams)).toMatchObject({
      "--lume-bg": "#17212b",
      "--lume-accent": "#5288c1",
      "--lume-text": "#f5f5f5",
      "--bg": "#17212b",
      "--s1": "#232e3c",
      "--text": "#f5f5f5",
      "--accent": "#5288c1",
      "--accent-ink": "#ffffff",
    });
  });
});
