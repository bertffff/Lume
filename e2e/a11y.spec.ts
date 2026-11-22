import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

for (const view of ["home", "create", "join", "auth"] as const) {
  test(`${view} has no serious accessibility violations`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`/?shot=${view}&style=cinema&mode=dark`);
    await expect(page.locator(".design-app")).toBeVisible();
    const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
    const serious = results.violations.filter((violation) => violation.impact === "serious" || violation.impact === "critical");
    expect(
      serious.map((violation) => ({ id: violation.id, nodes: violation.nodes.map((node) => node.target.join(" ")) })),
    ).toEqual([]);
  });
}
