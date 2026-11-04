# apps/realtime

Socket.io-синхронизация комнаты. Состояние комнаты живёт в Redis. Процессный `Map` хранит только связь «сокет → userId», чтобы снять присутствие на `disconnect`. Это не источник правды.

## События

Клиент → сервер: `room:join`, `room:leave`, `playback:play`, `playback:pause`, `playback:seek`, `playback:sync`, `clock:ping`.

Сервер → клиент: `room:state`, `room:presence`, `playback:state`, `playback:sync`, `clock:pong`, `room:error`.

`play` / `pause` / `seek` принимает только пользователь, записанный в `lume:room:{id}:host` (первый `join` через `SET NX`). Позиция считается от якоря в `@lume/contracts`: на паузе она заморожена, в воспроизведении растёт от серверных часов. `clock:ping` отвечает метками `t0/t1/t2` и пока не двигает якорь.

Запись playback — compare-and-set по `version` (Lua). Проигравшая реплика получает `version_conflict`.

## Room-hash routing

```
ownerIndex = fnv1a(roomId) % REALTIME_REPLICA_COUNT
```

Redis остаётся общим состоянием, адаптер `@socket.io/redis-adapter` разносит события на все реплики. Клиент может подключиться к любой. Индекс нужен, когда писателей надо прижать к одной реплике: `REALTIME_ENFORCE_ROOM_OWNER=true`. Чужая реплика отвечает `room:error` с кодом `not_owner` и полем `ownerIndex`. По умолчанию флаг выключен, одна реплика обслуживает всё.

Ключи:

- `lume:room:{id}:host`
- `lume:room:{id}:presence` — hash участников
- `lume:room:{id}:playback` — JSON якоря

Без `REDIS_URL` процесс поднимается, `/health` = 200, `/ready` = 503, join отвечает `redis_unavailable`. На localhost сервис сам не подключается.

Подробнее: `docs/ARCHITECTURE.md`.
