import { Bot } from "grammy";
import type { BotEnv } from "./env.js";

export function createBot(env: BotEnv): Bot {
  const token = env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    throw new Error("TELEGRAM_BOT_TOKEN is required to create the bot");
  }
  const bot = new Bot(token);
  const web = env.WEB_ORIGIN;

  bot.command("start", async (ctx) => {
    const payload = ctx.match;
    const roomLine = payload ? `\nКомната: ${payload}` : "";
    await ctx.reply(
      `TeleRave — совместный просмотр.\nВеб: ${web}${roomLine}\nMini App откроется отсюда, когда будет привязан URL.`,
    );
  });

  bot.command("help", async (ctx) => {
    await ctx.reply("Команды: /start, /help. Голос, очередь и синхронизация живут в приложении, не в чате бота.");
  });

  return bot;
}
