import { describe, expect, it } from "vitest";
import { createBot } from "./bot.js";
import { loadBotEnv } from "./env.js";

async function start(payload: string, webAppUrl?: string) {
  const bot = createBot(loadBotEnv({
    NODE_ENV: "test",
    TELEGRAM_BOT_TOKEN: "123:test-token",
    WEB_ORIGIN: "https://web.example",
    WEBAPP_URL: webAppUrl,
  }));
  bot.botInfo = {
    id: 123, is_bot: true, first_name: "Lume", username: "lume_test_bot",
    can_join_groups: true, can_read_all_group_messages: false, supports_inline_queries: false,
    can_connect_to_business: false, has_main_web_app: false, has_topics_enabled: false,
    allows_users_to_create_topics: false, can_manage_bots: false,
    supports_join_request_queries: false,
  };
  const replies: unknown[] = [];
  bot.api.config.use(async (_next, method, params) => {
    if (method !== "sendMessage") throw new Error("Unexpected Telegram request in fixture");
    replies.push(params);
    return { ok: true, result: undefined as never };
  });
  await bot.handleUpdate({
    update_id: 1,
    message: {
      message_id: 1, date: 0, from: { id: 1, is_bot: false, first_name: "Guest" },
      chat: { id: 1, type: "private", first_name: "Guest" }, text: `/start ${payload}`,
      entities: [{ type: "bot_command", offset: 0, length: 6 }],
    },
  });
  expect(replies).toHaveLength(1);
  return replies[0];
}

describe("bot /start invites", () => {
  it("displays an uppercase grouped code but links with a canonical payload", async () => {
    expect(await start("room_7KQ-2MX", "https://app.example/")).toMatchObject({
      text: expect.stringContaining("7KQ-2MX"),
      reply_markup: { inline_keyboard: [[{ web_app: { url: "https://app.example/?tgWebAppStartParam=room_7kq2mx" } }]] },
    });
  });

  it("does not offer an obsolete invite but still opens the app", async () => {
    expect(await start("room_7kq2mxzz", "https://app.example/")).toMatchObject({
      text: expect.stringContaining("Комната не найдена"),
      reply_markup: { inline_keyboard: [[{ web_app: { url: "https://app.example/" } }]] },
    });
  });

  it("preserves the ordinary user payload response and uses a canonical browser fallback for invites", async () => {
    expect(await start("user_42", "https://app.example/")).toMatchObject({
      text: "TeleRave — совместный просмотр. Откройте приложение.",
    });
    expect(await start("room_7KQ-2MX")).toMatchObject({ text: expect.stringContaining("https://web.example/join/7kq2mx") });
  });
});
