# TeleRave

Репозиторий называется **Lume**. Продукт для людей по-прежнему **TeleRave**: совместный просмотр, голос и чат. Это чистая перепись, без истории старого дерева.

Сначала нормальное веб-приложение. Telegram Mini App — тот же `apps/web`, с тонким адаптером (`themeParams`, haptic, BackButton), а не отдельный клиент.

Голос — **LiveKit**, отдельным сервисом. Состояние комнаты — **Redis**, не процессная память. Бесплатный продукт целиком пригоден для просмотра. Деньги позже покупают внешний вид: темы, значки, рамки. Тяжёлые серверные возможности (модерация, длинная история, приоритетный голос) заложены в модель прав и по умолчанию закрыты. Платежей в этом срезе нет.

## Как это сложено

```mermaid
flowchart LR
  subgraph clients [Клиенты]
    Web["apps/web<br/>React"]
    Mini["Telegram Mini App<br/>тот же web"]
  end

  Web --> API["apps/api<br/>Fastify"]
  Mini --> API
  Web --> RT["apps/realtime<br/>Socket.io"]
  Mini --> RT
  Bot["apps/bot<br/>grammY"] --> API
  Mini --- Bot

  API --> DB[("Postgres")]
  API --> LK["LiveKit"]
  RT --> Redis[("Redis<br/>присутствие и якорь")]
  Worker["apps/worker<br/>BullMQ"] --> Redis
  Contracts["@lume/contracts"] --- API
  Contracts --- RT
  Contracts --- Web
```

Синхронизация плеера серверная. Пока ролик играет, позиция равна `anchorPositionMs + (serverNow − anchorServerTimeMs)`. Пауза и seek переставляют якорь и увеличивают `version`. Пишет только хост. Несколько реплик делят комнаты по хешу id, но правда всё равно в Redis. Подробности: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Карта репозитория

| Путь | Роль |
| --- | --- |
| `apps/web` | Оболочка React + Vite, темы, модульная раскладка зала, адаптер Telegram |
| `apps/api` | REST: health, проверка Telegram initData, заготовка JWT, токен LiveKit |
| `apps/realtime` | Присутствие и playback в Redis, room-hash routing |
| `apps/worker` | Очередь `media.resolve`. Экстракторов пока нет |
| `apps/bot` | grammY, `/start` и `/help`, без токена просто ждёт |
| `packages/contracts` | Zod-схемы, часы плеера, гейт premium |
| `packages/db` | Prisma: пользователи, комнаты, друзья, чат, права |
| `packages/ui` | Две темы: «Уголь» и premium «Аврора» |
| `packages/config` | Общие tsconfig, ESLint, Tailwind-тема |

## Локальный запуск

Нужны Node.js 22 и pnpm 10. Docker — только если поднимаете Postgres и Redis.

```bash
pnpm install
cp .env.example .env
```

В `.env` для базы и очередей, если они нужны:

```bash
DATABASE_URL=postgresql://lume:lume@localhost:5432/lume?schema=public
REDIS_URL=redis://localhost:6379
```

Имена переменных и зачем они человеку — в конце этого файла. Секретов в репозитории нет: JWT, токен бота и ключи LiveKit остаются пустыми, пока вы их не зададите. Без них API отвечает на `/health`, а выпуск токенов честно отказывает.

```bash
docker compose up -d
pnpm db:migrate
pnpm dev
```

- веб: <http://localhost:5173>
- API: <http://localhost:3001/health>
- realtime: <http://localhost:3002/health>
- worker: <http://localhost:3003/health>
- bot: <http://localhost:3004/health>

`pnpm dev` поднимает все приложения. Зал, синхронизация и чат требуют Postgres, Redis и два значения в `.env`:

```bash
JWT_SECRET=замените-длинной-строкой
ALLOW_STUB_AUTH=true
```

`ALLOW_STUB_AUTH` только на своей машине. С токеном бота проверка initData идёт по HMAC, а гостевая кнопка «Представиться» пишет пользователя в базу и выдаёт JWT.

