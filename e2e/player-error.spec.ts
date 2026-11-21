import { expect, test } from "@playwright/test";
import { uniqueName } from "./helpers/identity";

test("a failed live video shows retry, open, and replace", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("lobby-name").fill(uniqueName("Аня"));
  await page.getByTestId("lobby-sign-in").click();
  await page.getByTestId("lobby-title").fill("Ошибка");
  await page.getByTestId("lobby-create").click();
  await expect(page.getByTestId("room-title")).toHaveText("Ошибка", { timeout: 20_000 });

  await page.getByTestId("queue-input").fill("http://127.0.0.1:3001/health");
  await page.getByTestId("queue-add").click();
  await expect(page.locator(".queue-list li")).toHaveCount(1, { timeout: 15_000 });
  await page.getByTestId("queue-next").click();
  await expect(page.getByTestId("player-error")).toBeVisible({ timeout: 20_000 });

  const posted = page.waitForResponse((response) => response.url().includes("/recovery") && response.request().method() === "POST");
  await page.getByTestId("player-retry").click();
  const response = await posted;
  expect(response.status()).toBe(200);
  expect(response.request().postDataJSON()).toMatchObject({ action: "retry" });
});
