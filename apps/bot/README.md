# apps/bot

Бот на grammY. Без `TELEGRAM_BOT_TOKEN` процесс не ходит в Telegram: health-порт `3004`, `/ready` = 503, режим `idle`.

С токеном поднимается long polling и отвечает на `/start` и `/help`.

## Mini App и deep links

Публичный HTTPS-адрес Mini App задаётся через `WEBAPP_URL` (приоритет) или
`MINI_APP_URL`. Если адрес задан, `/start` показывает кнопку `web_app`:

- `/start` → кнопка «Открыть Lume» на чистый URL;
- `/start room_<code>` (и просто `room_<code>` в ссылке) → тот же URL с
  `tgWebAppStartParam=room_<code>`, который web-клиент читает как
  `initDataUnsafe.start_param` и открывает `/room/<code>`.

`user_<id>` и некорректные коды не превращаются в комнату. Если `WEBAPP_URL` не
задан, бот честно пишет, что Mini App не настроен, и даёт обычную ссылку на веб.

## Куда расти

- Webhook вместо polling, когда появится публичный HTTPS.
- Инвайт в комнату и запрос в друзья через deep link.
- Никаких секретов в репозитории: токен только в окружении.
