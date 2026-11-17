import { expect, test } from "@playwright/test";

test("the live queue shows the detected source for the signed-in user", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("lobby-name").fill("Аня");
  await page.getByTestId("lobby-sign-in").click();
  await page.getByTestId("lobby-title").fill("Детект");
  await page.getByTestId("lobby-create").click();
  await expect(page.getByTestId("room-title")).toHaveText("Детект", { timeout: 20_000 });
  const detected = page.waitForResponse((response) => response.url().includes("/video/detect") && response.request().method() === "POST");
  await page.getByTestId("queue-input").fill("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
  await page.getByTestId("queue-add").click();
  const response = await detected;
  expect(response.status()).toBe(200);
  const payload = await response.json();
  expect(payload.source).toBe("youtube");
  expect(payload.plan.type).toBe("embed");
  await expect(page.getByText("youtube:embed")).toBeVisible();
});
