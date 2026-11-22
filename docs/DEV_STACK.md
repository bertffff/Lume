# Локальный контур для разработки и дизайна

## Почему каталог показывал «Не удалось загрузить комнаты»

Причина подтверждена воспроизведением, а не догадкой.

В dev-базе `lume` (`lume-postgres-1`, порт 5432) применены миграции только до `20261121120000_media_objects_and_url_expiry`. Не применены:

- `20261122090000_room_invite_cutover`
- `20261122100000_room_categories`

Код API ждёт колонки `Room.category`, а её в такой базе нет. `GET /rooms/catalog` и старый `GET /rooms` отвечают `500 {"error":"internal"}`; в логе Prisma: `The column Room.category does not exist in the current database`. Веб глотает любую ошибку в одном `catch` и показывает общий текст ошибки.

### Как отличить «пусто» от «ошибка»

```bash
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:3001/rooms/catalog
# 200 и {"rooms":[],"nextCursor":null}  — комнат нет (пусто)
# 500                                   — API не может прочитать схему (ошибка), смотри миграции
```

Проверка применённых миграций (только чтение):

```bash
docker exec lume-postgres-1 psql -U lume -d lume -c \
  "select migration_name from _prisma_migrations order by started_at desc limit 3;"
```

### Что сделано на этой машине

22 ноября 2026 dev-база `lume` (`lume-postgres-1`) мигрирована до актуальной схемы по явному решению владельца. Перед этим: проверено отсутствие подключений и запущенных API, снят дамп (`pg_dump --format=custom`, 35 комнат и 22 пользователя). После: все 35 комнат на месте, у всех шестизнаковые коды, `GET /rooms/catalog` отвечает `200`. Старые тестовые комнаты получили категорию `other` (в них нет метаданных для классификации).

Миграция `room_invite_cutover` **необратима**: старые восьмисимвольные ссылки больше не работают. Для другой машины порядок такой: убедиться, что нет подключений и запущенных API/realtime, снять дамп, затем `DATABASE_URL=… pnpm --filter @lume/db exec prisma migrate deploy`. Откат только восстановлением дампа (`pg_restore`).

## Изолированный контур для дизайна и скриншотов

Не трогает `lume-postgres-1` и `lume-redis-1`. Порты: Postgres `55434`, Redis `56381`, API `33101`, realtime `33102`, веб `35273`, статика постеров `33199`, dev-галерея `35274`.

```bash
docker run -d --name lume-design-pg -e POSTGRES_USER=design -e POSTGRES_PASSWORD=design-local-only \
  -e POSTGRES_DB=lume_design -p 127.0.0.1:55434:5432 postgres:16-alpine
docker run -d --name lume-design-redis -p 127.0.0.1:56381:6379 redis:7-alpine

export DATABASE_URL='postgresql://design:design-local-only@127.0.0.1:55434/lume_design?schema=public'
pnpm --filter @lume/db exec prisma migrate deploy
```

### Реалистичные данные

```bash
DESIGN_DATABASE_URL="$DATABASE_URL" POSTER_DIR=/path/to/posters POSTER_BASE=http://127.0.0.1:33199 \
  pnpm --filter @lume/api exec tsx scripts/dev-seed-design.ts --profile=full --bulk=36
# --profile=empty  — только пользователь «Альберт Вопилов» (пустые состояния)
```

Сидер откажется работать с портом 5432, не-loopback хостом и базой без `design`/`e2e` в имени. Профиль `full`: 11 комнат (категории, превью, заполненная комната), 12 пользователей, друзья онлайн и офлайн, история просмотров, уведомления, три достижения, около 100 сеансов за 90 дней, сохранённый снимок «Продолжить». `--bulk=N` добавляет N комнат для проверки бесконечной прокрутки.

Вход в dev-режиме: `POST /auth/dev {"displayName":"Альберт Вопилов"}` (нужен `ALLOW_STUB_AUTH=true`).

### Галерея дизайн-системы

`pnpm --filter @lume/web exec vite` и открыть `/__design?style=cinema|gruvbox|telerave&mode=dark|light` (`&modal=1` открывает модалку). Страница есть только в режиме `development` и исключена из `vite build`.

> Ловушка: корневой `.env` задаёт `NODE_ENV=development`. Поэтому проверка «это dev» в коде идёт через `import.meta.env.MODE`, а не `import.meta.env.DEV`.

### Остановка

```bash
docker rm -f -v lume-design-pg lume-design-redis
```
