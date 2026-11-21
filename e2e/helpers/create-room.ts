import { expect, type Page } from "@playwright/test";

/**
 * Open the create wizard from the signed-in Home CTA.
 *
 * Wait for the guest sign-in control to leave the page before using the CTA.
 * The signed-in CTA is a card in Cinema and a command in Gruvbox.
 */
export async function openCreateWizard(page: Page): Promise<void> {
  await expect(page.getByTestId("lobby-sign-in")).toHaveCount(0, { timeout: 20_000 });
  const cta = page.getByTestId("home-create-open");
  await expect(cta).toBeVisible({ timeout: 20_000 });
  await cta.click();
  await expect(page.getByTestId("create-room-wizard")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId("lobby-title")).toBeVisible({ timeout: 20_000 });
}

/**
 * Walk the wizard from the details step through access and rights, then submit.
 *
 * Callers that need to inspect the POST /rooms request must set up
 * `page.waitForResponse` before invoking this helper.
 */
export async function submitCreateWizard(page: Page): Promise<void> {
  await page.getByTestId("create-next").click();
  await page.getByTestId("create-next").click();
  await page.getByTestId("lobby-create").click();
}

/**
 * The normal Home -> wizard -> room journey used by room-creation specs:
 * open the CTA, fill the title, advance twice and submit, then assert the room
 * actually opened with that title.
 */
export async function createRoom(page: Page, title: string): Promise<void> {
  await openCreateWizard(page);
  await page.getByTestId("lobby-title").fill(title);
  await submitCreateWizard(page);
  await expect(page.getByTestId("room-title")).toHaveText(title, { timeout: 20_000 });
}
