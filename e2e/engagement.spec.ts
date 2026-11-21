import { expect, test } from "@playwright/test";
import { createRoom } from "./helpers/create-room";

test.describe.configure({ mode: "serial" });

const apiUrl = process.env.API_URL ?? "http://127.0.0.1:3001";

test("the live profile engagement widget aggregates watch, voice, and chat activity", async ({ browser }) => {
  test.setTimeout(90_000);
  const stamp = Date.now().toString(36);
  const message = `Вовлечённость ${stamp}`;
  const ownerContext = await browser.newContext();
  const partnerContext = await browser.newContext();
  const owner = await ownerContext.newPage();
  const partner = await partnerContext.newPage();

  await owner.goto("/");
  await owner.getByTestId("lobby-name").fill(`Вовлечённость ${stamp}`);
  await owner.getByTestId("lobby-sign-in").click();
  await createRoom(owner, `Вовлечённость ${stamp}`);
  const code = (await owner.getByTestId("room-code").innerText()).trim();

  await partner.goto("/");
  await partner.getByTestId("lobby-name").fill(`Партнёр ${stamp}`);
  await partner.getByTestId("lobby-sign-in").click();
  await partner.getByTestId("lobby-code").fill(code);
  await partner.getByTestId("lobby-join").click();
  await expect(partner.getByTestId("room-title")).toHaveText(`Вовлечённость ${stamp}`, { timeout: 20_000 });

  await owner.getByTestId("chat-input").fill(message);
  await owner.getByTestId("chat-send").click();
  await expect(owner.getByTestId("chat-message").filter({ hasText: message })).toBeVisible();

  await owner.getByTestId("voice-join").click();
  await expect(owner.getByTestId("voice-session")).toContainText("в эфире");
  await owner.waitForTimeout(2200);
  const voiceFlushed = owner.waitForResponse((response) => new URL(response.url()).pathname === "/me/voice-seconds" && response.request().method() === "POST");
  await owner.getByTestId("voice-leave").click();
  expect((await voiceFlushed).status()).toBe(200);

  // Stay long enough for the leave route to persist a real watch session.
  await owner.waitForTimeout(29_000);
  const left = owner.waitForResponse((response) => response.url().includes("/leave") && response.request().method() === "POST");
  await owner.getByTestId("session-dock-leave").click();
  expect((await left).status()).toBe(200);
  await expect(owner.locator('[data-testid="home-create-open"].tile')).toBeVisible();

  const session = await owner.evaluate(() => {
    const raw = window.localStorage.getItem("lume.session");
    return raw ? (JSON.parse(raw) as { accessToken: string; user: { id: string } }) : null;
  });
  expect(session?.accessToken).toBeTruthy();

  await owner.goto("/profile");
  await expect(owner.getByTestId("profile-engagement")).toBeVisible();
  await expect.poll(async () => Number(await owner.getByTestId("engagement-voice").getAttribute("data-seconds"))).toBeGreaterThanOrEqual(2);
  await expect.poll(async () => Number(await owner.getByTestId("engagement-watch").getAttribute("data-seconds"))).toBeGreaterThanOrEqual(30);
  await expect.poll(async () => Number(await owner.getByTestId("engagement-messages").getAttribute("data-count"))).toBeGreaterThanOrEqual(1);
  const voice = Number(await owner.getByTestId("engagement-voice").getAttribute("data-seconds"));
  const watch = Number(await owner.getByTestId("engagement-watch").getAttribute("data-seconds"));
  const messages = Number(await owner.getByTestId("engagement-messages").getAttribute("data-count"));

  const stored = await owner.request.get(`${apiUrl}/users/${session?.user.id}/engagement`, {
    headers: { authorization: `Bearer ${session?.accessToken ?? ""}` },
  });
  expect(stored.status()).toBe(200);
  const body = (await stored.json()) as { watchSeconds: number; voiceSeconds: number; messages: number; totalSeconds: number };
  expect(body.voiceSeconds).toBe(voice);
  expect(body.messages).toBe(messages);
  expect(body.watchSeconds).toBeGreaterThanOrEqual(30);
  expect(body.totalSeconds).toBe(body.watchSeconds + body.voiceSeconds);

  await ownerContext.close();
  await partnerContext.close();
});
