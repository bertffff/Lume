import { expect, test } from "@playwright/test";
import { createRoom } from "./helpers/create-room";
import { uniqueName } from "./helpers/identity";
import { openPersonalSettings } from "./helpers/room-ui";

test("room flow follows the measured width and the resize handle persists the ratio", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await page.getByTestId("lobby-name").fill(uniqueName("Аня"));
  await page.getByTestId("lobby-sign-in").click();
  await createRoom(page, "Поток");

  // The old `.body[data-flow]` attribute is gone; the workspace now expresses
  // layout through the player frame's preset/aspect and the dock breakpoint.
  const frame = page.getByTestId("player-frame");
  await expect(frame).toHaveAttribute("data-preset", "theater");
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

  // Aspect presets moved into the personal settings sheet.
  await openPersonalSettings(page);
  const patch = page.waitForResponse((response) => new URL(response.url()).pathname.endsWith("/layout") && response.request().method() === "PATCH");
  await page.getByTestId("layout-vertical").click();
  expect((await patch).status()).toBe(200);
  await expect(frame).toHaveAttribute("data-aspect", "vertical");

  await page.setViewportSize({ width: 820, height: 900 });
  await expect(page.getByTestId("session-dock")).toBeHidden();
  await expect(page.getByTestId("mobile-sheet-toggle")).toBeVisible();
});
