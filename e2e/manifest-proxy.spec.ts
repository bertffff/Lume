import { expect, test } from "@playwright/test";

test("the live HLS player rewrites a master playlist and its media chain", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("lobby-name").fill("Манифест");
  await page.getByTestId("lobby-sign-in").click();
  await page.getByTestId("lobby-title").fill("Манифест");
  await page.getByTestId("lobby-create").click();
  await expect(page.getByTestId("room-title")).toHaveText("Манифест", { timeout: 20_000 });

  const source = "http://127.0.0.1:3099/master.m3u8";
  const master = page.waitForResponse((response) => response.url().includes(`/video/hls-proxy?url=${encodeURIComponent(source)}`), { timeout: 20_000 });
  const variant = page.waitForResponse((response) => response.url().includes(`/video/hls-proxy?url=${encodeURIComponent("http://127.0.0.1:3099/variant.m3u8")}`), { timeout: 20_000 });
  await page.getByTestId("queue-input").fill(source);
  await page.getByTestId("queue-add").click();
  await expect(page.locator(`[data-testid="queue-item"][data-url="${source}"]`)).toBeVisible();
  await page.getByTestId("queue-next").click();

  const masterResponse = await master;
  expect(masterResponse.status()).toBe(200);
  expect(masterResponse.headers()["content-type"]).toContain("mpegurl");
  const masterBody = await masterResponse.text();
  expect(masterBody).toContain(`/video/hls-proxy?url=${encodeURIComponent("http://127.0.0.1:3099/variant.m3u8")}`);

  const variantResponse = await variant;
  expect(variantResponse.status()).toBe(200);
  const variantBody = await variantResponse.text();
  expect(variantBody).toContain(`/video/hls-proxy?url=${encodeURIComponent("http://127.0.0.1:3099/seg.ts")}`);
});

test("the live DASH adapter loads its manifest through the proxy", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("lobby-name").fill("Дэш");
  await page.getByTestId("lobby-sign-in").click();
  await page.getByTestId("lobby-title").fill("Дэш");
  await page.getByTestId("lobby-create").click();
  await expect(page.getByTestId("room-title")).toHaveText("Дэш", { timeout: 20_000 });

  const source = "http://127.0.0.1:3099/manifest.mpd";
  const manifest = page.waitForResponse((response) => response.url().includes(`/video/hls-proxy?url=${encodeURIComponent(source)}`), { timeout: 20_000 });
  await page.getByTestId("queue-input").fill(source);
  await page.getByTestId("queue-add").click();
  await expect(page.locator(`[data-testid="queue-item"][data-url="${source}"]`)).toBeVisible();
  await page.getByTestId("queue-next").click();

  const response = await manifest;
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toContain("dash+xml");
  const body = await response.text();
  expect(body).toContain("seg-$Number$.m4s");
  expect(body).toContain("&amp;source=direct");
});
