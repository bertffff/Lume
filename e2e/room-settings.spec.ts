import { expect, test } from "@playwright/test";

test("the live room settings sheet saves description, cap, visibility, and hide-reactions", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("lobby-name").fill("Аня");
  await page.getByTestId("lobby-sign-in").click();
  await page.getByTestId("lobby-title").fill("Настройки");
  await page.getByTestId("lobby-create").click();
  await expect(page.getByTestId("room-title")).toHaveText("Настройки", { timeout: 20_000 });

  await page.getByTestId("room-settings-open").click();
  await expect(page.getByTestId("room-settings-sheet")).toBeVisible();
  await expect(page.getByTestId("settings-title")).toHaveValue("Настройки");

  const saved = page.waitForResponse((response) => new URL(response.url()).pathname.endsWith("/settings") && response.request().method() === "PATCH");
  await page.getByTestId("settings-title").fill("Ночной зал");
  await page.getByTestId("settings-description").fill("Смотрим вместе");
  await page.getByTestId("settings-public").check();
  await page.getByTestId("settings-max-members").fill("4");
  await page.getByTestId("settings-hide-reactions").check();
  await page.getByTestId("settings-default-canSeek").check();
  await page.getByTestId("room-settings-save").click();
  const response = await saved;
  expect(response.status()).toBe(200);
  expect(response.request().postDataJSON()).toMatchObject({
    title: "Ночной зал",
    description: "Смотрим вместе",
    isPublic: true,
    maxMembers: 4,
    hideReactions: true,
    defaults: { canSeek: true },
  });

  await expect(page.getByTestId("room-settings-sheet")).toHaveCount(0);
  await expect(page.getByTestId("room-title")).toHaveText("Ночной зал");
  await expect(page.getByTestId("float-log")).toHaveAttribute("data-room-hide-reactions", "true");

  await page.getByTestId("room-settings-open").click();
  await expect(page.getByTestId("settings-description")).toHaveValue("Смотрим вместе");
  await expect(page.getByTestId("settings-max-members")).toHaveValue("4");
  await expect(page.getByTestId("settings-hide-reactions")).toBeChecked();
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("room-settings-sheet")).toHaveCount(0);
});
