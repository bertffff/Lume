import { expect, test } from "@playwright/test";
import { createRoom } from "./helpers/create-room";
import { uniqueName } from "./helpers/identity";
import { openPersonalSettings, openQueue } from "./helpers/room-ui";

test("reporting a sync failure does not run when a video is queued", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("lobby-name").fill(uniqueName("Аня"));
  await page.getByTestId("lobby-sign-in").click();
  await createRoom(page, "Синхрон");
  await openQueue(page);

  let incidents = 0;
  page.on("request", (request) => {
    if (request.method() === "POST" && request.url().includes("/sync-incident")) incidents += 1;
  });
  await page.getByTestId("queue-input").fill("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
  await page.getByTestId("queue-add").click();
  await expect(page.getByTestId("queue-item")).toHaveCount(1, { timeout: 15_000 });
  expect(incidents).toBe(0);

  // The incident control now lives in the personal sheet and only renders
  // while a video is actually playing.
  await page.getByTestId("queue-next").click();
  await expect(page.getByTestId("queue-now")).toBeVisible();
  await openPersonalSettings(page);

  const posted = page.waitForResponse((response) => response.url().includes("/sync-incident") && response.request().method() === "POST");
  await page.getByTestId("sync-incident").click();
  const response = await posted;
  expect(response.status()).toBe(200);
  expect(response.request().postDataJSON()).toMatchObject({ note: "player drift" });
});
