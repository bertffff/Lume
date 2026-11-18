import { expect, test } from "@playwright/test";

test("the live room reads hideOtherReactions back from the profile", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("lobby-name").fill("Аня");
  await page.getByTestId("lobby-sign-in").click();
  await page.getByTestId("lobby-title").fill("Реакции");
  await page.getByTestId("lobby-create").click();
  await expect(page.getByTestId("room-title")).toHaveText("Реакции", { timeout: 20_000 });

  // The profile is shared between runs, so the switch can start in either state.
  const before = (await page.getByTestId("float-log").getAttribute("data-hide-other")) === "true";
  const saved = page.waitForResponse((response) => new URL(response.url()).pathname === "/me" && response.request().method() === "PATCH");
  await page.getByTestId("hide-other-reactions").click();
  const profile = await saved;
  expect(profile.status()).toBe(200);
  expect(profile.request().postDataJSON()).toMatchObject({ hideOtherReactions: !before });
  await expect(page.getByTestId("float-log")).toHaveAttribute("data-hide-other", String(!before));
});
