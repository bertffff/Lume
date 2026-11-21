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

test("a /join/:code link opens the invited room and non-admins never see the admin screen", async ({ page }) => {
  const stamp = Date.now();
  await page.goto("/");
  await page.getByTestId("lobby-name").fill(`Ссылка ${stamp}`);
  await page.getByTestId("lobby-sign-in").click();
  await page.getByTestId("lobby-title").fill(`Ссылка ${stamp}`);
  await page.getByTestId("lobby-create").click();
  await expect(page.getByTestId("room-title")).toHaveText(`Ссылка ${stamp}`, { timeout: 20_000 });
  const code = (await page.getByTestId("room-code").innerText()).trim();

  await page.goto(`/join/${encodeURIComponent(code)}`);
  await expect(page.getByTestId("room-title")).toHaveText(`Ссылка ${stamp}`, { timeout: 20_000 });

  await page.goto("/admin");
  await expect(page.locator(".design-app")).toBeVisible();
  await expect(page.getByTestId("admin-screen")).toHaveCount(0);
});
