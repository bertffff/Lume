import { expect, test } from "@playwright/test";
import { uniqueName } from "./helpers/identity";

test("Telegram notification preferences persist across reloads", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("lobby-name").fill(uniqueName("Аня"));
  await Promise.all([
    page.waitForResponse((response) => response.url().endsWith("/auth/dev") && response.ok()),
    page.getByTestId("lobby-sign-in").click(),
  ]);
  await expect(page.getByTestId("home-create-open")).toBeVisible();
  const isPrefs = (method: string) => (response: import("@playwright/test").Response) => response.url().endsWith("/me/notification-preferences") && response.request().method() === method;
  const loaded = page.waitForResponse(isPrefs("GET"));
  await page.goto("/settings");
  await loaded;

  const invite = page.getByTestId("notif-ROOM_INVITE");
  await expect(invite).toBeChecked();
  const saved = page.waitForResponse(isPrefs("PUT"));
  await invite.uncheck();
  expect((await saved).ok()).toBe(true);
  const digestSaved = page.waitForResponse(isPrefs("PUT"));
  await page.getByTestId("notif-digest").selectOption("DAILY");
  expect((await digestSaved).ok()).toBe(true);

  const reloaded = page.waitForResponse(isPrefs("GET"));
  await page.reload();
  await reloaded;
  await expect(page.getByTestId("notif-ROOM_INVITE")).not.toBeChecked();
  await expect(page.getByTestId("notif-FRIEND_REQUEST")).toBeChecked();
  await expect(page.getByTestId("notif-digest")).toHaveValue("DAILY");
});
