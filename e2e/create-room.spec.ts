import { expect, test } from "@playwright/test";

test("the /create wizard opens a single form and creates a room", async ({ page }) => {
  const stamp = Date.now();
  await page.goto("/");
  await page.getByTestId("lobby-name").fill(`Мастер ${stamp}`);
  await page.getByTestId("lobby-sign-in").click();
  await expect(page.getByTestId("lobby-title")).toBeVisible({ timeout: 20_000 });

  await page.goto("/create");
  await expect(page.getByTestId("lobby-create")).toHaveCount(1);
  await page.getByTestId("lobby-title").fill(`Мастер ${stamp}`);

  const created = page.waitForResponse((response) => new URL(response.url()).pathname === "/rooms" && response.request().method() === "POST");
  await page.getByTestId("lobby-create").click();
  expect((await created).status()).toBe(200);
  await expect(page.getByTestId("room-title")).toHaveText(`Мастер ${stamp}`, { timeout: 20_000 });
});
