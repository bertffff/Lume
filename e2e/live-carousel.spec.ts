import { expect, test } from "@playwright/test";

test("the home carousel lists live rooms and the global counters track new rooms", async ({ page }) => {
  await page.setViewportSize({ width: 820, height: 800 });
  await page.goto("/");
  await page.getByTestId("lobby-name").fill(`Карусель ${Date.now()}`);
  await page.getByTestId("lobby-sign-in").click();

  await expect(page.getByTestId("lobby-title")).toBeVisible({ timeout: 20_000 });
  const stats = page.getByTestId("global-stats");
  await expect(stats).toBeVisible();
  await expect(stats).toHaveAttribute("data-ready", "true");
  const beforeActive = Number(await page.getByTestId("stat-active-rooms").getAttribute("data-value"));
  const beforeOnline = Number(await page.getByTestId("stat-users-online").getAttribute("data-value"));
  expect(Number.isFinite(beforeActive)).toBe(true);
  expect(beforeOnline).toBeGreaterThanOrEqual(1);

  const stamp = Date.now();
  const token = await page.evaluate(() => {
    const raw = window.localStorage.getItem("lume.session");
    return raw ? (JSON.parse(raw) as { accessToken?: string }).accessToken ?? "" : "";
  });
  for (let index = 0; index < 3; index += 1) {
    const title = `Карусель ${stamp}-${index}`;
    const created = await page.request.post("http://127.0.0.1:3001/rooms", {
      headers: { authorization: `Bearer ${token}` },
      data: { title, isPublic: true },
    });
    expect(created.status()).toBe(200);
  }
  await page.reload();
  await expect(page.getByTestId("live-carousel")).toBeVisible({ timeout: 20_000 });
  for (let index = 0; index < 3; index += 1) {
    await expect(page.locator(`[data-testid="carousel-room"]:has-text("Карусель ${stamp}-${index}")`)).toBeVisible();
  }
  await expect(page.getByTestId("global-stats")).toHaveAttribute("data-ready", "true");
  await expect.poll(async () => Number(await page.getByTestId("stat-active-rooms").getAttribute("data-value"))).toBeGreaterThanOrEqual(beforeActive + 3);

  const track = page.locator(".carousel-track");
  const start = await track.evaluate((element) => element.scrollLeft);
  await page.getByTestId("carousel-next").click();
  await expect.poll(async () => track.evaluate((element) => element.scrollLeft)).toBeGreaterThan(start);
  await page.getByTestId("carousel-prev").click();
  await expect.poll(async () => track.evaluate((element) => element.scrollLeft)).toBeLessThan(320);
});
