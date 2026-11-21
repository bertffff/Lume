import { expect, test } from "@playwright/test";
import { uniqueName } from "./helpers/identity";

test("room flow follows the measured width and the resize handle persists the ratio", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await page.getByTestId("lobby-name").fill(uniqueName("Аня"));
  await page.getByTestId("lobby-sign-in").click();
  await page.getByTestId("lobby-title").fill("Поток");
  await page.getByTestId("lobby-create").click();
  await expect(page.getByTestId("room-title")).toHaveText("Поток", { timeout: 20_000 });

  const body = page.locator(".body");
  await expect(body).toHaveAttribute("data-flow", "side");
  const frame = page.getByTestId("player-frame");
  const before = await frame.boundingBox();
  expect(before).not.toBeNull();

  const handle = page.getByRole("separator", { name: "Изменить размер панели" });
  await handle.focus();
  await handle.press("ArrowLeft");
  await handle.press("ArrowLeft");
  const after = await frame.boundingBox();
  expect(after).not.toBeNull();
  if (before && after) {
    expect(after.width).toBeLessThan(before.width);
  }

  const stored = await page.evaluate(() => JSON.parse(window.localStorage.getItem("telerave-room-layout-v1") ?? "{}"));
  expect(stored.horizontal.playerRatio).toBeLessThan(0.66);
  expect(stored.horizontal.preset).toBe("custom");

  const patch = page.waitForResponse((response) => new URL(response.url()).pathname.endsWith("/layout") && response.request().method() === "PATCH");
  await page.getByTestId("layout-vertical").click();
  expect((await patch).status()).toBe(200);
  await expect(body).toHaveAttribute("data-flow", "below");

  await page.setViewportSize({ width: 820, height: 900 });
  await expect(body).toHaveAttribute("data-flow", "stack");
  await expect(page.getByTestId("mobile-sheet-toggle")).toBeVisible();
});
