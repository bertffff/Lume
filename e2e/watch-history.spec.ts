import { expect, test } from "@playwright/test";

test("the live profile lists persisted watch history", async ({ page }) => {
  const stamp = Date.now().toString(36);
  await page.goto("/");
  await page.getByTestId("lobby-name").fill(`История ${stamp}`);
  await page.getByTestId("lobby-sign-in").click();
  await page.getByTestId("lobby-title").fill(`История ${stamp}`);
  await page.getByTestId("lobby-create").click();
  await expect(page.getByTestId("room-title")).toHaveText(`История ${stamp}`, { timeout: 20_000 });

  const url = `https://cdn.example.com/watch-history-${stamp}.mp4`;
  await page.getByTestId("queue-input").fill(url);
  await page.getByTestId("queue-add").click();
  await expect(page.locator(`[data-testid="queue-item"][data-url="${url}"]`)).toBeVisible();
  await page.getByTestId("queue-next").click();
  await expect(page.locator(`[data-testid="queue-history-item"][data-url="${url}"]`)).toBeVisible();

  await page.goto("/profile");
  const item = page.locator(`[data-testid="profile-history-item"][data-url="${url}"]`);
  await expect(item).toBeVisible();
  await expect(item).toHaveAttribute("data-watch-count", "1");
  await expect(page.getByTestId("profile-history")).toContainText("cdn.example.com");
});
