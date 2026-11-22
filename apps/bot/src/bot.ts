import { formatRoomCode } from "@lume/contracts";
import { Bot } from "grammy";
import { miniAppBase, type BotEnv } from "./env.js";
import { miniAppUrl, roomCodeFromStartPayload } from "./links.js";

export function createBot(env: BotEnv): Bot {
  const token = env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    throw new Error("TELEGRAM_BOT_TOKEN is required to create the bot");
  }
  const bot = new Bot(token);
  const web = env.WEB_ORIGIN;
  const appBase = miniAppBase(env);

  bot.command("start", async (ctx) => {
    const payload = ctx.match.trim();
    const code = roomCodeFromStartPayload(payload);
    const displayCode = code ? formatRoomCode(code) : null;
    const unavailable = payload && !code && !payload.startsWith("user_");
    const message = displayCode
      ? `Откройте приглашение в комнату ${displayCode}.`
      : unavailable
        ? "Комната не найдена. Откройте приложение или попросите новую ссылку."
        : "TeleRave — совместный просмотр. Откройте приложение.";
    if (!appBase) {
      const url = code ? new URL(`/join/${code}`, web).toString() : web;
      await ctx.reply(
        `${message}\nВеб: ${url}\nMini App не настроен: задайте WEBAPP_URL.`,
      );
      return;
    }
    const url = miniAppUrl(appBase, code);
    await ctx.reply(
      message,
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: displayCode ? `Открыть зал ${displayCode}` : "Открыть Lume", web_app: { url } }],
          ],
        },
      },
    );
  });

  // Telegram API errors may embed the reply payload and its invite URL.
  bot.catch(() => { process.stderr.write("Telegram bot update failed\n"); });

  bot.command("help", async (ctx) => {
    await ctx.reply("Команды: /start, /help. Голос, очередь и синхронизация живут в приложении, не в чате бота.");
  });

  return bot;
}
