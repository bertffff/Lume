import { expect, test } from "@playwright/test";
import { uniqueName } from "./helpers/identity";

test("reporting a sync failure does not run when a video is queued", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("lobby-name").fill(uniqueName("Аня"));
  await page.getByTestId("lobby-sign-in").click();
  await page.getByTestId("lobby-title").fill("Синхрон");
  await page.getByTestId("lobby-create").click();
  await expect(page.getByTestId("room-title")).toHaveText("Синхрон", { timeout: 20_000 });

  let incidents = 0;
  page.on("request", (request) => {
    if (request.method() === "POST" && request.url().includes("/sync-incident")) incidents += 1;
  });
  await page.getByTestId("queue-input").fill("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
  await page.getByTestId("queue-add").click();
  await expect(page.locator(".tr-queue li")).toHaveCount(1, { timeout: 15_000 });
  expect(incidents).toBe(0);

  const posted = page.waitForResponse((response) => response.url().includes("/sync-incident") && response.request().method() === "POST");
  await page.getByTestId("sync-incident").click();
  const response = await posted;
  expect(response.status()).toBe(200);
  expect(response.request().postDataJSON()).toMatchObject({ note: "player drift" });
});
