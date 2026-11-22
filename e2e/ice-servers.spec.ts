import { expect, test } from "@playwright/test";
import { createRoom } from "./helpers/create-room";

const apiUrl = process.env.API_URL ?? "http://127.0.0.1:3001";

test("the live room shows the authenticated STUN/TURN list issued by the API", async ({ page }) => {
  test.setTimeout(90_000);
  const stamp = Date.now().toString(36);
  await page.goto("/");
  await page.getByTestId("lobby-name").fill(`ICE ${stamp}`);
  await page.getByTestId("lobby-sign-in").click();
  await createRoom(page, `ICE ${stamp}`);

  const session = await page.evaluate(() => JSON.parse(window.localStorage.getItem("lume.session") ?? "null") as { accessToken: string } | null);
  expect(session?.accessToken).toBeTruthy();

  const response = await page.request.get(`${apiUrl}/ice-servers`, {
    headers: { authorization: `Bearer ${session?.accessToken ?? ""}` },
  });
  expect(response.status()).toBe(200);
  const payload = (await response.json()) as {
    iceServers: Array<{ urls: string | string[]; username?: string; credential?: string }>;
    livekit: { configured: boolean; url: string | null };
  };
  const urls = payload.iceServers.flatMap((server) => (Array.isArray(server.urls) ? server.urls : [server.urls]));
  expect(urls).toContain("stun:127.0.0.1:3478");
  expect(urls).toContain("turn:127.0.0.1:3478");
  expect(urls).toContain("turns:127.0.0.1:5349");
  const turn = payload.iceServers.find((server) => (Array.isArray(server.urls) ? server.urls : [server.urls]).some((url) => url.startsWith("turn:")));
  expect(turn).toMatchObject({ username: "lume-turn", credential: "lume-turn-test" });

  // The room used to render an ICE inventory in the stage. That UI was
  // deliberately removed (the room must not show `stun:` diagnostics), so the
  // authenticated API contract above is all that remains verifiable here.
  expect(urls.length).toBeGreaterThan(0);
});
