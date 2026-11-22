import { expect, test } from "@playwright/test";
import { createRoom } from "./helpers/create-room";
import { openQueue } from "./helpers/room-ui";

test("a second watch promotes the video into favourites on the live profile", async ({ page }) => {
  const stamp = Date.now().toString(36);
  const url = `https://cdn.example.com/favourite-${stamp}.mp4`;
  await page.goto("/");
  await page.getByTestId("lobby-name").fill(`Избранное ${stamp}`);
  await page.getByTestId("lobby-sign-in").click();

  await createRoom(page, `Избранное один ${stamp}`);
  await openQueue(page);
  await page.getByTestId("queue-input").fill(url);
  await page.getByTestId("queue-add").click();
  await expect(page.locator(`[data-testid="queue-item"][data-url="${url}"]`)).toBeVisible();
  await page.getByTestId("queue-next").click();
  await expect(page.locator(`[data-testid="queue-history-item"][data-url="${url}"]`)).toBeVisible();

  await page.goto("/");
  await createRoom(page, `Избранное два ${stamp}`);
  await openQueue(page);
  await page.getByTestId("queue-input").fill(url);
  await page.getByTestId("queue-add").click();
  await expect(page.locator(`[data-testid="queue-item"][data-url="${url}"]`)).toBeVisible();
  await page.getByTestId("queue-next").click();
  await expect(page.locator(`[data-testid="queue-history-item"][data-url="${url}"]`)).toBeVisible();

  await page.goto("/profile");
  await page.getByRole("tab", { name: "История" }).click();
  const favourite = page.locator(`[data-testid="profile-favourite"][data-url="${url}"]`);
  await expect(favourite).toBeVisible();
  await expect(favourite).toHaveAttribute("data-watch-count", "2");
  await expect(favourite).toContainText("2");
});
