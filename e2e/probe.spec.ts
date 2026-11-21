import { expect, test } from "@playwright/test";

test("tokens", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/?shot=home&style=cinema&mode=dark");
  await expect(page.locator(".design-app")).toBeVisible();
  const info = await page.evaluate(() => {
    const html = document.documentElement;
    const body = document.body;
    const app = document.querySelector(".design-app") as HTMLElement | null;
    const tile = document.querySelector(".tile") as HTMLElement | null;
    const cs = (el: Element | null) => {
      if (!el) return null;
      const s = getComputedStyle(el);
      return {
        tag: el.tagName,
        className: (el as HTMLElement).className,
        bg: s.backgroundColor,
        color: s.color,
        display: s.display,
        varBg: s.getPropertyValue("--bg").trim(),
        varText: s.getPropertyValue("--text").trim(),
        varS1: s.getPropertyValue("--s1").trim(),
      };
    };
    return {
      style: html.dataset.style,
      theme: html.dataset.theme,
      html: cs(html),
      body: cs(body),
      app: cs(app),
      tile: cs(tile),
      h1: cs(document.querySelector("h1")),
    };
  });
  console.log(JSON.stringify(info, null, 2));
  await page.screenshot({ path: "/tmp/home-fixed.png" });
  expect(info.theme).toBe("dark");
  expect(info.html?.varText.toLowerCase()).toBe("#f3ede6");
  expect(info.html?.color).toBe("rgb(243, 237, 230)");
});
