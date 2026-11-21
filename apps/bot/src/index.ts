import { createServer } from "node:http";
import { createBot } from "./bot.js";
import { loadBotEnv } from "./env.js";
import { loadRepoEnv } from "./load-env.js";

loadRepoEnv();
const env = loadBotEnv(process.env);
const polling = Boolean(env.TELEGRAM_BOT_TOKEN);

const server = createServer((request, response) => {
  if (request.url === "/health") {
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify({ status: "ok" }));
    return;
  }
  if (request.url === "/ready") {
    response.writeHead(polling ? 200 : 503, { "content-type": "application/json" });
    response.end(JSON.stringify({ status: polling ? "ready" : "idle", polling }));
    return;
  }
  response.writeHead(404);
  response.end();
});

server.listen(env.BOT_PORT, env.BOT_HOST, () => {
  console.log(JSON.stringify({ service: "bot", port: env.BOT_PORT, polling }));
});

if (env.TELEGRAM_BOT_TOKEN) {
  const bot = createBot(env);
  await bot.start({
    onStart: (info) => {
      console.log(JSON.stringify({ service: "bot", username: info.username }));
    },
  });
}
