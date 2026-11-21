import { expect, test } from "@playwright/test";
import { createRoom } from "./helpers/create-room";
import { openQueue } from "./helpers/room-ui";

const vkStub = `<!doctype html><html><body><script>
window.addEventListener("message", function (event) {
  var data = event.data;
  try { data = JSON.parse(event.data); } catch (error) {}
  window.parent.postMessage(JSON.stringify({ probe: data }), "*");
  if (data && data.probeEmit === "ended") {
    window.parent.postMessage(JSON.stringify({ event: "ended" }), "*");
  }
});
window.parent.postMessage(JSON.stringify({ event: "ready" }), "*");
</script></body></html>`;

test("the live player drives the VK and Rutube postMessage embeds", async ({ page }) => {
  await page.route("**/video_ext.php**", (route) =>
    route.fulfill({ status: 200, contentType: "text/html", body: vkStub }),
  );
  await page.route("**/play/embed/**", (route) =>
    route.fulfill({ status: 200, contentType: "text/html", body: "<!doctype html><html><body>rutube stub</body></html>" }),
  );

  await page.goto("/");
  await page.getByTestId("lobby-name").fill("Эмбед");
  await page.getByTestId("lobby-sign-in").click();
  await createRoom(page, "Эмбед");
  await openQueue(page);

  await page.getByTestId("queue-input").fill("https://vk.com/video-200_456239017");
  await page.getByTestId("queue-add").click();
  await expect(page.locator('[data-testid="queue-item"][data-url="https://vk.com/video-200_456239017"]')).toBeVisible();
  await page.getByTestId("queue-next").click();

  const frame = page.locator('[data-testid="player-mount"] iframe');
  await expect(frame).toHaveAttribute("src", /vk\.com\/video_ext\.php\?oid=-200&id=456239017/);
  const vkSrc = await frame.getAttribute("src");
  expect(vkSrc).toContain("js_api=1");
  expect(vkSrc).toContain("hide_logo=1");

  await page.getByTestId("queue-input").fill("https://rutube.ru/video/abcdef123456/");
  await page.getByTestId("queue-add").click();
  await expect(page.locator('[data-testid="queue-item"][data-url="https://rutube.ru/video/abcdef123456/"]')).toBeVisible();

  await page.evaluate(() => {
    const scope = window as unknown as { __embedProbe?: unknown[] };
    scope.__embedProbe = [];
    window.addEventListener("message", (event) => {
      try {
        scope.__embedProbe?.push(JSON.parse(String(event.data)));
      } catch {
        // ignore non-JSON frames
      }
    });
  });
  const probe = () => page.evaluate(() => (window as unknown as { __embedProbe?: unknown[] }).__embedProbe ?? []);

  const methodOf = (item: unknown) => (item as { probe?: { method?: string } }).probe?.method;

  await page.getByTestId("playback-play").click();
  await expect.poll(async () => (await probe()).some((item) => methodOf(item) === "play")).toBe(true);
  await expect.poll(async () => (await probe()).some((item) => methodOf(item) === "seek")).toBe(true);

  await page.getByTestId("playback-play").click();
  await expect.poll(async () => (await probe()).some((item) => methodOf(item) === "pause")).toBe(true);

  const seeksBefore = (await probe()).filter((item) => methodOf(item) === "seek").length;
  await page.keyboard.press("l");
  await expect.poll(async () => (await probe()).filter((item) => methodOf(item) === "seek").length).toBeGreaterThan(seeksBefore);

  await page.evaluate(() => {
    const iframe = document.querySelector<HTMLIFrameElement>('[data-testid="player-mount"] iframe');
    iframe?.contentWindow?.postMessage(JSON.stringify({ probeEmit: "ended" }), "*");
  });
  await expect(page.locator('[data-testid="player-mount"] iframe')).toHaveAttribute(
    "src",
    "https://rutube.ru/play/embed/abcdef123456?controls=false",
  );
});
