import { expect, test } from "@playwright/test";

test("the host reports the guest who is actually in the room", async ({ browser }) => {
  const hostContext = await browser.newContext();
  const guestContext = await browser.newContext();
  const host = await hostContext.newPage();
  const guest = await guestContext.newPage();

  await host.goto("/");
  await host.getByTestId("lobby-name").fill("Аня");
  await host.getByTestId("lobby-sign-in").click();
  await host.getByTestId("lobby-title").fill("Жалоба");
  await host.getByTestId("lobby-create").click();
  await expect(host.getByTestId("room-title")).toHaveText("Жалоба", { timeout: 20_000 });
  const code = (await host.getByTestId("room-code").innerText()).trim();

  await guest.goto("/");
  await guest.getByTestId("lobby-name").fill("Марк");
  await guest.getByTestId("lobby-sign-in").click();
  await guest.getByTestId("lobby-code").fill(code);
  await guest.getByTestId("lobby-join").click();
  await expect(guest.getByTestId("room-title")).toHaveText("Жалоба", { timeout: 20_000 });

  await expect(host.getByTestId("report-target")).toContainText("Марк", { timeout: 15_000 });
  const reported = host.waitForResponse((response) => response.url().includes("/reports") && response.request().method() === "POST");
  await host.getByTestId("report-reason").fill("спам в чате");
  await host.getByTestId("report-send").click();
  const response = await reported;
  expect(response.status()).toBe(200);
  const body = response.request().postDataJSON() as { targetId: string; reason: string };
  expect(body.reason).toBe("спам в чате");
  expect(body.targetId).not.toBe("mark");
  expect(body.targetId.length).toBeGreaterThan(4);

  await hostContext.close();
  await guestContext.close();
});
