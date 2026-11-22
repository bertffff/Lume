import { expect, test } from "@playwright/test";
import { createRoom } from "./helpers/create-room";
import { openPeople } from "./helpers/room-ui";

const apiUrl = process.env.API_URL ?? "http://127.0.0.1:3001";

test("voice mute is broadcast and every participant sees the same session clock", async ({ browser }) => {
  test.setTimeout(90_000);
  const stamp = Date.now().toString(36);
  const ownerContext = await browser.newContext();
  const guestContext = await browser.newContext();
  const owner = await ownerContext.newPage();
  const guest = await guestContext.newPage();

  await owner.goto("/");
  await owner.getByTestId("lobby-name").fill(`Голос ${stamp}`);
  await owner.getByTestId("lobby-sign-in").click();
  await createRoom(owner, `Голос ${stamp}`);
  const code = (await owner.getByTestId("room-code").innerText()).trim();

  await guest.goto("/");
  await guest.getByTestId("lobby-name").fill(`Слушатель ${stamp}`);
  await guest.getByTestId("lobby-sign-in").click();
  await guest.getByTestId("lobby-code").fill(code);
  await guest.getByTestId("lobby-join").click();
  await expect(guest.getByTestId("room-title")).toHaveText(`Голос ${stamp}`, { timeout: 20_000 });

  const ownerSession = await owner.evaluate(() => JSON.parse(window.localStorage.getItem("lume.session") ?? "null") as { accessToken: string; user: { id: string } } | null);
  const guestSession = await guest.evaluate(() => JSON.parse(window.localStorage.getItem("lume.session") ?? "null") as { accessToken: string; user: { id: string } } | null);
  expect(ownerSession?.accessToken).toBeTruthy();
  expect(guestSession?.accessToken).toBeTruthy();

  await owner.getByTestId("voice-join").click();
  await expect(owner.getByTestId("voice-session")).toBeVisible();
  await openPeople(owner);
  await openPeople(guest);
  await expect(guest.getByTestId(`member-${ownerSession?.user.id}`)).toHaveAttribute("data-in-voice", "true", { timeout: 10_000 });

  await guest.getByTestId("voice-join").click();
  await expect(owner.getByTestId(`member-${guestSession?.user.id}`)).toHaveAttribute("data-in-voice", "true", { timeout: 10_000 });
  await expect.poll(async () => Number(await owner.getByTestId("voice-session").getAttribute("data-seconds")), { timeout: 15_000 }).toBeGreaterThanOrEqual(2);

  const ownerClock = Number(await owner.getByTestId("voice-session").getAttribute("data-seconds"));
  const guestClock = Number(await guest.getByTestId("voice-session").getAttribute("data-seconds"));
  expect(guestClock).toBeGreaterThanOrEqual(1);
  expect(Math.abs(ownerClock - guestClock)).toBeLessThanOrEqual(1);
  expect(await guest.getByTestId("voice-session").getAttribute("data-start")).toBe(await owner.getByTestId("voice-session").getAttribute("data-start"));

  await owner.getByTestId("voice-toggle").click();
  await expect(guest.getByTestId(`member-${ownerSession?.user.id}`)).toHaveAttribute("data-muted", "true", { timeout: 10_000 });
  await expect(guest.getByTestId(`member-muted-${ownerSession?.user.id}`)).toBeVisible();

  const flush = owner.waitForResponse((response) => new URL(response.url()).pathname === "/me/voice-seconds" && response.request().method() === "POST");
  await owner.getByTestId("voice-leave").click();
  expect((await flush).status()).toBe(200);

  const engagement = await owner.request.get(`${apiUrl}/users/${ownerSession?.user.id}/engagement`, {
    headers: { authorization: `Bearer ${ownerSession?.accessToken ?? ""}` },
  });
  expect(engagement.status()).toBe(200);
  expect((await engagement.json()).voiceSeconds).toBeGreaterThanOrEqual(2);

  await ownerContext.close();
  await guestContext.close();
});
