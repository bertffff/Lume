import { expect, test } from "@playwright/test";

test("the live session dock shows the persisted session and its controls work", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/");
  await page.getByTestId("lobby-name").fill("Док");
  await page.getByTestId("lobby-sign-in").click();
  await page.getByTestId("lobby-title").fill("Док");
  await page.getByTestId("lobby-create").click();
  await expect(page.getByTestId("room-title")).toHaveText("Док", { timeout: 20_000 });

  const dock = page.getByTestId("session-dock");
  await expect(dock).toBeVisible();
  await expect(dock).toHaveAttribute("data-role", "host");
  await expect(page.getByTestId("session-dock-time")).toHaveText(/^\d{2}:\d{2}$/);
  const startedAt = await page.getByTestId("session-dock-time").innerText();
  await page.waitForTimeout(1200);
  await expect(page.getByTestId("session-dock-time")).not.toHaveText(startedAt);
  await expect(page.getByTestId("session-dock-members")).toHaveText("1 в комнате");
  await expect(page.getByTestId("session-dock-voice")).toHaveText("0 в голосе");

  const reminded = page.waitForResponse((response) => response.url().includes("/reminders") && response.request().method() === "POST");
  await page.getByTestId("session-dock-remind").click();
  expect((await reminded).status()).toBe(200);
  await expect(page.getByTestId("session-dock-note")).toHaveText("Напоминание сохранено");

  await page.getByTestId("session-dock-settings").click();
  await expect(page.getByTestId("room-settings-sheet")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("room-settings-sheet")).toHaveCount(0);

  await page.getByTestId("session-dock-invite").click();
  await expect(page.getByTestId("session-dock-note")).toHaveText("Ссылка скопирована");
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  expect(copied).toContain("/join/");

  await page.getByTestId("session-dock-leave").click();
  await expect(page.getByTestId("session-dock")).toHaveCount(0);
  await expect(page.getByTestId("lobby-create")).toBeVisible();
});
