import { expect, test } from "@playwright/test";
import { createRoom } from "./helpers/create-room";
import { uniqueName } from "./helpers/identity";
import { openChat } from "./helpers/room-ui";

test("a message can be answered and reacted to", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await page.getByTestId("lobby-name").fill(uniqueName("Аня"));
  await page.getByTestId("lobby-sign-in").click();
  await createRoom(page, "Ответы в чате");
  await openChat(page);

  await page.getByTestId("chat-input").fill("первое сообщение");
  await page.getByTestId("chat-send").click();
  const first = page.getByTestId("chat-message").filter({ hasText: "первое сообщение" }).first();
  await expect(first).toBeVisible();

  await first.hover();
  await first.getByTestId("chat-reply").click();
  await expect(page.getByTestId("chat-replying")).toContainText("первое сообщение");
  await page.getByTestId("chat-input").fill("а это ответ");
  await page.getByTestId("chat-send").click();
  const answer = page.getByTestId("chat-message").filter({ hasText: "а это ответ" });
  await expect(answer.getByTestId("chat-quote")).toContainText("первое сообщение");
  await expect(page.getByTestId("chat-replying")).toHaveCount(0);

  await first.hover();
  await first.getByTestId("chat-react").first().click();
  await expect(first.getByTestId("chat-reaction")).toHaveText(/👍\s*1/);
  await first.getByTestId("chat-reaction").click();
  await expect(first.getByTestId("chat-reaction")).toHaveCount(0);
});
