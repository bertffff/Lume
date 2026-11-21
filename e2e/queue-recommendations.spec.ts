import { expect, test } from "@playwright/test";
import { createRoom } from "./helpers/create-room";
import { mockUrl } from "./helpers/config";
import { openQueue } from "./helpers/room-ui";

test("a persisted recommendation can be added back into the live queue", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("lobby-name").fill(`Рекомендации ${Date.now()}`);
  await page.getByTestId("lobby-sign-in").click();
  await createRoom(page, "Рекомендации");
  await openQueue(page);

  const url = `${mockUrl}/recommend.mp4?stamp=${Date.now()}`;
  await page.getByTestId("queue-input").fill(url);
  await page.getByTestId("queue-add").click();
  await expect(page.locator(`[data-testid="queue-item"][data-url="${url}"]`)).toHaveAttribute("data-title", "Рекомендованный фильм");
  await page.getByTestId("queue-next").click();
  await expect(page.getByTestId("queue-now")).toContainText("Рекомендованный фильм");
  const following = `${mockUrl}/recommend.mp4?following=${Date.now()}`;
  await page.getByTestId("queue-input").fill(following);
  await page.getByTestId("queue-add").click();
  await expect(page.locator(`[data-testid="queue-item"][data-url="${following}"]`)).toBeVisible();
  await page.getByTestId("queue-next").click();

  const recommendation = page.locator(`[data-testid="queue-recommendation"][data-url="${url}"]`);
  await expect(recommendation).toBeVisible({ timeout: 20_000 });
  await expect(recommendation).toContainText("история");
  await expect(recommendation).toContainText("Рекомендованный фильм");
  await recommendation.getByTestId("queue-recommendation-add").click();

  await expect(page.locator(`[data-testid="queue-item"][data-url="${url}"]`)).toHaveAttribute("data-title", "Рекомендованный фильм", { timeout: 20_000 });
  await expect(recommendation).toHaveCount(0);
});
