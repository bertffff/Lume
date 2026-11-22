import { expect, test } from "@playwright/test";
import { createRoom } from "./helpers/create-room";
import { openQueue } from "./helpers/room-ui";

test("the live queue shows resolved metadata and duration from the local metadata service", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("lobby-name").fill("Метаданные");
  await page.getByTestId("lobby-sign-in").click();
  await createRoom(page, "Метаданные");
  await openQueue(page);

  await page.getByTestId("queue-input").fill("https://www.youtube.com/watch?v=metadata-fixture");
  await page.getByTestId("queue-add").click();

  const item = page.getByTestId("queue-item").first();
  await expect(item).toContainText("Метаданные с сервера", { timeout: 20_000 });
  await expect(item.getByTestId("queue-item-duration")).toHaveText("12:34");
  await expect(page.locator("text=oembed")).toHaveCount(0);
});
