# Backend production plan (parity with TeleRave-v2, без Premium)

Дата: 2026-11-21. Ветка: `cursor/lume-greenfield-87d4`.

Цель: убрать фейковые `sent`/stub-ответы в тех местах, где интеграция объявлена
включённой, и довести бэкенд до состояния, в котором каждая заявленная
возможность либо реально работает, либо честно отвечает `unconfigured`/`skipped`.

## Решения

- **Загрузки.** Порядок в production: S3/R2 → Telegram storage → `503
  storage_unconfigured`. Локальный диск — только `development`/`test`.
  Переменные не выдумываем: `CDN_ENDPOINT`, `CDN_BUCKET`, `CDN_ACCESS_KEY`,
  `CDN_SECRET_KEY`, `CDN_REGION`, `CDN_PUBLIC_URL` (уже есть в `.env.example`
  и `docs/CONFIG.md`).
- **Telegram storage** включается только когда заданы одновременно
  `TELEGRAM_STORAGE_CHAT` и `TELEGRAM_BOT_TOKEN`.
- **Redis.** В production обязателен: ошибка конфигурации на старте + ping с
  таймаутом. Refresh-токены, magic-links и rate limit живут в Redis; в
  dev/test допускается in-memory реализация того же интерфейса.
- **Экстракторы.** Живые адаптеры работают только при `FF_EXTRACTORS=1|true`.
  CI и `pnpm test` остаются офлайн: фикстуры и локальные `node:http` серверы.

## Этапы

1. **Конфигурация и fail-fast** (`packages/contracts`/`apps/api`).
   - Дополнить `apiEnvSchema`: `VK_COOKIES`, `TWITCH_CLIENT_ID`,
     `TWITCH_CLIENT_SECRET`, `SMTP_PORT/USER/PASSWORD/FROM`,
     `VAPID_PRIVATE_KEY/SUBJECT`, `CDN_*`, `WEBAPP_URL`/`MINI_APP_URL`.
   - `REDIS_URL` обязателен в production (schema + старт с ping).
   - `/ready` проверяет Postgres (`SELECT 1`) и Redis (`PING`), а не флаги.
   - Redis-хранилища refresh-токенов и magic-links с префиксом ключей.

2. **Загрузки** (`apps/api`).
   - `bodyLimit: 16 MiB`; валидация 10 MiB остаётся.
   - `MediaObject` в Prisma + миграция (владелец, mime, размер, backend, ключ).
   - Реальные адаптеры: S3 (`PutObject`, публичный URL) и Telegram
     (`sendDocument` + `getFile` на чтении). `GET /uploads/:id` берёт метаданные
     из Postgres, отдаёт 302 на CDN или стримит из Telegram/диска.
   - Убрать `Map` загрузок и синтетические URL.

3. **Медиа** (`packages/media`, `apps/worker`, `apps/api`).
   - Новый пакет `@lume/media`: реестр и адаптеры Cobalt, yt-dlp, VK (cookies),
     Twitch GQL, YouTube InnerTube, Rutube, поиск SearXNG.
   - `media.resolve` в worker собирает реестр из env; `/video/resolve` API
     возвращает реальный результат либо `no_extractor`/`unconfigured`.
   - Кэш oEmbed/OG в Redis (TTL) + circuit breaker и таймауты.
   - F041: `QueueItem.expiresAt`, реальное переизвлечение в `/video/refresh`,
     repeatable job `media.refresh` каждую минуту для активных комнат.

4. **Уведомления и бот** (`packages/delivery`, `apps/worker`, `apps/api`, `apps/bot`).
   - `@lume/delivery`: nodemailer (SMTP) и web-push (VAPID).
   - `notify.digest` отправляет по-настоящему: `sent` только после успеха,
     `failed` с `lastError`, `skipped` при отсутствии ключей (с логом).
   - Убрать `emailStub`/`pushStub`.
   - Бот: `WEBAPP_URL` в env, `/start` с `room_<code>` открывает Mini App
     кнопкой `web_app` с параметром комнаты.

5. **Проверка.**
   - Изоляция тестов: уникальный префикс ключей Redis на прогон.
   - `pnpm lint`, `pnpm typecheck`, `pnpm build`, `pnpm test`, `pnpm test:e2e`.

## Статус

Все этапы выполнены. Проверка на ветке `cursor/lume-greenfield-87d4`:

- `pnpm lint` — 9/9 пакетов без ошибок.
- `pnpm typecheck` — 13/13 задач.
- `pnpm build` — 9/9 задач.
- `pnpm test` — 12/12 задач; API 93 теста, worker 9, media 16, delivery 4, bot 7.
- `pnpm test:e2e` — 50 passed, 17 skipped (skip-лист прежний), серверы поднимаются на `lume_test`.

Появились пакеты `@lume/media` (live-адаптеры) и `@lume/delivery`
(nodemailer + web-push). Схема БД получила `MediaObject` и
`QueueItem.expiresAt` миграцией `20261121120000_media_objects_and_url_expiry`.

## Вне scope

- Premium/платёжный контур.
- `F062` CDN segment offload: переменные `CDN_*` используются только для
  пользовательских загрузок, не для кэша сегментов.
