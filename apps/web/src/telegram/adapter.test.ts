import { describe, expect, it } from "vitest";
import { previewThemeParams, themeParamsToCssVars } from "./adapter.js";

describe("telegram theme params", () => {
  it("maps the preview palette onto design tokens", () => {
    expect(themeParamsToCssVars(previewThemeParams)).toMatchObject({
      "--ds-bg": "#17212b",
      "--ds-surface-1": "#232e3c",
      "--ds-text-primary": "#f5f5f5",
      "--ds-text-secondary": "#8aa0b3",
      "--ds-accent": "#5288c1",
      "--ds-text-on-accent": "#ffffff",
    });
  });
});
