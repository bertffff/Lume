import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { PNG } from "pngjs";
import pixelmatch from "pixelmatch";
import { expect, test } from "@playwright/test";

function mismatch(leftPath: string, rightPath: string, diffPath: string): number {
  const left = PNG.sync.read(readFileSync(leftPath));
  const right = PNG.sync.read(readFileSync(rightPath));
  const width = Math.min(left.width, right.width);
  const height = Math.min(left.height, right.height);
  const a = new PNG({ width, height });
  const b = new PNG({ width, height });
  PNG.bitblt(left, a, 0, 0, width, height, 0, 0);
  PNG.bitblt(right, b, 0, 0, width, height, 0, 0);
  const diff = new PNG({ width, height });
  const count = pixelmatch(a.data, b.data, diff.data, width, height, { threshold: 0.2 });
  const side = new PNG({ width: width * 2, height });
  PNG.bitblt(a, side, 0, 0, width, height, 0, 0);
  PNG.bitblt(b, side, 0, 0, width, height, width, 0);
  mkdirSync("/opt/cursor/artifacts", { recursive: true });
  writeFileSync(diffPath, PNG.sync.write(side));
  return count / (width * height);
}

const cases = [
  ["E/home-desktop.html", "/?shot=home&demo=1&style=cinema&mode=dark", "compare-home-cinema-dark.png", 1440, 900],
  ["E/home-desktop.html", "/?shot=home&demo=1&style=cinema&mode=light", "compare-home-cinema-light.png", 1440, 900],
  ["G/home-desktop.html", "/?shot=home&demo=1&style=gruvbox&mode=light", "compare-home-gruvbox-light.png", 1440, 900],
  ["E/home-mobile.html", "/?shot=home&demo=1&style=cinema&mode=dark", "compare-home-cinema-mobile.png", 390, 844],
  ["E/room-desktop.html", "/?shot=room&style=cinema&mode=dark", "compare-room-cinema-dark.png", 1440, 900],
  ["E/room-desktop.html", "/?shot=room&style=cinema&mode=light", "compare-room-cinema-light.png", 1440, 900],
  ["E/room-mobile.html", "/?shot=room&style=cinema&mode=dark", "compare-room-cinema-mobile.png", 390, 844],
  ["G/home-desktop.html", "/?shot=home&demo=1&style=gruvbox&mode=dark", "compare-home-gruvbox-dark.png", 1440, 900],
  ["G/room-desktop.html", "/?shot=room&style=gruvbox&mode=dark", "compare-room-gruvbox-dark.png", 1440, 900],
  ["E/settings-desktop.html", "/?shot=settings&style=cinema&mode=dark", "compare-settings-cinema-dark.png", 1440, 900],
  ["E/settings-desktop.html", "/?shot=settings&style=cinema&mode=light", "compare-settings-cinema-light.png", 1440, 900],
  ["E/profile-desktop.html", "/?shot=profile&demo=1&style=cinema&mode=dark", "compare-profile-cinema-dark.png", 1440, 900],
  ["E/search-desktop.html", "/?shot=search&style=cinema&mode=dark", "compare-search-cinema-dark.png", 1440, 900],
  ["E/auth-desktop.html", "/?shot=auth&style=cinema&mode=dark", "compare-auth-cinema-dark.png", 1440, 900],
  ["G/room-desktop.html", "/?shot=room&style=gruvbox&mode=light", "compare-room-gruvbox-light.png", 1440, 900],
] as const;

for (const [mock, appPath, file, width, height] of cases) {
  test(file, async ({ page }) => {
    test.setTimeout(60_000);
    await page.setViewportSize({ width, height });
    await page.goto(`file:///tmp/lume-design/final/${mock}`);
    const mode = appPath.includes("mode=light") ? "light" : "dark";
    await page.evaluate((next) => { document.documentElement.dataset.theme = next; }, mode);
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(600);
    await page.screenshot({ path: "/tmp/mock-side.png" });
    await page.goto(appPath);
    await page.locator(".design-app").waitFor();
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(600);
    await page.screenshot({ path: "/tmp/app-side.png" });
    const ratio = mismatch("/tmp/mock-side.png", "/tmp/app-side.png", `/opt/cursor/artifacts/${file}`);
    console.log(file, ratio.toFixed(3));
    if (file === "compare-home-cinema-dark.png") expect(ratio).toBeLessThan(0.3);
    if (file === "compare-room-cinema-dark.png") expect(ratio).toBeLessThan(0.42);
  });
}
