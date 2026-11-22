import { expect, test } from "@playwright/test";
import { createRoom } from "./helpers/create-room";
import { mockUrl } from "./helpers/config";
import { openQueue } from "./helpers/room-ui";

test("the live player streams a direct file through the allowlisted range proxy", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("lobby-name").fill("Прокси");
  await page.getByTestId("lobby-sign-in").click();
  await createRoom(page, "Прокси");
  await openQueue(page);

  const source = `${mockUrl}/stream.mp4`;
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
