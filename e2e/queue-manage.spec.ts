import { expect, test } from "@playwright/test";
import { createRoom } from "./helpers/create-room";
import { uniqueName } from "./helpers/identity";
import { openQueue } from "./helpers/room-ui";

test("the host removes, reorders and plays queued videos", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("lobby-name").fill(uniqueName("Аня"));
  await page.getByTestId("lobby-sign-in").click();
  await createRoom(page, "Управление очередью");
  await openQueue(page);

  const urls = [1, 2, 3].map((n) => `https://queue-manage.example.com/video-${n}.mp4`);
  for (const [index, url] of urls.entries()) {
    await page.getByTestId("queue-input").fill(url);
    await page.getByTestId("queue-add").click();
    await expect(page.getByTestId("queue-item")).toHaveCount(index + 1, { timeout: 15_000 });
  }
  if (process.env.LUME_UX_SCREENSHOT_DIR) await page.screenshot({ path: `${process.env.LUME_UX_SCREENSHOT_DIR}/queue-manage.png`, animations: "disabled" });
  const order = () => page.getByTestId("queue-item").evaluateAll((rows) => rows.map((row) => row.getAttribute("data-url")));
  expect(await order()).toEqual(urls);

  await page.getByTestId("queue-item").first().getByTestId("queue-down").click();
  await expect.poll(order).toEqual([urls[1], urls[0], urls[2]]);

  await page.getByTestId("queue-item").nth(1).getByTestId("queue-remove").click();
  await expect.poll(order).toEqual([urls[1], urls[2]]);

  await page.getByTestId("queue-item").last().getByTestId("queue-play").click();
  await expect(page.getByTestId("queue-now")).toBeVisible();
  await expect.poll(order).toEqual([urls[1]]);
});
