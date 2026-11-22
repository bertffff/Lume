import { expect, test } from "@playwright/test";
import { openCreateWizard, submitCreateWizard } from "./helpers/create-room";
import { openChat, openQueue } from "./helpers/room-ui";

test("the create wizard applies the full moderation preset instead of only the title", async ({ browser }) => {
  test.setTimeout(90_000);
  const stamp = Date.now().toString(36);
  const ownerContext = await browser.newContext();
  const guestContext = await browser.newContext();
  const owner = await ownerContext.newPage();
  const guest = await guestContext.newPage();

  await owner.goto("/");
  await owner.getByTestId("lobby-name").fill(`Пресет ${stamp}`);
  await owner.getByTestId("lobby-sign-in").click();

  await openCreateWizard(owner);
  await expect(owner.getByTestId("create-presets")).toBeVisible();
  await owner.getByTestId("create-preset-closed").click();
  await expect(owner.getByTestId("lobby-title")).toHaveValue("Закрытый");
  await expect(owner.getByTestId("create-preset-summary")).toHaveAttribute("data-max", "6");
  await expect(owner.getByTestId("create-preset-summary")).toHaveAttribute("data-public", "false");

  const created = owner.waitForResponse((response) => new URL(response.url()).pathname === "/rooms" && response.request().method() === "POST");
  await submitCreateWizard(owner);
  expect((await created).request().postDataJSON()).toMatchObject({ preset: "closed" });
  await expect(owner.getByTestId("room-title")).toHaveText("Закрытый", { timeout: 20_000 });
  const code = (await owner.getByTestId("room-code").innerText()).trim();

  await owner.getByTestId("room-settings-open").click();
  await expect(owner.getByTestId("room-settings-sheet")).toBeVisible();
  await expect(owner.getByTestId("settings-max-members")).toHaveValue("6");
  await expect(owner.getByTestId("settings-public")).not.toBeChecked();
  await expect(owner.getByTestId("settings-hide-reactions")).not.toBeChecked();
  await expect(owner.getByTestId("settings-default-canChat")).toBeChecked();
  await expect(owner.getByTestId("settings-default-canSpeak")).not.toBeChecked();
  await expect(owner.getByTestId("settings-default-canQueue")).not.toBeChecked();
  await expect(owner.getByTestId("settings-default-canInvite")).not.toBeChecked();
  await owner.getByTestId("room-settings-close").click();

  await guest.goto("/");
  await guest.getByTestId("lobby-name").fill(`Гость пресета ${stamp}`);
  await guest.getByTestId("lobby-sign-in").click();
  await guest.getByTestId("lobby-code").fill(code);
  await guest.getByTestId("lobby-join").click();
  await expect(guest.getByTestId("room-title")).toHaveText("Закрытый", { timeout: 20_000 });
  await openQueue(guest);

  await guest.getByTestId("queue-input").fill("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
  await guest.getByTestId("queue-add").click();
  await guest.waitForTimeout(1200);
  await expect(owner.getByTestId("queue-item")).toHaveCount(0);

  await openChat(guest);
  await guest.getByTestId("chat-input").fill(`чат из пресета ${stamp}`);
  await guest.getByTestId("chat-send").click();
  await expect(owner.getByTestId("chat-log")).toContainText(`чат из пресета ${stamp}`, { timeout: 10_000 });

  await ownerContext.close();
  await guestContext.close();
});
