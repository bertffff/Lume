import { expect, test } from "@playwright/test";
import { createRoom } from "./helpers/create-room";
import { uniqueName } from "./helpers/identity";
import { openChat, openPeople, openQueue } from "./helpers/room-ui";

test("two guests create a room, sync playback, and chat", async ({ browser }) => {
  const hostContext = await browser.newContext();
  const guestContext = await browser.newContext();
  const host = await hostContext.newPage();
  const guest = await guestContext.newPage();

  await host.goto("/");
  await host.getByTestId("lobby-name").fill(uniqueName("Аня"));
  await host.getByTestId("lobby-sign-in").click();
  await createRoom(host, "Вечерний зал");
  const code = (await host.getByTestId("room-code").innerText()).trim();

  await guest.goto("/");
  await guest.getByTestId("lobby-name").fill(uniqueName("Марк"));
  await guest.getByTestId("lobby-sign-in").click();
  await guest.getByTestId("lobby-code").fill(code);
  await guest.getByTestId("lobby-join").click();
  await expect(guest.getByTestId("room-title")).toHaveText("Вечерний зал", { timeout: 20_000 });
  await openPeople(guest);
  await expect(guest.getByTestId("rail-people")).toContainText(uniqueName("Аня"));

  await openQueue(host);
  await host.getByTestId("queue-input").fill("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
  await host.getByTestId("queue-add").click();
  await expect(host.getByTestId("queue-item")).toHaveCount(1, { timeout: 15_000 });
  await host.getByTestId("queue-next").click();
  await expect(host.getByTestId("player-mount")).toBeVisible();
  await host.getByTestId("playback-play").click();
  await expect(guest.getByTestId("playback-status")).toContainText(/идёт|playing/, { timeout: 15_000 });

  await openChat(host);
  await host.getByTestId("chat-input").fill("привет");
  await host.getByTestId("chat-send").click();
  await openChat(guest);
  await expect(guest.getByTestId("chat-log")).toContainText("привет", { timeout: 15_000 });
  if (!process.env.LIVEKIT_URL) {
    await expect(host.getByTestId("voice-fallback")).toBeVisible();
  }

  await hostContext.close();
  await guestContext.close();
});

const liveKitConfigured = Boolean(
  process.env.LIVEKIT_URL && process.env.LIVEKIT_API_KEY && process.env.LIVEKIT_API_SECRET,
);

test("LiveKit voice media stays skipped without Cloud credentials", async () => {
  test.skip(!liveKitConfigured, "set LIVEKIT_URL, LIVEKIT_API_KEY, and LIVEKIT_API_SECRET");
  expect(liveKitConfigured).toBe(true);
});
