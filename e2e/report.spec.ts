import { expect, test } from "@playwright/test";
import { createRoom } from "./helpers/create-room";
import { uniqueName } from "./helpers/identity";
import { openMemberProfile } from "./helpers/room-ui";

test("the host reports the guest who is actually in the room", async ({ browser }) => {
  const hostContext = await browser.newContext();
  const guestContext = await browser.newContext();
  const host = await hostContext.newPage();
  const guest = await guestContext.newPage();

  await host.goto("/");
  await host.getByTestId("lobby-name").fill(uniqueName("Аня"));
  await host.getByTestId("lobby-sign-in").click();
  await createRoom(host, "Жалоба");
  const code = (await host.getByTestId("room-code").innerText()).trim();

  await guest.goto("/");
  await guest.getByTestId("lobby-name").fill(uniqueName("Марк"));
  await guest.getByTestId("lobby-sign-in").click();
  await guest.getByTestId("lobby-code").fill(code);
  await guest.getByTestId("lobby-join").click();
  await expect(guest.getByTestId("room-title")).toHaveText("Жалоба", { timeout: 20_000 });

  // Reporting now starts from the member's in-room profile card.
  await openMemberProfile(host, uniqueName("Марк"));
  await expect(host.getByTestId("profile-modal-name")).toContainText(uniqueName("Марк"));
  const reported = host.waitForResponse((response) => response.url().includes("/reports") && response.request().method() === "POST");
  await host.getByTestId("profile-report-reason").fill("спам в чате");
  await host.getByTestId("profile-report").click();
  const response = await reported;
  expect(response.status()).toBe(200);
  const body = response.request().postDataJSON() as { targetId: string; reason: string };
  expect(body.reason).toBe("спам в чате");
  expect(body.targetId).not.toBe("mark");
  expect(body.targetId.length).toBeGreaterThan(4);

  await hostContext.close();
  await guestContext.close();
});
