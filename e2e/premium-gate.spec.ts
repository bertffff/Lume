import { expect, test } from "@playwright/test";

test("a free account is gated before an extraction-only source reaches the live queue", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("lobby-name").fill("Гейт");
  await page.getByTestId("lobby-sign-in").click();
  await page.getByTestId("lobby-title").fill("Гейт");
  await page.getByTestId("lobby-create").click();
  await expect(page.getByTestId("room-title")).toHaveText("Гейт", { timeout: 20_000 });

  await page.getByTestId("queue-input").fill("https://www.tiktok.com/@lume/video/7300000000000000000");
  await expect(page.getByTestId("premium-gate")).toHaveText("Нужен Premium для этой платформы");
  await page.getByTestId("queue-add").click();
  await expect(page.getByTestId("premium-blocked")).toHaveText("Платформа доступна с Premium");
  await expect(page.locator('[data-testid="queue-item"]')).toHaveCount(0);

  const youtube = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";
  await page.getByTestId("queue-input").fill(youtube);
  await page.getByTestId("queue-add").click();
  await expect(page.locator(`[data-testid="queue-item"][data-url="${youtube}"]`)).toBeVisible();
  await expect(page.getByTestId("premium-blocked")).toHaveCount(0);
});
