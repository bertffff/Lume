import { expect, test } from "@playwright/test";

test("a signed-in person sees the name search results", async ({ browser }) => {
  const stamp = Date.now().toString(36);
  const targetName = `Искомый${stamp}`;
  const targetContext = await browser.newContext();
  const callerContext = await browser.newContext();
  const target = await targetContext.newPage();
  const caller = await callerContext.newPage();

  await target.goto("/");
  await target.getByTestId("lobby-name").fill(targetName);
  await target.getByTestId("lobby-sign-in").click();
  await expect(target.getByTestId("lobby-title")).toBeVisible({ timeout: 20_000 });

  await caller.goto("/");
  await caller.getByTestId("lobby-name").fill(`Ищущий${stamp}`);
  await caller.getByTestId("lobby-sign-in").click();
  await caller.getByTestId("friend-search").fill(targetName);
  const found = caller.waitForResponse((response) => response.url().includes("/users/search") && response.request().method() === "GET");
  await caller.getByTestId("friend-search-go").click();
  expect((await found).status()).toBe(200);
  await expect(caller.getByTestId("friend-result")).toContainText(targetName);

  await targetContext.close();
  await callerContext.close();
});
