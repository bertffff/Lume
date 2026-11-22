import { expect, test } from "@playwright/test";
import { createRoom } from "./helpers/create-room";
import { uniqueName } from "./helpers/identity";
import { openPersonalSettings, openQueue } from "./helpers/room-ui";

test("play is held while another viewer is buffering", async ({ browser }) => {
  const hostContext = await browser.newContext();
  const guestContext = await browser.newContext();
  const host = await hostContext.newPage();
  const guest = await guestContext.newPage();

  await host.goto("/");
  await host.getByTestId("lobby-name").fill(uniqueName("Аня"));
  await host.getByTestId("lobby-sign-in").click();
  await createRoom(host, "Буфер");
  const code = (await host.getByTestId("room-code").innerText()).trim();

  await guest.goto("/");
  await guest.getByTestId("lobby-name").fill(uniqueName("Марк"));
  await guest.getByTestId("lobby-sign-in").click();
  await guest.getByTestId("lobby-code").fill(code);
  await guest.getByTestId("lobby-join").click();
  await expect(guest.getByTestId("room-title")).toHaveText("Буфер", { timeout: 20_000 });

  // The buffering report now lives in the viewer's personal sheet and is only
  // offered while something is playing, so seed a real now-playing item first.
  await openQueue(host);
  await host.getByTestId("queue-input").fill("https://cdn.example.com/buffer.mp4");
  await host.getByTestId("queue-add").click();
  await expect(host.getByTestId("queue-item")).toHaveCount(1, { timeout: 15_000 });
  await host.getByTestId("queue-next").click();
  await expect(host.getByTestId("queue-now")).toBeVisible();

  await openPersonalSettings(guest);
  await guest.getByTestId("report-buffering").click();
  await expect(host.getByTestId("playback-status")).toContainText("Ждём", { timeout: 15_000 });
  await host.getByTestId("playback-play").click();
  await expect(host.getByTestId("playback-status")).not.toContainText("идёт");

  // A buffering viewer who disconnects must not leave the room stuck on pause:
  // the phase is cleared and the held play resumes.
  await guestContext.close();
  await expect(host.getByTestId("playback-status")).not.toContainText("Ждём", { timeout: 15_000 });
  await expect(host.getByTestId("playback-status")).toContainText("идёт", { timeout: 15_000 });

  await hostContext.close();
});
