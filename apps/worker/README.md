# apps/worker

BullMQ-воркер. Сейчас одна очередь: `media.resolve`.

Обработчик смотрит в пустой `ExtractorRegistry` и возвращает `{ status: "no_extractor" }`. Пока `FF_EXTRACTORS` не равен `true` или `1`, реестр даже не спрашивается. yt-dlp сюда не кладём.

## Куда расти

- `media.resolve` — реализации `MediaExtractor` по одному провайдеру.
- `notification.dispatch` — веб и Telegram по `NotificationPreference`.
- `entitlement.expire` — снимать просроченную косметику.
- `achievement.evaluate` — выдавать заглушки из `@lume/db`.
- Уборка presence после падения реплики realtime.

Без `REDIS_URL` процесс не создаёт очередь: `/health` = 200, `/ready` = 503. Порт по умолчанию `3003`.
