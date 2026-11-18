import { expect, test } from "@playwright/test";

test("the live queue shows played history and the host clears it", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("lobby-name").fill("История");
  await page.getByTestId("lobby-sign-in").click();
  await page.getByTestId("lobby-title").fill("История");
  await page.getByTestId("lobby-create").click();
  await expect(page.getByTestId("room-title")).toHaveText("История", { timeout: 20_000 });

  const url = `https://cdn.example.com/history-${Date.now()}.mp4`;
  await page.getByTestId("queue-input").fill(url);
  await page.getByTestId("queue-add").click();
  await expect(page.locator(`[data-testid="queue-item"][data-url="${url}"]`)).toBeVisible();
  await page.getByTestId("queue-next").click();

  await expect(page.locator(`[data-testid="queue-history-item"][data-url="${url}"]`)).toBeVisible();
  await expect(page.getByTestId("queue-history-count")).toHaveText("1");

  const cleared = page.waitForResponse((response) => response.url().includes("/history") && response.request().method() === "DELETE");
  await page.getByTestId("history-clear").click();
  expect((await cleared).status()).toBe(200);
  await expect(page.getByTestId("queue-history-count")).toHaveText("0");
  await expect(page.getByTestId("queue-history-item")).toHaveCount(0);
  await expect(page.getByTestId("queue-history")).toContainText("История пуста");
});
