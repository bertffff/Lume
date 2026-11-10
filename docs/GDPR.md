# GDPR

Экспорт и удаление — заготовки, которые уже пишут строки в базу.

`POST /me/export` создаёт `DataExportRequest` со статусом `ready` и JSON профиля. Ссылка живёт 24 часа. `GET /me/export/:token` после срока отвечает `410`. Это ещё не ZIP-архив: в файле те же данные, упаковка в ZIP — следующий шаг.

`POST /me/delete` с телом `{ "confirmation": "DELETE" }` ставит `deletedAt` и `scheduledDeletionAt` через 30 дней, очищает био и аватар и прячет имя. `POST /me/restore` отменяет удаление, пока срок не вышел. Ежедневная жёсткая очистка просроченных аккаунтов ещё не запущена кроном.

Пароль в этом срезе хранится как scrypt, не bcrypt. Правила строки те же: 8–128 символов, строчная, прописная и цифра.

## English

Export creates a 24-hour JSON download. Delete is a 30-day soft delete with a restore route. The daily hard purge is not scheduled yet. Passwords are scrypt, with the same shape rules as the old bcrypt check.
