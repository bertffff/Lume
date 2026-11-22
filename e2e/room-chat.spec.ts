import { expect, test } from "@playwright/test";
import { createRoom } from "./helpers/create-room";
import { uniqueName } from "./helpers/identity";
import { openChat } from "./helpers/room-ui";

const pixel = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

test("chat follows new messages, previews attachments, and the narrow dock keeps controls", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await page.getByTestId("lobby-name").fill(uniqueName("Чат"));
  await page.getByTestId("lobby-sign-in").click();
  await createRoom(page, `Чат ${Date.now()}`);
  await expect(page.getByTestId("room-title")).toBeVisible({ timeout: 20_000 });

  const log = page.getByTestId("chat-log");
  await expect(log).toBeVisible();
  for (let index = 0; index < 30; index += 1) {
    await page.getByTestId("chat-input").fill(`сообщение ${index}`);
    await page.getByTestId("chat-input").press("Enter");
  }
  await expect(page.locator('[data-testid="chat-message"]')).toHaveCount(30, { timeout: 20_000 });

  await log.evaluate((element) => {
    element.scrollTop = 0;
    element.dispatchEvent(new Event("scroll"));
  });
  await page.getByTestId("chat-input").fill("пока читаю выше");
  await page.getByTestId("chat-input").press("Enter");
  const jump = page.getByTestId("chat-new");
  await expect(jump).toBeVisible();
  await jump.click();
  await expect
    .poll(async () => log.evaluate((element) => element.scrollHeight - element.scrollTop - element.clientHeight))
    .toBeLessThan(60);

  const uploadResponse = page.waitForResponse((response) => response.url().includes("/uploads") && response.request().method() === "POST");
  await page.getByTestId("chat-attach").setInputFiles({ name: "pixel.png", mimeType: "image/png", buffer: pixel });
  const uploaded = await uploadResponse;
  expect(uploaded.status()).toBe(200);
  await expect(page.getByTestId("room-error")).toHaveCount(0);
  const preview = page.locator(".chat-attach").last();
  await expect(preview).toBeVisible({ timeout: 15_000 });
  await expect(preview).toHaveAttribute("src", /\/uploads\//);

  await page.setViewportSize({ width: 390, height: 844 });
  // On phones the dock is inline; the invite and settings controls stay in reach.
  await expect(page.getByTestId("mobile-sheet-toggle")).toBeHidden();
  await expect(page.getByTestId("session-dock-invite")).toBeVisible();
  await expect(page.getByTestId("room-personal-settings")).toBeVisible();

  await openChat(page);
  const dock = page.getByTestId("session-dock");
  await expect(dock).toBeVisible();
  await expect(dock.getByTestId("chat-log")).toBeVisible();
  const focusable = await dock.locator("button:visible").count();
  expect(focusable).toBeGreaterThanOrEqual(5);

  // Deafen now lives in the voice card and appears only after joining.
  await page.getByTestId("voice-join").click();
  const deafen = page.getByTestId("voice-deafen");
  await expect(deafen).toHaveAttribute("aria-label", "Без звука");
  await deafen.click();
  await expect(deafen).toHaveAttribute("aria-label", "Вернуть звук");
});