Два браузера: в каждом представиться разными именами, в первом открыть зал, во втором ввести код. Хост вставляет ссылку YouTube, VK, Rutube, Twitch, Vimeo или прямой URL, жмёт «Дальше», затем пуск. Второй видит статус «идёт». Сообщение в чате приходит соседу. Лимит бесплатной комнаты — 25 человек. После четырёх часов появляется напоминание, никого не выкидывает.

Проверки:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm test:e2e
```

`pnpm test:e2e` поднимает собранные API, realtime и веб против Postgres и Redis. Это смоук: два гостя, код зала, пуск, сообщение в чате.

## Дорожная карта

Фаза 0 этого репозитория — текущий срез: монорепозиторий, контракты, схема, каркасы приложений.

| Фаза | Смысл |
| --- | --- |
| 0 | Инструменты, схема, контракты, локальная инфраструктура, оболочка зала |
| 1 | Telegram initData, гостевой JWT, запись пользователя |
| 2 | Комната в Postgres, присутствие, playback, чат, очередь embed |
| 3 | Настоящие плееры провайдеров и догрузка метаданных. yt-dlp нет |
| 4 | Голос LiveKit Cloud, привязанный к участникам комнаты |
| 5 | Друзья, уведомления, передача хоста |
| 6 | Полировка Mini App, deep links, webhook бота |
| 7 | Витрина косметики и достижения. Тяжёлые возможности — отдельным решением |

Документы: [продукт](docs/PRODUCT.md), [архитектура](docs/ARCHITECTURE.md), [плееры](docs/PLAYERS.md), [голос](docs/VOICE.md), [premium](docs/PREMIUM.md), [раскладка](docs/LAYOUT_SYSTEM.md).

## Переменные, которые задаёт человек

Полный список с поведением при пустом значении — в [docs/CONFIG.md](docs/CONFIG.md). Имена без значений — в [.env.example](.env.example). `.env` не коммитится.

Обязательные для рабочего зала и деплоя:

| Имя | Зачем |
| --- | --- |
| `DATABASE_URL` | Postgres для аккаунтов, комнат, очереди и истории; `pnpm db:migrate` |
| `REDIS_URL` | Presence, refresh-токены, rate limit и очереди worker |
| `JWT_SECRET` | Подпись access token. Без него выпуск токена отвечает `jwt_unconfigured` |
| `WEB_ORIGIN` | CORS и ссылки в уведомлениях; в деплое — реальный origin веба |
| `API_URL`, `REALTIME_URL` | Адреса API и Socket.IO для realtime/API; по умолчанию `127.0.0.1:3001` и `:3002` |
| `VITE_API_URL`, `VITE_REALTIME_URL` | Те же адреса, вшиваемые в браузерный бандл |

Только для локальной машины и тестов:

| Имя | Зачем |
| --- | --- |
| `ALLOW_STUB_AUTH` | `true` только локально: гостевой вход и initData без токена бота |
| `ALLOW_STUB_VOICE` | `true` только локально: заглушка голосового токена |
| `DEV_ADMIN_NAMES` | Имена, которым локально выдаётся админка |

Опциональные возможности:

| Имя | Зачем |
| --- | --- |
| `TELEGRAM_BOT_TOKEN` | Проверка initData, Login Widget, polling бота и уведомления |
| `TELEGRAM_BOT_USERNAME` | Имя бота в deep links |
| `TELEGRAM_STORAGE_CHAT` | Telegram-чат как backend загрузок |
| `TELEGRAM_AUTH_MAX_AGE_SECONDS` | Максимальный возраст initData, по умолчанию 300 с |
| `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET` | Учётные данные LiveKit Cloud. Пока пусто — `livekit_disabled` |
| `LIVEKIT_TOKEN_TTL_SECONDS` | Время жизни токена LiveKit, по умолчанию 3600 с |
| `STUN_URLS`, `TURN_URL`, `TURN_URLS`, `TURN_USERNAME`, `TURN_CREDENTIAL` | ICE-серверы из `GET /ice-servers` |
| `JWT_TTL_SECONDS` | Время жизни access token, по умолчанию 12 часов |
| `API_HOST`, `API_PORT`, `REALTIME_HOST`, `REALTIME_PORT`, `WORKER_HOST`, `WORKER_PORT`, `BOT_HOST`, `BOT_PORT` | Адреса приложений |
| `REALTIME_REPLICA_COUNT`, `REALTIME_REPLICA_INDEX`, `REALTIME_ENFORCE_ROOM_OWNER` | Несколько реплик и запрет чужих записей |
| `FF_EXTRACTORS`, `COBALT_API_URL`, `YTDLP_PATH`, `VK_COOKIES`, `TWITCH_CLIENT_ID`, `TWITCH_CLIENT_SECRET` | Живые экстракторы; без них работают фикстуры и `unconfigured` |
| `SEARXNG_URL` | Поиск видео; без него список пуст |
| `OEMBED_BASE_URL`, `METADATA_ALLOW_PRIVATE_HOSTS` | Локальный/тестовый oEmbed и разрешение приватных хостов |
| `STREAM_ALLOWLIST`, `STREAM_MAX_BYTES`, `STREAM_ALLOW_PRIVATE_HOSTS`, `STREAM_HEADER_TIMEOUT_MS` | Allowlist, лимит и таймауты прокси сегментов |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM` | Почта и magic-link; без них доставка `skipped` |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | Web push; без них отправка `skipped` |
| `SENTRY_DSN`, `METRICS_TOKEN` | Отправка ошибок и защита `GET /metrics` |
| `CDN_ENDPOINT`, `CDN_BUCKET`, `CDN_ACCESS_KEY`, `CDN_SECRET_KEY`, `CDN_REGION`, `CDN_PUBLIC_URL` | Зарезервировано под CDN-выгрузку (`F062`); сейчас не включено |

