import { expect, test } from "@playwright/test";
import { createRoom } from "./helpers/create-room";
import { openQueue } from "./helpers/room-ui";

test("a played row is reloaded from persisted history into the live queue", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("lobby-name").fill("Повтор");
  await page.getByTestId("lobby-sign-in").click();
  await createRoom(page, "Повтор");
  await openQueue(page);

  const url = `https://cdn.example.com/reload-${Date.now()}.mp4`;
  await page.getByTestId("queue-input").fill(url);
  await page.getByTestId("queue-add").click();
  await expect(page.locator(`[data-testid="queue-item"][data-url="${url}"]`)).toBeVisible();
  await page.getByTestId("queue-next").click();
  await expect(page.locator(`[data-testid="queue-history-item"][data-url="${url}"]`)).toBeVisible();

  await page.locator(`[data-testid="queue-history-item"][data-url="${url}"] [data-testid="history-reload"]`).click();
  await expect(page.locator(`[data-testid="queue-item"][data-url="${url}"]`)).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId("queue-history-count")).toHaveText("1");
});
