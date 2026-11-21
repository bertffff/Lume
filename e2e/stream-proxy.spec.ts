import { expect, test } from "@playwright/test";

test("the live player streams a direct file through the allowlisted range proxy", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("lobby-name").fill("Прокси");
  await page.getByTestId("lobby-sign-in").click();
  await page.getByTestId("lobby-title").fill("Прокси");
  await page.getByTestId("lobby-create").click();
  await expect(page.getByTestId("room-title")).toHaveText("Прокси", { timeout: 20_000 });

  const source = "http://127.0.0.1:3099/stream.mp4";
  const streamed = page.waitForResponse((response) => response.url().includes("/video/range?url=") && response.url().includes(encodeURIComponent(source)), { timeout: 20_000 });
  await page.getByTestId("queue-input").fill(source);
  await page.getByTestId("queue-add").click();
  await expect(page.locator(`[data-testid="queue-item"][data-url="${source}"]`)).toBeVisible();
  await page.getByTestId("queue-next").click();

  const response = await streamed;
  expect(response.status()).toBe(206);
  expect(response.headers()["content-range"]).toMatch(/^bytes \d+-\d+\/18$/);
  expect(response.headers()["accept-ranges"]).toBe("bytes");
});
