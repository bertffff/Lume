import { expect, test } from "@playwright/test";

test("a persisted recommendation can be added back into the live queue", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("lobby-name").fill(`Рекомендации ${Date.now()}`);
  await page.getByTestId("lobby-sign-in").click();
  await page.getByTestId("lobby-title").fill("Рекомендации");
  await page.getByTestId("lobby-create").click();
  await expect(page.getByTestId("room-title")).toHaveText("Рекомендации", { timeout: 20_000 });

  const url = `http://127.0.0.1:3099/recommend.mp4?stamp=${Date.now()}`;
  await page.getByTestId("queue-input").fill(url);
  await page.getByTestId("queue-add").click();
  await expect(page.locator(`[data-testid="queue-item"][data-url="${url}"]`)).toHaveAttribute("data-title", "Рекомендованный фильм");
  await page.getByTestId("queue-next").click();

  const recommendation = page.locator(`[data-testid="queue-recommendation"][data-url="${url}"]`);
  await expect(recommendation).toBeVisible({ timeout: 20_000 });
  await expect(recommendation).toContainText("история");
  await expect(recommendation).toContainText("Рекомендованный фильм");
  await recommendation.getByTestId("queue-recommendation-add").click();

  await expect(page.locator(`[data-testid="queue-item"][data-url="${url}"]`)).toHaveAttribute("data-title", "Рекомендованный фильм", { timeout: 20_000 });
  await expect(recommendation).toHaveCount(0);
});
