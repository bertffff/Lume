import { expect, test } from "@playwright/test";
import { createRoom } from "./helpers/create-room";
import { openMemberProfile } from "./helpers/room-ui";

test.describe.configure({ mode: "serial" });

const apiUrl = process.env.API_URL ?? "http://127.0.0.1:3001";

test("a host manages the global blacklist from the live profile and settings screens", async ({ browser }) => {
  test.setTimeout(90_000);
  const stamp = Date.now().toString(36);
  const guestName = `Бан ${stamp}`;
  const hostContext = await browser.newContext();
  const guestContext = await browser.newContext();
  const host = await hostContext.newPage();
  const guest = await guestContext.newPage();

  await host.goto("/");
  await host.getByTestId("lobby-name").fill(`Хозяин ${stamp}`);
  await host.getByTestId("lobby-sign-in").click();
  await createRoom(host, `Чёрный список ${stamp}`);
  const code = (await host.getByTestId("room-code").innerText()).trim();

  await guest.goto("/");
  await guest.getByTestId("lobby-name").fill(guestName);
  await guest.getByTestId("lobby-sign-in").click();
  await guest.getByTestId("lobby-code").fill(code);
  await guest.getByTestId("lobby-join").click();
  await expect(guest.getByTestId("room-title")).toHaveText(`Чёрный список ${stamp}`, { timeout: 20_000 });

  const hostSession = await host.evaluate(() => JSON.parse(window.localStorage.getItem("lume.session") ?? "null") as { accessToken: string; user: { id: string } } | null);
  const guestSession = await guest.evaluate(() => JSON.parse(window.localStorage.getItem("lume.session") ?? "null") as { accessToken: string; user: { id: string } });
  expect(hostSession?.accessToken).toBeTruthy();

  await openMemberProfile(host, guestName);
  await expect(host.getByTestId("profile-modal-name")).toHaveText(guestName);
  const banned = host.waitForResponse((response) => new URL(response.url()).pathname.endsWith("/ban") && response.request().method() === "POST");
  await host.getByTestId("profile-global-ban").click();
  expect((await banned).status()).toBe(200);
  await expect(host.getByTestId("profile-modal-note")).toContainText("Заблокирован");
  await host.getByTestId("profile-modal-close").click();

  const listed = await host.request.get(`${apiUrl}/users/${hostSession?.user.id}/blacklist`, {
    headers: { authorization: `Bearer ${hostSession?.accessToken ?? ""}` },
  });
  expect(listed.status()).toBe(200);
  const entries = (await listed.json()).entries as Array<{ userId: string; displayName: string }>;
  expect(entries.some((entry) => entry.userId === guestSession.user.id)).toBe(true);

  const rejected = await guest.request.post(`${apiUrl}/rooms/join`, {
    headers: { authorization: `Bearer ${guestSession.accessToken}`, "content-type": "application/json" },
    data: { code },
  });
  expect(rejected.status()).toBe(403);
  expect((await rejected.json()).error).toBe("banned");

  await host.goto("/settings");
  await expect(host.getByTestId("global-blacklist")).toBeVisible();
  await expect(host.getByTestId("global-ban-row")).toContainText(guestName);
  const removed = host.waitForResponse((response) => response.url().includes("/blacklist/remove") && response.request().method() === "POST");
  await host.getByTestId("global-ban-remove").click();
  expect((await removed).status()).toBe(200);
  await expect(host.getByTestId("global-ban-row")).toHaveCount(0);

  const allowed = await guest.request.post(`${apiUrl}/rooms/join`, {
    headers: { authorization: `Bearer ${guestSession.accessToken}`, "content-type": "application/json" },
    data: { code },
  });
  expect(allowed.status()).toBe(200);

  await hostContext.close();
  await guestContext.close();
});
