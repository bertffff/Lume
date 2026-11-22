import { expect, test } from "@playwright/test";
import { createRoom } from "./helpers/create-room";
import { openPersonalSettings } from "./helpers/room-ui";

test("the live room reads hideOtherReactions back from the profile", async ({ page }) => {
  const stamp = Date.now().toString(36);
  await page.goto("/");
  await page.getByTestId("lobby-name").fill(`Аня ${stamp}`);
  await page.getByTestId("lobby-sign-in").click();
  await createRoom(page, `Реакции ${stamp}`);
  await openPersonalSettings(page);

  // The profile is shared between runs, so the switch can start in either state.
  const before = (await page.getByTestId("float-log").getAttribute("data-hide-other")) === "true";
  const saved = page.waitForResponse((response) => new URL(response.url()).pathname === "/me" && response.request().method() === "PATCH");
  await page.getByTestId("hide-other-reactions").click();
  const profile = await saved;
  expect(profile.status()).toBe(200);
  expect(profile.request().postDataJSON()).toMatchObject({ hideOtherReactions: !before });
  await expect(page.getByTestId("float-log")).toHaveAttribute("data-hide-other", String(!before));
});
