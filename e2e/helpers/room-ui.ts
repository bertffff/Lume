import { expect, type Page } from "@playwright/test";

export type DockTab = "chat" | "people" | "queue";

/**
 * Bring a room dock panel to the front.
 *
 * The rewritten room has one `SessionDock` with three tabs. On wide viewports
 * it is always mounted in the workspace; at <=820px it is an overlay sheet
 * hidden until `mobile-sheet-toggle` is pressed. Waiting on the tab's
 * `aria-controls` target proves the real panel is showing, not just that the
 * button exists in the DOM.
 */
export async function openDockTab(page: Page, tab: DockTab): Promise<void> {
  const dock = page.getByTestId("session-dock");
  if (!(await dock.isVisible())) {
    await page.getByTestId("mobile-sheet-toggle").click();
    await expect(dock).toBeVisible();
  }
  const tabButton = page.getByTestId(`session-dock-${tab}`);
  await expect(tabButton).toHaveAttribute("role", "tab");
  await tabButton.click();
  await expect(tabButton).toHaveAttribute("aria-selected", "true");
  const controls = await tabButton.getAttribute("aria-controls");
  expect(controls, `${tab} tab must reference its panel`).toBeTruthy();
  // React useId values contain colons, so match the id as a quoted attribute.
  await expect(page.locator(`[id="${controls}"]`)).toBeVisible();
}

export async function openChat(page: Page): Promise<void> {
  await openDockTab(page, "chat");
}

export async function openPeople(page: Page): Promise<void> {
  await openDockTab(page, "people");
}

export async function openQueue(page: Page): Promise<void> {
  await openDockTab(page, "queue");
}

/**
 * Open the per-viewer settings sheet (layout, appearance, voice preflight,
 * reminder, sync-incident, buffering report and reaction visibility).
 *
 * This is deliberately distinct from host settings: the trigger lives in the
 * player controls and is available to every role.
 */
export async function openPersonalSettings(page: Page): Promise<void> {
  await page.getByTestId("room-personal-settings").click();
  await expect(page.getByTestId("room-personal-sheet")).toBeVisible();
}

/**
 * Open the host-only room settings sheet (title, description, cap, visibility,
 * hide-reactions, six viewer defaults, mute-all and the moderation log).
 */
export async function openHostSettings(page: Page): Promise<void> {
  await expect(page.getByTestId("room-settings-open")).toBeVisible();
  await page.getByTestId("room-settings-open").click();
  await expect(page.getByTestId("room-settings-sheet")).toBeVisible();
}

/** Both settings sheets are portalled Modals that close on Escape. */
export async function closeSheet(page: Page, testId: "room-personal-sheet" | "room-settings-sheet" | "profile-modal"): Promise<void> {
  await page.keyboard.press("Escape");
  await expect(page.getByTestId(testId)).toHaveCount(0);
}

/**
 * Open a member's in-room profile card. The member rows now live behind the
 * `people` dock tab instead of being permanently in the old rail.
 */
export async function openMemberProfile(page: Page, displayName: string): Promise<void> {
  await openPeople(page);
  const panel = page.locator('[data-testid="session-dock"] [role="tabpanel"]:visible');
  await panel.locator('button[data-testid^="member-"]').filter({ hasText: displayName }).first().click();
  await expect(page.getByTestId("profile-modal")).toBeVisible();
}
