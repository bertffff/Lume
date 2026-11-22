import { expect, test } from "@playwright/test";
import { apiUrl } from "./helpers/config";

test("an email account signs in with its password and a wrong password is refused", async ({ page }) => {
  const stamp = Date.now().toString(36);
  const email = `login-${stamp}@example.com`;
  const password = `Pass${stamp}Ok1`;
  const registered = await page.request.post(`${apiUrl}/auth/register`, { data: { email, password, displayName: `Вход ${stamp}` } });
  expect(registered.status()).toBe(200);

  await page.goto("/auth");
  await page.getByTestId("lobby-name").fill(email);
  await page.getByLabel("Пароль").fill("Wrong9password");
  await page.getByTestId("lobby-sign-in").click();
  await expect(page.getByText("Не удалось войти: проверьте данные.")).toBeVisible();

  await page.getByLabel("Пароль").fill(password);
  const login = page.waitForResponse((response) => response.url().endsWith("/auth/login") && response.ok());
  await page.getByTestId("lobby-sign-in").click();
  await login;
  await expect(page.getByTestId("home-create-open")).toBeVisible();
});
