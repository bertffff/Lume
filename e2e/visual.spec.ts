import { expect, test } from "@playwright/test";

const shots = ["home", "search", "settings", "auth", "onboarding", "missing", "unavailable", "premium", "notifications"] as const;

for (const style of ["cinema", "gruvbox"] as const) {
  for (const mode of ["dark", "light"] as const) {
    test(`shell ${style} ${mode}`, async ({ page }) => {
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.goto(`/?shot=home&style=${style}&mode=${mode}`);
      await expect(page.locator(".design-app")).toBeVisible();
      await expect(page.locator("body")).toContainText(/lume|LUME/i);
      await page.screenshot({ path: `test-results/visual/${style}-${mode}-home.png`, fullPage: true });
      for (const shot of shots.slice(1)) {
        await page.goto(`/?shot=${shot}&style=${style}&mode=${mode}`);
        await expect(page.locator(".design-app")).toBeVisible();
        await page.screenshot({ path: `test-results/visual/${style}-${mode}-${shot}.png` });
      }
    });
  }
}

test("mobile cinema home", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/?shot=home&style=cinema&mode=dark");
  await expect(page.getByTestId("lobby-name")).toBeVisible();
  await page.screenshot({ path: "test-results/visual/cinema-dark-home-mobile.png" });
});
