import { expect, test } from "@playwright/test";

test("the host saves all six viewer permissions from the live room", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("lobby-name").fill("Аня");
  await page.getByTestId("lobby-sign-in").click();
  await page.getByTestId("lobby-title").fill("Права");
  await page.getByTestId("lobby-create").click();
  await expect(page.getByTestId("room-title")).toHaveText("Права", { timeout: 20_000 });
  await page.getByTestId("perm-canSeek").check();
  const posted = page.waitForResponse((response) => response.url().includes("/defaults") && response.request().method() === "POST");
  await page.getByTestId("perm-save").click();
  const response = await posted;
  expect(response.status()).toBe(200);
  const body = response.request().postDataJSON() as Record<string, boolean>;
  expect(Object.keys(body).sort()).toEqual(["canChat", "canInvite", "canQueue", "canReact", "canSeek", "canSpeak"]);
  expect(body.canSeek).toBe(true);
  expect(await response.json()).toMatchObject({ defaults: body });
});
