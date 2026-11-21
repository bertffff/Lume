import { expect, test } from "@playwright/test";

test.describe.configure({ mode: "serial" });

const apiUrl = process.env.API_URL ?? "http://127.0.0.1:3001";

interface BoardRow {
  userId: string;
  displayName: string;
  value: number;
}

test("the live profile renders message, reaction, and voice leaderboards from persisted activity", async ({ page }) => {
  test.setTimeout(120_000);
  const stamp = Date.now().toString(36);
  await page.goto("/");
  await page.getByTestId("lobby-name").fill(`Лидер ${stamp}`);
  await page.getByTestId("lobby-sign-in").click();
  await page.getByTestId("lobby-title").fill(`Лидеры ${stamp}`);

  const created = page.waitForResponse((response) => new URL(response.url()).pathname === "/rooms" && response.request().method() === "POST");
  await page.getByTestId("lobby-create").click();
  const roomId = ((await (await created).json()) as { room: { id: string } }).room.id;
  await expect(page.getByTestId("room-title")).toHaveText(`Лидеры ${stamp}`, { timeout: 20_000 });

  const session = await page.evaluate(() => JSON.parse(window.localStorage.getItem("lume.session") ?? "null") as { accessToken: string; user: { id: string } } | null);
  const token = session?.accessToken ?? "";
  const userId = session?.user.id ?? "";
  expect(token).toBeTruthy();

  let firstMessageId = "";
  for (let index = 0; index < 20; index += 1) {
    const sent = await page.request.post(`${apiUrl}/rooms/${roomId}/messages`, {
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      data: { body: `лидерборд ${stamp} ${index}` },
    });
    expect(sent.status()).toBe(200);
    if (index === 0) firstMessageId = ((await sent.json()) as { id: string }).id;
  }
  const reacted = await page.request.post(`${apiUrl}/rooms/${roomId}/reactions`, {
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    data: { messageId: firstMessageId, emoji: "🔥" },
  });
  expect(reacted.status()).toBe(200);
  const voice = await page.request.post(`${apiUrl}/me/voice-seconds`, {
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    data: { seconds: 45 },
  });
  expect(voice.status()).toBe(200);

  const fullResponse = await page.request.get(`${apiUrl}/stats/leaderboard?limit=50`, {
    headers: { authorization: `Bearer ${token}` },
  });
  expect(fullResponse.status()).toBe(200);
  const boards = (await fullResponse.json()) as { messages: BoardRow[]; reactions: BoardRow[]; voice: BoardRow[] };
  expect(boards.messages.find((row) => row.userId === userId)?.value).toBeGreaterThanOrEqual(20);
  expect(boards.reactions.find((row) => row.userId === userId)?.value).toBeGreaterThanOrEqual(1);
  expect(boards.voice.find((row) => row.userId === userId)?.value).toBeGreaterThanOrEqual(45);

  const topResponse = await page.request.get(`${apiUrl}/stats/leaderboard`, {
    headers: { authorization: `Bearer ${token}` },
  });
  const top = (await topResponse.json()) as { messages: BoardRow[]; reactions: BoardRow[]; voice: BoardRow[] };

  await page.goto("/profile");
  await expect(page.getByTestId("leaderboards")).toBeVisible();
  for (const board of ["messages", "reactions", "voice"] as const) {
    const expected = top[board];
    await expect(page.getByTestId(`leaderboard-${board}-row`)).toHaveCount(expected.length);
    for (const row of expected) {
      const locator = page.locator(`[data-testid="leaderboard-${board}-row"][data-user-id="${row.userId}"]`);
      await expect(locator).toHaveAttribute("data-value", String(row.value));
    }
  }
});
