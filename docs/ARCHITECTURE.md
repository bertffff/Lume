# Архитектура

Четыре процесса и общие пакеты. Клиент не держит правду о воспроизведении.

```mermaid
sequenceDiagram
  participant Host
  participant Replica as Realtime replica
  participant Redis
  participant Guest
  Host->>Replica: playback:play
  Replica->>Redis: CAS by version
  Redis-->>Replica: new anchor
  Replica-->>Host: playback:state
  Replica-->>Guest: playback:state
  Guest->>Replica: playback:sync
  Replica->>Redis: GET anchor
  Replica-->>Guest: position at serverNow
```

## Часы

Якорь: `status`, `anchorPositionMs`, `anchorServerTimeMs`, `version`, `updatedBy`.

- `playing`: позиция = якорь + прошедшее серверное время.
- `paused`: позиция = якорь.
- `play` / `pause` / `seek` двигают якорь и увеличивают версию. Повторный `play` во время `playing` ничего не пишет.
- `clock:ping` возвращает `t0`, `t1`, `t2`. Клиент может оценить сдвиг `estimateClockOffset`. Сдвиг не двигает якорь: авторитет остаётся у сервера.

Пишет только `host`. Хост — первый `room:join` (`SET NX` на ключе хоста). Смена хоста — фаза 2.

## Redis — источник правды

| Ключ | Смысл |
| --- | --- |
| `lume:room:{id}:host` | userId хоста |
| `lume:room:{id}:presence` | hash участников |
| `lume:room:{id}:playback` | JSON якоря |

Запись якоря — Lua compare-and-set по `version`. Проигравшая попытка отвечает `version_conflict`.

`Map` внутри процесса хранит только `socket.id → { roomId, userId }`, чтобы снять участника на `disconnect`. После падения процесса эта связь пропадёт, ключи в Redis останутся. Уборку сделает worker позже.

Без `REDIS_URL` realtime не подключается к localhost сам. `/health` = 200, `/ready` = 503, join получает `redis_unavailable`.

## Room-hash routing

```
ownerIndex = FNV-1a(roomId) % REALTIME_REPLICA_COUNT
```

Адаптер Socket.io через Redis доставляет события на все реплики, поэтому читать комнату может любая. Индекс нужен, когда записей много и их надо прижать к одному процессу: `REALTIME_ENFORCE_ROOM_OWNER=true`. Чужая реплика отвечает `not_owner` и `ownerIndex`. Клиенту тогда стоит открыть сокет на эту реплику. Пока реплика одна, флаг выключен.

Функции `roomHash`, `replicaForRoom`, `foreignOwnerIndex` лежат в `@lume/contracts` и покрыты тестом на стабильные значения.

## API

| Метод | Путь | Поведение |
| --- | --- | --- |
| GET | `/health` | процесс жив |
| GET | `/ready` | какие секреты заданы, без пинга базы |
| POST | `/auth/telegram` | HMAC initData, если есть токен бота. Иначе 501, либо stub при `ALLOW_STUB_AUTH` |
| POST | `/auth/token` | выпуск JWT только при `ALLOW_STUB_AUTH` и `JWT_SECRET` |
| POST | `/voice/livekit/token` | 503 `livekit_disabled`, пока не заданы URL, key и secret |

Проверка initData: secret = HMAC-SHA256(ключ `WebAppData`, сообщение = токен бота), затем HMAC data-check-string. `auth_date` старше суток отклоняется.

Пользователь в ответе имеет id `tg:{telegramId}`. Запись в Postgres — следующая фаза, клиент Prisma уже экспортируется из `@lume/db`.

## Экстракторы

`MediaExtractor` и `ExtractorRegistry` описаны в контрактах. Реестр worker пустой, задача `media.resolve` возвращает `no_extractor`. yt-dlp не подключаем, пока нет решения, где ему жить и какие источники разрешены.

## База

Prisma schema: `User`, `Session`, `Room`, `RoomMember`, `Friendship`, `Message`, `Reaction`, `Achievement`, `UserAchievement`, `NotificationPreference`, `Entitlement`. Миграция `packages/db/prisma/migrations`. `pnpm db:migrate` вызывает `prisma migrate deploy`.

`layout` комнаты — JSON формы `RoomLayout` версии 1. `kind` уведомления — строка, чтобы не мигрировать схему на каждый новый тип.

## English

Redis is the room source of truth. Socket.io fans events out. A room hash picks a preferred writer only when `REALTIME_ENFORCE_ROOM_OWNER` is set. Playback is an anchor plus server time, CAS-guarded by version. The API can mint a Telegram-backed JWT and a LiveKit token once those secrets exist. Media extractors are an interface with an empty registry.
