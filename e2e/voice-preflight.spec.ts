import { expect, test } from "@playwright/test";

const apiUrl = process.env.API_URL ?? "http://127.0.0.1:3001";

test("the live voice preflight checks mic, speakers, and network and persists the result", async ({ page }) => {
  test.setTimeout(90_000);
  const stamp = Date.now().toString(36);
  await page.goto("/");
  await page.getByTestId("lobby-name").fill(`Префлайт ${stamp}`);
  await page.getByTestId("lobby-sign-in").click();
  await page.getByTestId("lobby-title").fill(`Префлайт ${stamp}`);
  await page.getByTestId("lobby-create").click();
  await expect(page.getByTestId("room-title")).toHaveText(`Префлайт ${stamp}`, { timeout: 20_000 });

  const session = await page.evaluate(() => JSON.parse(window.localStorage.getItem("lume.session") ?? "null") as { accessToken: string } | null);
  expect(session?.accessToken).toBeTruthy();

  const saved = page.waitForResponse((response) => new URL(response.url()).pathname === "/voice/preflight" && response.request().method() === "POST");
  await page.getByTestId("voice-preflight-run").click();
  const response = await saved;
  expect(response.status()).toBe(200);
  const posted = response.request().postDataJSON() as { mic: boolean; speaker: boolean; network: string };
  expect(["good", "fair", "poor"]).toContain(posted.network);

  await expect(page.getByTestId("voice-preflight")).toHaveAttribute("data-state", "done");
  await expect(page.getByTestId("voice-preflight")).toHaveAttribute("data-network", posted.network);
  await expect(page.getByTestId("voice-preflight-mic")).toBeVisible();
  await expect(page.getByTestId("voice-preflight-speaker")).toBeVisible();
  await expect(page.getByTestId("voice-preflight-network")).toHaveAttribute("data-network", posted.network);

  const stored = await page.request.get(`${apiUrl}/voice/preflight`, {
    headers: { authorization: `Bearer ${session?.accessToken ?? ""}` },
  });
  expect(stored.status()).toBe(200);
  const preflight = (await stored.json()).preflight as { mic: boolean; speaker: boolean; network: string; checkedAt: string };
  expect(preflight.network).toBe(posted.network);
  expect(preflight.mic).toBe(posted.mic);
  expect(preflight.speaker).toBe(posted.speaker);
  expect(Date.parse(preflight.checkedAt)).toBeGreaterThan(0);
});
