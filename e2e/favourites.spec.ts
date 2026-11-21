import { expect, test } from "@playwright/test";

test("a second watch promotes the video into favourites on the live profile", async ({ page }) => {
  const stamp = Date.now().toString(36);
  const url = `https://cdn.example.com/favourite-${stamp}.mp4`;
  await page.goto("/");
  await page.getByTestId("lobby-name").fill(`Избранное ${stamp}`);
  await page.getByTestId("lobby-sign-in").click();

  await page.getByTestId("lobby-title").fill(`Избранное один ${stamp}`);
  await page.getByTestId("lobby-create").click();
  await expect(page.getByTestId("room-title")).toHaveText(`Избранное один ${stamp}`, { timeout: 20_000 });
  await page.getByTestId("queue-input").fill(url);
  await page.getByTestId("queue-add").click();
  await expect(page.locator(`[data-testid="queue-item"][data-url="${url}"]`)).toBeVisible();
  await page.getByTestId("queue-next").click();
  await expect(page.locator(`[data-testid="queue-history-item"][data-url="${url}"]`)).toBeVisible();

  await page.goto("/");
  await page.getByTestId("lobby-title").fill(`Избранное два ${stamp}`);
  await page.getByTestId("lobby-create").click();
  await expect(page.getByTestId("room-title")).toHaveText(`Избранное два ${stamp}`, { timeout: 20_000 });
  await page.getByTestId("queue-input").fill(url);
  await page.getByTestId("queue-add").click();
  await expect(page.locator(`[data-testid="queue-item"][data-url="${url}"]`)).toBeVisible();
  await page.getByTestId("queue-next").click();
  await expect(page.locator(`[data-testid="queue-history-item"][data-url="${url}"]`)).toBeVisible();

  await page.goto("/profile");
  const favourite = page.locator(`[data-testid="profile-favourite"][data-url="${url}"]`);
  await expect(favourite).toBeVisible();
  await expect(favourite).toHaveAttribute("data-watch-count", "2");
  await expect(favourite).toContainText("2");
});
