import { expect, test } from "@playwright/test";
import { createRoom } from "./helpers/create-room";
import { closeSheet, openHostSettings, openPersonalSettings } from "./helpers/room-ui";

test("the live session dock shows the persisted session and its controls work", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/");
  await page.getByTestId("lobby-name").fill("Док");
  await page.getByTestId("lobby-sign-in").click();
  await createRoom(page, "Док");

  const dock = page.getByTestId("session-dock");
  await expect(dock).toBeVisible();
  await expect(dock).toHaveAttribute("data-role", "host");
  await expect(dock.getByRole("tab", { name: /чат/i })).toHaveAttribute("aria-selected", "true");

  // The old dock-specific session clock no longer exists. Member and voice
  // counts now live in the header and the voice card respectively.
  await expect(page.getByRole("button", { name: "1 в комнате" })).toBeVisible();
  await expect(page.getByTestId("voice-card").locator("h2 small")).toHaveText("0");

  const reminded = page.waitForResponse((response) => response.url().includes("/reminders") && response.request().method() === "POST");
  await openPersonalSettings(page);
  await page.getByTestId("session-dock-remind").click();
  expect((await reminded).status()).toBe(200);
  await expect(page.getByTestId("session-dock-note")).toHaveText("Напоминание сохранено");
  await closeSheet(page, "room-personal-sheet");

  await openHostSettings(page);
  await closeSheet(page, "room-settings-sheet");

  await page.getByTestId("session-dock-invite").click();
  await expect(page.getByText("Ссылка скопирована")).toBeVisible();
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  expect(copied).toContain("/join/");

  await page.getByTestId("session-dock-leave").click();
  await expect(page.getByTestId("session-dock")).toHaveCount(0);
  await expect(page.locator('[data-testid="home-create-open"].tile')).toBeVisible();
});
