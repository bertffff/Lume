import { expect, test } from "@playwright/test";
import { join } from "node:path";
import { createRoom } from "./helpers/create-room";
import { uniqueName } from "./helpers/identity";
import { openQueue } from "./helpers/room-ui";

test("the mobile room dock switches chat, members, and the live queue", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("lobby-name").fill(uniqueName("Аня"));
  await page.getByTestId("lobby-sign-in").click();
  await createRoom(page, "Мобильный зал");
  await openQueue(page);

  await page.getByTestId("queue-input").fill("https://mobile-sheet.example.com/video.mp4");
  await page.getByTestId("queue-add").click();
  await expect(page.getByTestId("queue-item")).toHaveCount(1, { timeout: 15_000 });

  await page.setViewportSize({ width: 390, height: 844 });
  // On phones the dock is part of the page (the chat is readable at once), not a sheet behind a button.
  const dock = page.getByTestId("session-dock");
  await expect(dock).toBeVisible();
  await expect(page.getByTestId("mobile-sheet-toggle")).toBeHidden();
  expect((await dock.boundingBox())?.width).toBeGreaterThanOrEqual(360);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
  if (process.env.LUME_UX_SCREENSHOT_DIR) {
    await page.screenshot({ path: join(process.env.LUME_UX_SCREENSHOT_DIR, "cinema-390-mobile-dock.png"), animations: "disabled" });
  }

  await page.getByTestId("session-dock-queue").click();
  await expect(page.getByTestId("session-dock-queue")).toHaveAttribute("aria-selected", "true");
  await expect(page.getByTestId("rail-queue")).toContainText("mobile-sheet.example.com");

  await page.getByTestId("session-dock-chat").click();
  await expect(page.getByTestId("session-dock-chat")).toHaveAttribute("aria-selected", "true");
  await expect(page.getByTestId("chat-log")).toBeVisible();

  await page.getByTestId("session-dock-people").click();
  await expect(page.getByTestId("session-dock-people")).toHaveAttribute("aria-selected", "true");
  await expect(page.getByTestId("rail-people")).toContainText(uniqueName("Аня"));
  await expect(dock).toBeVisible();
});
