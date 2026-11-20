import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
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
  ["E/home-desktop.html", "/?shot=home&style=cinema&mode=dark", "compare-home-cinema-dark.png", 1440, 900],
  ["E/home-desktop.html", "/?shot=home&style=cinema&mode=light", "compare-home-cinema-light.png", 1440, 900],
  ["E/home-mobile.html", "/?shot=home&style=cinema&mode=dark", "compare-home-cinema-mobile.png", 390, 844],
  ["E/room-desktop.html", "/?shot=room&style=cinema&mode=dark", "compare-room-cinema-dark.png", 1440, 900],
  ["E/notifications-desktop.html", "/?shot=notifications&style=cinema&mode=dark", "compare-notifications-cinema-dark.png", 1440, 900],
  ["E/queue-desktop.html", "/?shot=queue&style=cinema&mode=dark", "compare-queue-cinema-dark.png", 1440, 900],
  ["E/members-desktop.html", "/?shot=members&style=cinema&mode=dark", "compare-members-cinema-dark.png", 1440, 900],
  ["E/create-desktop.html", "/?shot=create&style=cinema&mode=dark", "compare-create-cinema-dark.png", 1440, 900],
  ["E/join-desktop.html", "/?shot=join&style=cinema&mode=dark", "compare-join-cinema-dark.png", 1440, 900],
  ["E/onboarding-desktop.html", "/?shot=onboarding&style=cinema&mode=dark", "compare-onboarding-cinema-dark.png", 1440, 900],
  ["E/room-not-found-desktop.html", "/?shot=missing&style=cinema&mode=dark", "compare-missing-cinema-dark.png", 1440, 900],
  ["E/offline-desktop.html", "/?shot=offline&style=cinema&mode=dark", "compare-offline-cinema-dark.png", 1440, 900],
  ["E/video-unavailable-desktop.html", "/?shot=unavailable&style=cinema&mode=dark", "compare-unavailable-cinema-dark.png", 1440, 900],
  ["G/settings-desktop.html", "/?shot=settings&style=gruvbox&mode=dark", "compare-settings-gruvbox-dark.png", 1440, 900],
  ["G/room-desktop.html", "/?shot=room&style=gruvbox&mode=dark", "compare-room-gruvbox-dark.png", 1440, 900],
  ["E/settings-desktop.html", "/?shot=settings&style=cinema&mode=dark", "compare-settings-cinema-dark.png", 1440, 900],
] as const;

/**
 * The final design references were exported from an older environment and are
 * deliberately not committed. Without them this file can only produce noise, so
 * skip the visual diff instead of failing CI or a fresh checkout.
 */
const referenceMocksAvailable = existsSync("/tmp/lume-design/final");

for (const [mock, appPath, file, width, height] of cases) {
  test(file, async ({ page }) => {
    test.skip(!referenceMocksAvailable, "reference mocks from /tmp/lume-design/final are not available");
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
