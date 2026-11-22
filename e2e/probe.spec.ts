import { expect, test } from "@playwright/test";

test("page colours come from the design tokens", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/?shot=home&style=cinema&mode=dark");
  await expect(page.locator(".design-app")).toBeVisible();
  const info = await page.evaluate(() => {
    const probe = document.createElement("i");
    document.body.append(probe);
    const resolve = (token: string, property: "color" | "backgroundColor") => {
      probe.style.cssText = property === "color" ? `color: var(${token})` : `background: var(${token})`;
      return getComputedStyle(probe)[property];
    };
    const body = getComputedStyle(document.body);
    const out = { theme: document.documentElement.dataset.theme, bodyColor: body.color, bodyBg: body.backgroundColor, text: resolve("--ds-text-primary", "color"), bg: resolve("--ds-bg", "backgroundColor") };
    probe.remove();
    return out;
  });
  expect(info.theme).toBe("dark");
  expect(info.bodyColor).toBe(info.text);
  expect(info.bodyBg).toBe(info.bg);
});
