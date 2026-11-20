import { expect, test } from "@playwright/test";

const shots = [
  "home", "room", "search", "create", "join", "room-settings", "members", "queue", "profile",
  "settings", "premium", "auth", "onboarding", "notifications", "missing", "offline", "unavailable",
] as const;

for (const style of ["cinema", "gruvbox"] as const) {
  for (const mode of ["dark", "light"] as const) {
    for (const viewport of [{ name: "desktop", width: 1440, height: 900 }, { name: "mobile", width: 390, height: 844 }] as const) {
      test(`${style} ${mode} ${viewport.name}`, async ({ page }) => {
        test.setTimeout(180_000);
        await page.setViewportSize({ width: viewport.width, height: viewport.height });
        for (const shot of shots) {
          await page.goto(`/?shot=${shot}&style=${style}&mode=${mode}`);
          await expect(page.locator(".design-app")).toBeVisible();
          const noHorizontalScroll = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
          expect(noHorizontalScroll, `horizontal overflow on ${style}/${mode}/${viewport.name}/${shot}`).toBe(true);
          await page.screenshot({ path: `test-results/visual/${style}-${shot}-${viewport.name}-${mode}.png` });
        }
      });
    }
  }
}

test("mobile cinema home", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/?shot=home&style=cinema&mode=dark");
  await expect(page.locator(".design-app")).toHaveAttribute("data-view", "home");
  await expect(page.locator(".mobile-home")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Добрый вечер" })).toBeVisible();
  await expect(page.getByText("Открытые комнаты")).toBeVisible();
  await page.screenshot({ path: "test-results/visual/cinema-dark-home-mobile.png" });
});
