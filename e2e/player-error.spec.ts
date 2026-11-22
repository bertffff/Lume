import { expect, test } from "@playwright/test";
import { createRoom } from "./helpers/create-room";
import { apiUrl } from "./helpers/config";
import { uniqueName } from "./helpers/identity";
import { openQueue } from "./helpers/room-ui";

test("a failed live video shows retry, open, and replace", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("lobby-name").fill(uniqueName("Аня"));
  await page.getByTestId("lobby-sign-in").click();
  await createRoom(page, "Ошибка");
  await openQueue(page);

  await page.getByTestId("queue-input").fill(`${apiUrl}/health`);
  await page.getByTestId("queue-add").click();
  await expect(page.getByTestId("queue-item")).toHaveCount(1, { timeout: 15_000 });
  await page.getByTestId("queue-next").click();
  await expect(page.getByTestId("player-error")).toBeVisible({ timeout: 20_000 });

  const posted = page.waitForResponse((response) => response.url().includes("/recovery") && response.request().method() === "POST");
  await page.getByTestId("player-retry").click();
  const response = await posted;
  expect(response.status()).toBe(200);
  expect(response.request().postDataJSON()).toMatchObject({ action: "retry" });
});
