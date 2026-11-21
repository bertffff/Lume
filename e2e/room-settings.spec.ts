import { expect, test } from "@playwright/test";
import { uniqueName } from "./helpers/identity";

test("the live room settings sheet saves description, cap, visibility, and hide-reactions", async ({ page, browser }) => {
  await page.goto("/");
  await page.getByTestId("lobby-name").fill(uniqueName("Аня"));
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
  await page.getByTestId("settings-default-canChat").uncheck();
  await page.getByTestId("room-settings-save").click();
  const response = await saved;
  expect(response.status()).toBe(200);
  expect(response.request().postDataJSON()).toMatchObject({
    title: "Ночной зал",
    description: "Смотрим вместе",
    isPublic: true,
    maxMembers: 4,
    hideReactions: true,
    defaults: { canSeek: true, canChat: false },
  });

  await expect(page.getByTestId("room-settings-sheet")).toHaveCount(0);
  await expect(page.getByTestId("room-title")).toHaveText("Ночной зал");
  await expect(page.getByTestId("float-log")).toHaveAttribute("data-room-hide-reactions", "true");

  await page.getByTestId("room-settings-open").click();
  await expect(page.getByTestId("settings-description")).toHaveValue("Смотрим вместе");
  await expect(page.getByTestId("settings-max-members")).toHaveValue("4");
  await expect(page.getByTestId("settings-hide-reactions")).toBeChecked();
  await expect(page.getByTestId("settings-default-canSeek")).toBeChecked();
  await expect(page.getByTestId("settings-default-canChat")).not.toBeChecked();
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("room-settings-sheet")).toHaveCount(0);

  // A viewer joining after the save inherits the defaults: queueing works, chat is refused.
  const code = (await page.getByTestId("room-code").innerText()).trim();
  const guestContext = await browser.newContext();
  const guest = await guestContext.newPage();
  await guest.goto("/");
  await guest.getByTestId("lobby-name").fill(uniqueName("Марк"));
  await guest.getByTestId("lobby-sign-in").click();
  await guest.getByTestId("lobby-code").fill(code);
  await guest.getByTestId("lobby-join").click();
  await expect(guest.getByTestId("room-title")).toHaveText("Ночной зал", { timeout: 20_000 });

  await guest.getByTestId("queue-input").fill("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
  await guest.getByTestId("queue-add").click();
  await expect(page.locator(".tr-queue li")).toHaveCount(1, { timeout: 15_000 });

  await guest.getByTestId("chat-input").fill("привет из чата");
  await guest.getByTestId("chat-send").click();
  await page.waitForTimeout(1500);
  await expect(page.getByTestId("chat-log")).not.toContainText("привет из чата");
  await guestContext.close();
});
