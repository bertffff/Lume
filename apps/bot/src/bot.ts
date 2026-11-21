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
    const code = roomCodeFromStartPayload(ctx.match);
    if (!appBase) {
      const roomLine = code ? `\nКомната: ${code}` : "";
      await ctx.reply(
        `TeleRave — совместный просмотр.\nВеб: ${web}${roomLine}\nMini App не настроен: задайте WEBAPP_URL.`,
      );
      return;
    }
    const url = miniAppUrl(appBase, code);
    await ctx.reply(
      code
        ? `Комната ${code} готова. Откройте её в приложении.`
        : "TeleRave — совместный просмотр. Откройте приложение.",
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: code ? `Открыть зал ${code}` : "Открыть Lume", web_app: { url } }],
          ],
        },
      },
    );
  });

  bot.command("help", async (ctx) => {
    await ctx.reply("Команды: /start, /help. Голос, очередь и синхронизация живут в приложении, не в чате бота.");
  });

  return bot;
}
