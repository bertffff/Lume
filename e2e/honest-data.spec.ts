import { expect, test } from "@playwright/test";

test.describe.configure({ mode: "serial" });

test("a fresh account sees honest empty states instead of demo content", async ({ page }) => {
  const stockRequests: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("/dev-seed/")) stockRequests.push(request.url());
  });

  await page.goto("/");
  await page.getByTestId("lobby-name").fill(`Чистый ${Date.now()}`);
  await page.getByTestId("lobby-sign-in").click();

  await expect(page.locator(".tile.resume")).toContainText("Пока пусто");
  await expect(page.getByText("Друзья онлайн")).toBeVisible();
  await expect(page.getByText("Нет напоминаний.")).toBeVisible();
  await expect(page.getByText("Проведите первый сеанс — здесь появится карта сезона.")).toBeVisible();
  expect(stockRequests).toEqual([]);
});