### Заметки по деплою

- В продакшене выставите `NODE_ENV=production` и все обязательные переменные из таблицы выше. Секреты храните в секрет-хранилище платформы, не в Git.
- Перед запуском API выполните `pnpm db:migrate`, затем `pnpm build`; API, realtime и bot стартуют из `dist/`.
- Наружу отдавайте только веб-origin. Postgres и Redis держите в приватной сети, TLS завершайте на reverse proxy, WebSocket-апгрейды проксируйте в realtime.
- `/health` — liveness, `/ready` — readiness; в продакшене без Postgres или Redis он отвечает `503`.
- LiveKit, SMTP, VAPID и `TELEGRAM_BOT_TOKEN` подключайте после того, как поднялись Postgres, Redis и API. Без них приложение работает с честно отключёнными возможностями.

## English

Lume is the repository name. The product remains TeleRave: a web app first, plus a Telegram Mini App from the same React codebase. Voice is LiveKit. Room presence and the playback anchor live in Redis. The free product is fully usable; payment later buys cosmetics only. Heavy server features are modeled and denied until we explicitly sell them. No payments and no video extractors in this slice.

```bash
pnpm install
docker compose up -d
# set DATABASE_URL and REDIS_URL in .env — see the table above
pnpm db:migrate
pnpm dev
```

Set `DATABASE_URL`, `REDIS_URL`, `JWT_SECRET`, `ALLOW_STUB_AUTH=true` and `ALLOW_STUB_VOICE=true` in `.env`, then open two browsers on <http://localhost:5173>. Sign in under different names, create a room, join with the code, paste an embed URL, press play, and send a chat line. `pnpm lint`, `pnpm test`, and `pnpm build` do not need a database. `pnpm test:e2e` does: it boots API, realtime, and the web build against Postgres and Redis.

Every variable, its empty-value behaviour and the deploy checklist live in [docs/CONFIG.md](docs/CONFIG.md). The short version: production needs Postgres, Redis, `JWT_SECRET`, the public origins and the API/realtime/Vite URLs; LiveKit, Telegram, SMTP, push, extractors and Sentry are optional and degrade honestly when empty.
