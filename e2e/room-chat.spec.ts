import { expect, test } from "@playwright/test";
import { uniqueName } from "./helpers/identity";

const pixel = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

test("chat follows new messages, previews attachments, and the narrow rail keeps controls", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await page.getByTestId("lobby-name").fill(uniqueName("Чат"));
  await page.getByTestId("lobby-sign-in").click();
  await page.getByTestId("lobby-title").fill(`Чат ${Date.now()}`);
  await page.getByTestId("lobby-create").click();
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
  const rail = page.locator('[data-testid="session-dock"][data-variant="rail"]');
  await expect(rail).toBeVisible();
  await expect(rail.getByRole("button", { name: "Позвать" })).toBeVisible();
  await expect(rail.getByRole("button", { name: "Настройки" })).toBeVisible();
  const deafen = page.getByTestId("voice-deafen");
  await expect(deafen).toHaveAttribute("aria-pressed", "false");
  await deafen.click();
  await expect(deafen).toHaveAttribute("aria-pressed", "true");

  const focusable = await rail.locator("button:visible").count();
  expect(focusable).toBeGreaterThanOrEqual(5);
});
