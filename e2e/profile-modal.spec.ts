import { expect, test } from "@playwright/test";
import { createRoom } from "./helpers/create-room";
import { openMemberProfile } from "./helpers/room-ui";

test("the live room opens a member profile card with friend and report actions", async ({ browser }) => {
  const stamp = Date.now().toString(36);
  const hostName = `Аня ${stamp}`;
  const guestName = `Марк ${stamp}`;
  const hostContext = await browser.newContext();
  const guestContext = await browser.newContext();
  const host = await hostContext.newPage();
  const guest = await guestContext.newPage();

  await host.goto("/");
  await host.getByTestId("lobby-name").fill(hostName);
  await host.getByTestId("lobby-sign-in").click();
  await createRoom(host, `Профили ${stamp}`);
  const code = (await host.getByTestId("room-code").innerText()).trim();

  await guest.goto("/");
  await guest.getByTestId("lobby-name").fill(guestName);
  await guest.getByTestId("lobby-sign-in").click();
  await guest.getByTestId("lobby-code").fill(code);
  await guest.getByTestId("lobby-join").click();
  await expect(guest.getByTestId("room-title")).toHaveText(`Профили ${stamp}`, { timeout: 20_000 });

  await openMemberProfile(host, guestName);
  await expect(host.getByTestId("profile-modal-name")).toHaveText(guestName);

  const friended = host.waitForResponse((response) => new URL(response.url()).pathname === "/friends/request" && response.request().method() === "POST");
  await host.getByTestId("profile-add-friend").click();
  expect((await friended).status()).toBe(200);
  await expect(host.getByTestId("profile-modal-note")).toContainText("Заявка отправлена");

  const reported = host.waitForResponse((response) => new URL(response.url()).pathname === "/reports" && response.request().method() === "POST");
  await host.getByTestId("profile-report-reason").fill("мешает смотреть");
  await host.getByTestId("profile-report").click();
  const report = await reported;
  expect(report.status()).toBe(200);
  expect(report.request().postDataJSON()).toMatchObject({ targetKind: "user", reason: "мешает смотреть" });
  await expect(host.getByTestId("profile-modal-note")).toContainText("Жалоба отправлена");

  await host.keyboard.press("Escape");
  await expect(host.getByTestId("profile-modal")).toHaveCount(0);

  await hostContext.close();
  await guestContext.close();
});
