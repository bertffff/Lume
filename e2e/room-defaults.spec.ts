import { expect, test } from "@playwright/test";
import { createRoom } from "./helpers/create-room";
import { uniqueName } from "./helpers/identity";
import { openHostSettings } from "./helpers/room-ui";

test("the host saves all six viewer permissions from the live room", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("lobby-name").fill(uniqueName("Аня"));
  await page.getByTestId("lobby-sign-in").click();
  await createRoom(page, "Права");
  // The dedicated permissions panel was folded into the host settings sheet;
  // the same six defaults are saved as part of PATCH /rooms/:id/settings.
  await openHostSettings(page);
  await expect(page.getByTestId("settings-title")).toHaveValue("Права");
  await page.getByTestId("settings-default-canSeek").check();
  const saved = page.waitForResponse((response) => new URL(response.url()).pathname.endsWith("/settings") && response.request().method() === "PATCH");
  await page.getByTestId("room-settings-save").click();
  const response = await saved;
  expect(response.status()).toBe(200);
  const body = response.request().postDataJSON() as { defaults: Record<string, boolean> };
  expect(Object.keys(body.defaults).sort()).toEqual(["canChat", "canInvite", "canQueue", "canReact", "canSeek", "canSpeak"]);
  expect(body.defaults.canSeek).toBe(true);
  expect(await response.json()).toMatchObject({ defaults: body.defaults });
});
