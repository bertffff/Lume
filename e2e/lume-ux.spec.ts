import { expect, test } from "@playwright/test";
import { join } from "node:path";
import { apiUrl } from "./helpers/config.js";
import { createRoom } from "./helpers/create-room.js";
import { uniqueName } from "./helpers/identity.js";

const styles = ["cinema", "gruvbox", "telerave"] as const;
const modes = ["dark", "light"] as const;

for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
  test(`live room, profile and inbox at ${viewport.width}px`, async ({ page, request }) => {
    test.setTimeout(90_000);
    await page.setViewportSize(viewport);
    await page.emulateMedia({ reducedMotion: "reduce" });
    const login = await request.post(`${apiUrl}/auth/dev`, { data: { displayName: uniqueName("Кинозал") } });
    expect(login.ok()).toBeTruthy();
    const session = await login.json();
    const headers = { authorization: `Bearer ${session.accessToken}` };
    const senderLogin = await request.post(`${apiUrl}/auth/dev`, { data: { displayName: uniqueName("Друг кинозала") } });
    expect(senderLogin.ok()).toBeTruthy();
    const sender = await senderLogin.json();
    const invitation = await request.post(`${apiUrl}/friends/request`, {
      headers: { authorization: `Bearer ${sender.accessToken}` }, data: { userId: session.user.id },
    });
    expect(invitation.ok()).toBeTruthy();
    await page.addInitScript((value) => localStorage.setItem("lume.session", JSON.stringify(value)), session);

    async function capture(style: string, mode: string, view: string) {
      await page.evaluate(() => document.fonts.ready);
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBeTruthy();
      const directory = process.env.LUME_UX_SCREENSHOT_DIR;
      if (directory) await page.screenshot({ path: join(directory, `${style}-${mode}-${viewport.width}-${view}.png`), animations: "disabled" });
    }

    for (const style of styles) {
      for (const mode of modes) {
        const save = await request.patch(`${apiUrl}/me`, { headers, data: { uiStyle: style, uiMode: mode } });
        expect(save.ok(), `${style}/${mode} preference save (${save.status()})`).toBeTruthy();
        await page.goto("/");
        await createRoom(page, `${uniqueName("Ночной зал")} · ${style}`);
        await expect(page.getByTestId("room-header")).toHaveCount(1);
        await expect(page.getByTestId("room-code")).toHaveText(/^[A-HJ-KM-NP-Z2-9]{3}-[A-HJ-KM-NP-Z2-9]{3}$/);
        await expect(page.locator("html")).toHaveAttribute("data-style", style);
        await expect(page.locator("html")).toHaveAttribute("data-theme", mode);
        await expect(page.getByText(/02:03:10|1080p|stun:/)).toHaveCount(0);
        await capture(style, mode, "room");

        await page.goto("/");
        await expect(page.getByTestId("home-create-open")).toBeVisible();
        await expect(page.getByTestId("home-create-open").locator("input")).toHaveCount(0);
        await expect(page.getByText("Лиза", { exact: true })).toHaveCount(0);
        await capture(style, mode, "home");
        await page.getByRole("button", { name: "Уведомления", exact: true }).click();
        await expect(page.getByRole("dialog", { name: "Уведомления" })).toBeVisible();
        await capture(style, mode, "inbox-popover");
        await page.keyboard.press("Escape");

        await page.goto("/profile");
        await expect(page.getByRole("tab", { name: "Обзор" })).toHaveAttribute("aria-selected", "true");
        await capture(style, mode, "profile");

        await page.goto("/notifications");
        await expect(page.getByRole("heading", { name: "Уведомления" })).toBeVisible();
        await capture(style, mode, "notifications");
      }
    }
    await page.getByRole("button", { name: "Отметить все прочитанными" }).click();
    await expect.poll(async () => (await (await request.get(`${apiUrl}/notifications`, { headers })).json()).unread).toBe(0);
  });
}
