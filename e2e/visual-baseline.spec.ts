import { expect, test } from "@playwright/test";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { PNG } from "pngjs";
import pixelmatch from "pixelmatch";

const views = ["home", "room", "create", "join", "onboarding"] as const;
const styles = ["cinema", "gruvbox", "telerave"] as const;
const modes = ["dark", "light"] as const;
const viewports = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "mobile", width: 390, height: 844 },
] as const;

const directory = "e2e/baseline";
const update = process.env.UPDATE_BASELINES === "1";

for (const style of styles) {
  for (const mode of modes) {
    for (const viewport of viewports) {
      test(`${style} ${mode} ${viewport.name}`, async ({ page }) => {
        await page.setViewportSize({ width: viewport.width, height: viewport.height });
        await page.emulateMedia({ reducedMotion: "reduce" });
        for (const view of views) {
          await page.goto(`/?shot=${view}&style=${style}&mode=${mode}`);
          await expect(page.locator(".design-app")).toBeVisible();
          await page.evaluate(() => document.fonts.ready);
          await page.waitForTimeout(250);
          const buffer = await page.screenshot({ animations: "disabled", caret: "hide" });
          const file = `${directory}/${view}-${style}-${mode}-${viewport.name}.png`;
          if (update) {
            mkdirSync(directory, { recursive: true });
            writeFileSync(file, buffer);
            continue;
          }
          expect(existsSync(file), `missing baseline ${file}; run UPDATE_BASELINES=1 pnpm test:e2e`).toBe(true);
          const actual = PNG.sync.read(buffer);
          const expected = PNG.sync.read(readFileSync(file));
          expect(actual.width).toBe(expected.width);
          expect(actual.height).toBe(expected.height);
          const diff = new PNG({ width: actual.width, height: actual.height });
          const pixels = pixelmatch(actual.data, expected.data, diff.data, actual.width, actual.height, {
            threshold: 0.2,
          });
          const ratio = pixels / (actual.width * actual.height);
          expect(ratio, `${view} ${style} ${mode} ${viewport.name} differs by ${(ratio * 100).toFixed(2)}%`).toBeLessThanOrEqual(0.02);
        }
      });
    }
  }
}
