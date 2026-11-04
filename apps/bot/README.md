# apps/bot

Бот на grammY. Без `TELEGRAM_BOT_TOKEN` процесс не ходит в Telegram: health-порт `3004`, `/ready` = 503, режим `idle`.

С токеном поднимается long polling и отвечает на `/start` и `/help`. Deep link `/start room_<slug>` пока только эхом показывает payload.

## Куда расти

- Кнопка меню Mini App и `web_app` URL на тот же `apps/web`.
- Webhook вместо polling, когда появится публичный HTTPS.
- Инвайт в комнату и запрос в друзья через deep link.
- Доставка уведомлений из очереди worker, с учётом `NotificationPreference`.
- Никаких секретов в репозитории: токен только в окружении.
