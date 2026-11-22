import { expect, test } from "@playwright/test";
import { createRoom } from "./helpers/create-room";
import { uniqueName } from "./helpers/identity";
import { openQueue } from "./helpers/room-ui";

test("the live queue shows the detected source for the signed-in user", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("lobby-name").fill(uniqueName("Аня"));
  await page.getByTestId("lobby-sign-in").click();
  await createRoom(page, "Детект");
  await openQueue(page);
  const detected = page.waitForResponse((response) => response.url().includes("/video/detect") && response.request().method() === "POST");
  await page.getByTestId("queue-input").fill("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
  await page.getByTestId("queue-add").click();
  const response = await detected;
  expect(response.status()).toBe(200);
  const payload = await response.json();
  expect(payload.source).toBe("youtube");
  expect(payload.plan.type).toBe("embed");
  // The queue now surfaces detection as a human-readable source label.
  await expect(page.getByTestId("queue-source")).toHaveText("YouTube");
});
