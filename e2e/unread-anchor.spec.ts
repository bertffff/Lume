import { expect, test } from "@playwright/test";

test("the live chat anchors the first unread message and jumps to it", async ({ browser }) => {
  const hostContext = await browser.newContext();
  const guestContext = await browser.newContext();
  const host = await hostContext.newPage();
  const guest = await guestContext.newPage();

  await host.goto("/");
  await host.getByTestId("lobby-name").fill("Аня");
  await host.getByTestId("lobby-sign-in").click();
  await host.getByTestId("lobby-title").fill("Непрочитанные");
  await host.getByTestId("lobby-create").click();
  await expect(host.getByTestId("room-title")).toHaveText("Непрочитанные", { timeout: 20_000 });
  const code = (await host.getByTestId("room-code").innerText()).trim();

  await guest.goto("/");
  await guest.getByTestId("lobby-name").fill("Марк");
  await guest.getByTestId("lobby-sign-in").click();
  await guest.getByTestId("lobby-code").fill(code);
  await guest.getByTestId("lobby-join").click();
  await expect(guest.getByTestId("room-title")).toHaveText("Непрочитанные", { timeout: 20_000 });

  await guest.getByTestId("chat-input").fill("первое непрочитанное");
  await guest.getByTestId("chat-send").click();
  await guest.getByTestId("chat-input").fill("второе непрочитанное");
  await guest.getByTestId("chat-send").click();

  const anchor = host.getByTestId("unread-anchor");
  await expect(anchor).toBeVisible({ timeout: 15_000 });
  await expect(host.getByTestId("unread-divider")).toBeVisible();
  await expect(host.getByTestId("chat-log")).toContainText("второе непрочитанное");

  const firstUnread = host.locator('[data-testid="chat-message"][data-unread="true"]').first();
  await expect(firstUnread).toContainText("первое непрочитанное");

  await anchor.click();
  await expect(host.getByTestId("unread-anchor")).toHaveCount(0);
  await expect(host.getByTestId("unread-divider")).toHaveCount(0);

  await hostContext.close();
  await guestContext.close();
});
