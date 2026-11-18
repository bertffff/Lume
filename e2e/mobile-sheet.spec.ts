import { expect, test } from "@playwright/test";

test("the mobile room sheet switches chat, members, and the live queue", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("lobby-name").fill("Аня");
  await page.getByTestId("lobby-sign-in").click();
  await page.getByTestId("lobby-title").fill("Мобильный зал");
  await page.getByTestId("lobby-create").click();
  await expect(page.getByTestId("room-title")).toHaveText("Мобильный зал", { timeout: 20_000 });

  await page.getByTestId("queue-input").fill("https://mobile-sheet.example.com/video.mp4");
  await page.getByTestId("queue-add").click();
  await expect(page.locator(".tr-queue li")).toHaveCount(1, { timeout: 15_000 });

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByTestId("mobile-sheet")).toBeVisible();

  await page.getByTestId("mobile-sheet-tab-queue").click();
  const panel = page.getByTestId("mobile-sheet-panel");
  await expect(panel).toHaveAttribute("data-panel", "queue");
  await expect(page.getByTestId("mobile-sheet-queue")).toContainText("mobile-sheet.example.com");

  await page.getByTestId("mobile-sheet-tab-chat").click();
  await expect(panel).toHaveAttribute("data-panel", "chat");

  await page.getByTestId("mobile-sheet-tab-members").click();
  await expect(panel).toHaveAttribute("data-panel", "members");
  await expect(page.getByTestId("mobile-sheet-members")).toContainText("Аня");

  await page.keyboard.press("Escape");
  await expect(page.getByTestId("mobile-sheet-panel")).toHaveCount(0);
  await expect(page.getByTestId("mobile-sheet")).toHaveAttribute("data-open", "false");

  await page.getByTestId("mobile-sheet-toggle").click();
  await expect(page.getByTestId("mobile-sheet-panel")).toHaveAttribute("data-panel", "members");
});
