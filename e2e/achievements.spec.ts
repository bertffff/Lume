import { expect, test } from "@playwright/test";

test("the live profile derives achievements, xp, and level from persisted state", async ({ page }) => {
  const stamp = Date.now().toString(36);
  await page.goto("/");
  await page.getByTestId("lobby-name").fill(`Достижения ${stamp}`);
  await page.getByTestId("lobby-sign-in").click();
  await page.getByTestId("lobby-title").fill(`Достижения ${stamp}`);
  await page.getByTestId("lobby-create").click();
  await expect(page.getByTestId("room-title")).toHaveText(`Достижения ${stamp}`, { timeout: 20_000 });

  await page.goto("/profile");
  await expect(page.getByTestId("profile-achievement")).toHaveCount(10);
  await expect(page.locator('[data-testid="profile-achievement"][data-key="first_party"]')).toHaveAttribute("data-earned", "true");
  const earned = await page.locator('[data-testid="profile-achievement"][data-earned="true"]').count();
  expect(earned).toBeGreaterThanOrEqual(1);
  expect(earned).toBeLessThan(10);
  await expect(page.getByTestId("profile-achievements-count")).toContainText(`${earned} из 10`);
  await expect(page.locator('[data-testid="profile-achievement"][data-earned="false"]')).toHaveCount(10 - earned);
  await expect(page.getByTestId("profile-level")).toHaveText("Уровень 1");
  await expect(page.getByTestId("profile-xp")).toHaveText(/^\d+ XP$/);
  await expect(page.getByTestId("profile-next-level")).toContainText("XP");
});
