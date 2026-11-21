import { expect, test } from "@playwright/test";
import { createRoom } from "./helpers/create-room";
import { mockUrl } from "./helpers/config";
import { openQueue } from "./helpers/room-ui";

test("the live HLS player rewrites a master playlist and its media chain", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("lobby-name").fill("Манифест");
  await page.getByTestId("lobby-sign-in").click();
  await createRoom(page, "Манифест");
  await openQueue(page);

  const source = `${mockUrl}/master.m3u8`;
  const variantUrl = `${mockUrl}/variant.m3u8`;
  const segmentUrl = `${mockUrl}/seg.ts`;
  const master = page.waitForResponse((response) => response.url().includes(`/video/hls-proxy?url=${encodeURIComponent(source)}`), { timeout: 20_000 });
  const variant = page.waitForResponse((response) => response.url().includes(`/video/hls-proxy?url=${encodeURIComponent(variantUrl)}`), { timeout: 20_000 });
  await page.getByTestId("queue-input").fill(source);
  await page.getByTestId("queue-add").click();
  await expect(page.locator(`[data-testid="queue-item"][data-url="${source}"]`)).toBeVisible();
  await page.getByTestId("queue-next").click();

  const masterResponse = await master;
  expect(masterResponse.status()).toBe(200);
  expect(masterResponse.headers()["content-type"]).toContain("mpegurl");
  const masterBody = await masterResponse.text();
  expect(masterBody).toContain(`/video/hls-proxy?url=${encodeURIComponent(variantUrl)}`);

  const variantResponse = await variant;
  expect(variantResponse.status()).toBe(200);
  const variantBody = await variantResponse.text();
  expect(variantBody).toContain(`/video/hls-proxy?url=${encodeURIComponent(segmentUrl)}`);
});

test("the live DASH adapter loads its manifest through the proxy", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("lobby-name").fill("Дэш");
  await page.getByTestId("lobby-sign-in").click();
  await createRoom(page, "Дэш");
  await openQueue(page);

  const source = `${mockUrl}/manifest.mpd`;
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
