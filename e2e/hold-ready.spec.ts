import { expect, test } from "@playwright/test";

test("play is held while another viewer is buffering", async ({ browser }) => {
  const hostContext = await browser.newContext();
  const guestContext = await browser.newContext();
  const host = await hostContext.newPage();
  const guest = await guestContext.newPage();

  await host.goto("/");
  await host.getByTestId("lobby-name").fill("Аня");
  await host.getByTestId("lobby-sign-in").click();
  await host.getByTestId("lobby-title").fill("Буфер");
  await host.getByTestId("lobby-create").click();
  await expect(host.getByTestId("room-title")).toHaveText("Буфер", { timeout: 20_000 });
  const code = (await host.getByTestId("room-code").innerText()).trim();

  await guest.goto("/");
  await guest.getByTestId("lobby-name").fill("Марк");
  await guest.getByTestId("lobby-sign-in").click();
  await guest.getByTestId("lobby-code").fill(code);
  await guest.getByTestId("lobby-join").click();
  await expect(guest.getByTestId("room-title")).toHaveText("Буфер", { timeout: 20_000 });

  await guest.getByTestId("report-buffering").click();
  await expect(host.getByTestId("playback-status")).toContainText("Ждём", { timeout: 15_000 });
  await host.getByTestId("playback-play").click();
  await expect(host.getByTestId("playback-status")).not.toContainText("идёт");

  await hostContext.close();
  await guestContext.close();
});
