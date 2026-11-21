import { expect, test } from "@playwright/test";
import { createRoom } from "./helpers/create-room";
import { uniqueName } from "./helpers/identity";
import { openPersonalSettings } from "./helpers/room-ui";

test("layout presets and aspect change the live player frame and persist per aspect", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("lobby-name").fill(uniqueName("Аня"));
  await page.getByTestId("lobby-sign-in").click();
  await createRoom(page, "Кадр");
  await openPersonalSettings(page);

  const frame = page.getByTestId("player-frame");
  await expect(frame).toHaveAttribute("data-preset", "theater");

  const enlarged = page.waitForResponse((response) => new URL(response.url()).pathname.endsWith("/layout") && response.request().method() === "PATCH");
  await page.getByTestId("layout-enlarged").click();
  const enlargedResponse = await enlarged;
  expect(enlargedResponse.status()).toBe(200);
  expect(enlargedResponse.request().postDataJSON()).toMatchObject({ preset: "enlarged" });
  await expect(frame).toHaveAttribute("data-preset", "enlarged");
  const wide = await frame.boundingBox();
  expect(wide).not.toBeNull();
  if (wide) expect(wide.width / wide.height).toBeGreaterThan(1.5);

  const vertical = page.waitForResponse((response) => new URL(response.url()).pathname.endsWith("/layout") && response.request().method() === "PATCH");
  await page.getByTestId("layout-vertical").click();
  const verticalResponse = await vertical;
  expect(verticalResponse.status()).toBe(200);
  const verticalBody = verticalResponse.request().postDataJSON();
  expect(verticalBody.videoAspect).toBeCloseTo(9 / 16);
  await expect(frame).toHaveAttribute("data-aspect", "vertical");
  const tall = await frame.boundingBox();
  expect(tall).not.toBeNull();
  if (tall) expect(tall.width / tall.height).toBeLessThan(0.7);

  const immersive = page.waitForResponse((response) => new URL(response.url()).pathname.endsWith("/layout") && response.request().method() === "PATCH");
  await page.getByTestId("layout-immersive").click();
  expect((await immersive).status()).toBe(200);
  await expect(frame).toHaveAttribute("data-preset", "immersive");

  const stored = await page.evaluate(() => JSON.parse(window.localStorage.getItem("telerave-room-layout-v1") ?? "{}"));
  expect(stored.horizontal.preset).toBe("enlarged");
  expect(stored.vertical.preset).toBe("immersive");
  expect(stored.vertical.videoAspect).toBeCloseTo(9 / 16);
});
