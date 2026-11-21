import { expect, test } from "@playwright/test";
import { createRoom } from "./helpers/create-room";
import { openQueue } from "./helpers/room-ui";

test.describe.configure({ mode: "serial" });

const apiUrl = process.env.API_URL ?? "http://127.0.0.1:3001";

test("privacy switches hide friends and history on the public profile", async ({ browser }) => {
  const stamp = Date.now().toString(36);
  const ownerName = `Приват ${stamp}`;
  const url = `https://cdn.example.com/private-${stamp}.mp4`;
  const ownerContext = await browser.newContext();
  const viewerContext = await browser.newContext();
  const owner = await ownerContext.newPage();
  const viewer = await viewerContext.newPage();

  await owner.goto("/");
  await owner.getByTestId("lobby-name").fill(ownerName);
  await owner.getByTestId("lobby-sign-in").click();
  await createRoom(owner, `Приват ${stamp}`);
  await openQueue(owner);
  await owner.getByTestId("queue-input").fill(url);
  await owner.getByTestId("queue-add").click();
  await expect(owner.locator(`[data-testid="queue-item"][data-url="${url}"]`)).toBeVisible();
  await owner.getByTestId("queue-next").click();
  await expect(owner.locator(`[data-testid="queue-history-item"][data-url="${url}"]`)).toBeVisible();

  const settingsLoaded = owner.waitForResponse((response) => new URL(response.url()).pathname === "/me" && response.request().method() === "GET");
  await owner.goto("/settings");
  await settingsLoaded;
  await expect(owner.getByTestId("privacy-friends")).toBeChecked();
  await expect(owner.getByTestId("privacy-history")).toBeChecked();

  const friendsOff = owner.waitForResponse((response) => new URL(response.url()).pathname === "/me" && response.request().method() === "PATCH");
  await owner.getByTestId("privacy-friends").uncheck();
  expect((await friendsOff).status()).toBe(200);
  const historyOff = owner.waitForResponse((response) => new URL(response.url()).pathname === "/me" && response.request().method() === "PATCH");
  await owner.getByTestId("privacy-history").uncheck();
  expect((await historyOff).status()).toBe(200);

  await viewer.goto("/");
  await viewer.getByTestId("lobby-name").fill(`Зритель ${stamp}`);
  await viewer.getByTestId("lobby-sign-in").click();
  await expect(viewer.locator('[data-testid="home-create-open"].tile')).toBeVisible({ timeout: 20_000 });
  await viewer.goto("/profile");
  await viewer.getByRole("tab", { name: "Друзья" }).click();
  await viewer.getByTestId("friend-search").fill(ownerName);
  const searched = viewer.waitForResponse((response) => response.url().includes("/users/search") && response.request().method() === "GET");
  await viewer.getByRole("button", { name: "Искать" }).click();
  expect((await searched).status()).toBe(200);
  const opened = viewer.waitForResponse((response) => response.url().includes("/users/profile/") && response.request().method() === "GET");
  await viewer.getByTestId("people-open-profile").first().click();
  expect((await opened).status()).toBe(200);

  await expect(viewer.getByTestId("public-profile-name")).toHaveText(ownerName);
  await expect(viewer.getByTestId("public-profile-history")).toContainText("Скрыто");
  await expect(viewer.getByTestId("public-profile-friends")).toContainText("Скрыто");
  await expect(viewer.locator(`[data-testid="public-profile-history-item"][data-url="${url}"]`)).toHaveCount(0);

  const historyOn = owner.waitForResponse((response) => new URL(response.url()).pathname === "/me" && response.request().method() === "PATCH");
  await owner.getByTestId("privacy-history").check();
  expect((await historyOn).status()).toBe(200);

  const reopened = viewer.waitForResponse((response) => response.url().includes("/users/profile/") && response.request().method() === "GET");
  await viewer.getByTestId("people-open-profile").first().click();
  expect((await reopened).status()).toBe(200);
  await expect(viewer.locator(`[data-testid="public-profile-history-item"][data-url="${url}"]`)).toBeVisible();
  await expect(viewer.getByTestId("public-profile-friends")).toContainText("Скрыто");

  const token = await owner.evaluate(() => {
    const raw = window.localStorage.getItem("lume.session");
    return raw ? (JSON.parse(raw) as { accessToken: string }).accessToken : "";
  });
  const profile = await owner.request.get(`${apiUrl}/me`, { headers: { authorization: `Bearer ${token}` } });
  expect(profile.status()).toBe(200);
  expect((await profile.json()) as { isFriendsPublic: boolean; isWatchHistoryPublic: boolean }).toMatchObject({
    isFriendsPublic: false,
    isWatchHistoryPublic: true,
  });

  await ownerContext.close();
  await viewerContext.close();
});
