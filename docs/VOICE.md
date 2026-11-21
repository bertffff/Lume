# Голос

Голос идёт через **LiveKit Cloud**. Процесс API только выпускает токен и, для хоста или мода, вызывает Room Service API. Медиа между браузерами идёт напрямую в LiveKit, не через наш сервер.

## Что задать

В `.env`, без кавычек-секретов в репозитории:

- `LIVEKIT_URL` — websocket проекта, обычно `wss://<project>.livekit.cloud`
- `LIVEKIT_API_KEY`
- `LIVEKIT_API_SECRET`

Пока любого из трёх нет, `GET /voice/livekit` отвечает `{ "enabled": false }`, а панель пишет, что голос выключен. `POST /voice/livekit/token` отвечает `503 livekit_disabled`.

## Токен

Запрос требует JWT комнаты. Identity — id пользователя, имя — display name, комната LiveKit — `lume_<roomId>`.

Гранты: `roomJoin`, `canPublish`, `canSubscribe`, `canPublishData`. `roomAdmin` клиенту не выдаётся. В metadata всегда `"voice.priority": false`. Право `voice.priority` по-прежнему закрыто и ничего в голосе не меняет.

## Управление

Хост и мод шлют `voice:mute` и `voice:disconnect` в сокет. Realtime вызывает API, API глушит микрофонные треки через `mutePublishedTrack` или снимает участника через `removeParticipant`. Клиент получает `voice:force` и выключает микрофон или выходит из комнаты LiveKit.

Кто в канале, молчит или говорит — hash Redis `lume:room:{id}:voice`. Клиент сообщает это из событий LiveKit (`ActiveSpeakersChanged`, состояние микрофона).

## Как проверить вдвоём

1. Поднять Postgres, Redis, API, realtime и веб, как в README.
2. Задать три переменные LiveKit и перезапустить API.
3. Два браузера, лучше в наушниках, чтобы не было петли.
4. Войти в один зал. В каждом нажать «Войти в голос» и разрешить микрофон. В Telegram Mini App появится системный запрос; переключение своего микрофона даёт haptic.
5. Говорить по очереди. У соседа точка у имени загорается, когда LiveKit отмечает говорящего.
6. «Заглушить всех» или «Отключить от голоса» — только у хоста и мода.

Без ключей Cloud смоук Playwright проверяет только надпись «Голос выключен». Сценарий с реальным звуком пропускается, если `LIVEKIT_URL` не задан.

Свой LiveKit в `docker-compose.yml` оставлен закомментированным. Это не текущий путь: облачные ключи подходят к тому же API, свой сервер можно будет включить позже той же тройкой переменных.

## English

Voice is LiveKit Cloud. The API mints a per-member join token and, for host or mod, mutes or removes participants with the Room Service API. The voice panel stays disabled, in Russian, until `LIVEKIT_URL`, `LIVEKIT_API_KEY`, and `LIVEKIT_API_SECRET` are set. `voice.priority` stays off. Verify with two browsers and headphones. Playwright only checks the disabled copy unless those variables exist.
