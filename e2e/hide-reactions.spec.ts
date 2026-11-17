import { expect, test } from "@playwright/test";

test("the live room reads hideOtherReactions back from the profile", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("lobby-name").fill("Аня");
  await page.getByTestId("lobby-sign-in").click();
  await page.getByTestId("lobby-title").fill("Реакции");
  await page.getByTestId("lobby-create").click();
  await expect(page.getByTestId("room-title")).toHaveText("Реакции", { timeout: 20_000 });
  const saved = page.waitForResponse((response) => new URL(response.url()).pathname === "/me" && response.request().method() === "GET");
  await page.getByTestId("hide-other-reactions").click();
  const profile = await saved;
  expect(profile.status()).toBe(200);
  expect((await profile.json()).hideOtherReactions).toBe(true);
  await expect(page.getByTestId("float-log")).toHaveAttribute("data-hide-other", "true");
});
