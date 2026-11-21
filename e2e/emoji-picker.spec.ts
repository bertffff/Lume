import { expect, test } from "@playwright/test";
import { createRoom } from "./helpers/create-room";

const apiUrl = process.env.API_URL ?? "http://127.0.0.1:3001";

test("the live composer emoji picker has category tabs, search, and persisted recents", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("lobby-name").fill("Эмодзи");
  await page.getByTestId("lobby-sign-in").click();
  await createRoom(page, "Эмодзи");

  await page.getByTestId("emoji-picker-toggle").click();
  await expect(page.getByTestId("emoji-picker")).toBeVisible();
  await expect(page.locator('[data-testid^="emoji-tab-"]')).toHaveCount(7);

  await page.getByTestId("emoji-tab-faces").click();
  const firstEmoji = await page.getByTestId("emoji-option").first().innerText();
  const savedFirst = page.waitForResponse((response) => response.url().endsWith("/me/recent-emojis") && response.request().method() === "POST");
  await page.getByTestId("emoji-option").first().click();
  expect((await savedFirst).status()).toBe(200);
  await expect(page.getByTestId("chat-input")).toHaveValue(firstEmoji);

  await page.getByTestId("emoji-tab-recent").click();
  await expect(page.getByTestId("emoji-option").filter({ hasText: firstEmoji })).toBeVisible();

  await page.getByTestId("emoji-search").fill("огон");
  await expect(page.getByTestId("emoji-option")).toHaveCount(1);
  await expect(page.getByTestId("emoji-option")).toHaveText("🔥");
  const savedFire = page.waitForResponse((response) => response.url().endsWith("/me/recent-emojis") && response.request().method() === "POST");
  await page.getByTestId("emoji-option").click();
  expect((await savedFire).status()).toBe(200);
  await expect(page.getByTestId("chat-input")).toHaveValue(`${firstEmoji}🔥`);

  const token = await page.evaluate(() => {
    const raw = window.localStorage.getItem("lume.session");
    return raw ? (JSON.parse(raw) as { accessToken: string }).accessToken : "";
  });
  const profile = await page.request.get(`${apiUrl}/me`, { headers: { authorization: `Bearer ${token}` } });
  expect(profile.status()).toBe(200);
  const body = (await profile.json()) as { recentEmojis: string[] };
  expect(body.recentEmojis[0]).toBe("🔥");
  expect(body.recentEmojis[1]).toBe(firstEmoji);
});
