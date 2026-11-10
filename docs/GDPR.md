# GDPR

Экспорт и удаление — заготовки, которые уже пишут строки в базу.

`POST /me/export` создаёт `DataExportRequest` со статусом `ready`. `GET /me/export/:token` отдаёт ZIP (`profile.json` и `README.txt`) 24 часа, потом `410`.

`POST /me/delete` с телом `{ "confirmation": "DELETE" }` ставит `deletedAt` и `scheduledDeletionAt` через 30 дней, очищает био и аватар и прячет имя. `POST /me/restore` отменяет удаление, пока срок не вышел. Воркер ставит повторяемую задачу BullMQ `account.purge` на 03:00 UTC и удаляет аккаунты, у которых срок вышел. Нужен `REDIS_URL` и `DATABASE_URL`.

Пароль в этом срезе хранится как scrypt, не bcrypt. Правила строки те же: 8–128 символов, строчная, прописная и цифра.

## English

Export creates a 24-hour JSON download. Delete is a 30-day soft delete with a restore route. The daily hard purge is not scheduled yet. Passwords are scrypt, with the same shape rules as the old bcrypt check.
