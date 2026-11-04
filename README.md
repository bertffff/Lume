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

Документы: [продукт](docs/PRODUCT.md), [архитектура](docs/ARCHITECTURE.md), [плееры](docs/PLAYERS.md), [premium](docs/PREMIUM.md), [раскладка](docs/LAYOUT_SYSTEM.md).

## Переменные, которые задаёт человек

| Имя | Зачем |
| --- | --- |
| `DATABASE_URL` | Postgres для `pnpm db:migrate` |
| `REDIS_URL` | Realtime и worker. Без него они живые, но не готовы |
| `JWT_SECRET` | Подпись access token. Без него выпуск токена отвечает `jwt_unconfigured` |
| `TELEGRAM_BOT_TOKEN` | Проверка initData и polling бота |
| `ALLOW_STUB_AUTH` | `true` только локально: гостевой вход и initData без токена бота |
| `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET` | Учётные данные LiveKit Cloud. Пока пусто — `livekit_disabled` |
| `VITE_API_URL`, `VITE_REALTIME_URL` | Необязательно. По умолчанию `127.0.0.1:3001` и `:3002` |
| `REALTIME_REPLICA_COUNT`, `REALTIME_REPLICA_INDEX`, `REALTIME_ENFORCE_ROOM_OWNER` | Несколько реплик и запрет чужих записей |

## English

Lume is the repository name. The product remains TeleRave: a web app first, plus a Telegram Mini App from the same React codebase. Voice is LiveKit. Room presence and the playback anchor live in Redis. The free product is fully usable; payment later buys cosmetics only. Heavy server features are modeled and denied until we explicitly sell them. No payments and no video extractors in this slice.

```bash
pnpm install
docker compose up -d
# set DATABASE_URL and REDIS_URL in .env — see the table above
pnpm db:migrate
pnpm dev
```

Set `JWT_SECRET` and `ALLOW_STUB_AUTH=true` in `.env`, then open two browsers on <http://localhost:5173>. Sign in under different names, create a room, join with the code, paste an embed URL, press play, and send a chat line. `pnpm lint`, `pnpm test`, and `pnpm build` do not need a database. `pnpm test:e2e` does: it boots API, realtime, and the web build against Postgres and Redis.
