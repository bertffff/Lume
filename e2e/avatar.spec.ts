import { expect, test } from "@playwright/test";
import { uniqueName } from "./helpers/identity";

const pixel = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGNgYGD4DwABBAEAwS2OUAAAAABJRU5ErkJggg==", "base64");

test("a profile photo can be uploaded and removed", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("lobby-name").fill(uniqueName("Аня"));
  await Promise.all([
    page.waitForResponse((response) => response.url().endsWith("/auth/dev") && response.ok()),
    page.getByTestId("lobby-sign-in").click(),
  ]);
  await expect(page.getByTestId("home-create-open")).toBeVisible();
  const loaded = page.waitForResponse((response) => new URL(response.url()).pathname === "/me" && response.request().method() === "GET");
  await page.goto("/profile");
  await loaded;

  const saved = page.waitForResponse((response) => new URL(response.url()).pathname === "/me" && response.request().method() === "PATCH");
  await page.getByTestId("avatar-input").setInputFiles({ name: "me.png", mimeType: "image/png", buffer: pixel });
  expect((await saved).ok()).toBe(true);
  await expect(page.getByRole("img", { name: /./ }).locator("img").first()).toBeVisible();
  await expect(page.getByTestId("avatar-remove")).toBeVisible();

  const removed = page.waitForResponse((response) => new URL(response.url()).pathname === "/me" && response.request().method() === "PATCH");
  await page.getByTestId("avatar-remove").click();
  expect((await removed).ok()).toBe(true);
  await expect(page.getByTestId("avatar-remove")).toHaveCount(0);
});
