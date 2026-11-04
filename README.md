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

`pnpm dev` поднимает все приложения. Веб открывается и без Docker: сцена локальная, пока не задан `VITE_REALTIME_URL=http://localhost:3002`.

Проверки:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

## Дорожная карта

Фаза 0 этого репозитория — текущий срез: монорепозиторий, контракты, схема, каркасы приложений.

| Фаза | Смысл |
| --- | --- |
| 0 | Инструменты, схема, контракты, локальная инфраструктура, оболочка зала |
| 1 | Настоящая сессия: initData в проде, запись пользователя, веб-вход |
| 2 | Комнаты: реконнект, передача хоста, устойчивый playback |
| 3 | Очередь и совместный просмотр, первые экстракторы |
| 4 | Голос LiveKit, привязанный к участникам комнаты |
| 5 | Друзья, сообщения, реакции, уведомления |
| 6 | Полировка Mini App, deep links, webhook бота |
| 7 | Витрина косметики и достижения. Тяжёлые возможности — отдельным решением |

Документы: [продукт](docs/PRODUCT.md), [архитектура](docs/ARCHITECTURE.md), [premium](docs/PREMIUM.md), [раскладка](docs/LAYOUT_SYSTEM.md).

## Переменные, которые задаёт человек

| Имя | Зачем |
| --- | --- |
| `DATABASE_URL` | Postgres для `pnpm db:migrate` |
| `REDIS_URL` | Realtime и worker. Без него они живые, но не готовы |
| `JWT_SECRET` | Подпись access token. Без него выпуск токена отвечает `jwt_unconfigured` |
| `TELEGRAM_BOT_TOKEN` | Проверка initData и polling бота |
| `ALLOW_STUB_AUTH` | `true` только на машине разработчика, чтобы принять initData без токена |
| `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET` | Выпуск токена голоса. Пока пусто — `livekit_disabled` |
| `VITE_REALTIME_URL` | Если задан, веб открывает Socket.io. Иначе сцена локальная |
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

Web runs at <http://localhost:5173> even without Docker. `pnpm lint`, `pnpm test`, and `pnpm build` do not need a database. Roadmap phases 0–7 are in the table above; this branch is phase 0.
