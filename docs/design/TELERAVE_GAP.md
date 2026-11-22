# TeleRave-v2 → Lume: разрывы пользовательских функций

Read-only аудит. Ничего не менялось, сборки не запускались.
Старый проект: `/home/korebit/Applications/Telerave-v2`. Новый: `/home/korebit/Applications/Lume`.
Premium, платежи, админка и legacy mediasoup исключены владельцем.
Статус = наличие пользовательского интерфейса, а не только API/сокета.
«Не проверено» ставится там, где доказательств недостаточно.

| Функция | Статус | Ценность | Сложность | Старый код | Доказательство в Lume |
| --- | --- | --- | --- | --- | --- |
| Управление очередью: удалить, переставить, включить конкретный ролик | ЕСТЬ (128c786) | высокая | M | `client/src/components/Player/VideoQueue.tsx:140-155,310-381` | `apps/web/src/design/RoomQueue.tsx:55-60` — только список; `apps/api/src/routes/rooms.ts:395-500` — нет DELETE/reorder; `packages/contracts/src/socket.ts:116` — только `queue:add`/`queue:next` |
| Поиск видео внутри комнаты с добавлением в очередь | НЕТ | высокая | M | `client/src/components/Player/VideoServiceBrowser.tsx`, `VideoQueue.tsx:224,534` | `apps/web/src/design/DesignApp.tsx:459-517` — поиск есть, но только «открыть/копировать»; `RoomQueue.tsx:61-76` — только вставка URL |
| Вход по email+паролю и через Telegram | НЕТ | высокая | S | `client/src/pages/AuthPage.tsx:104-160` | `apps/web/src/design/pages.tsx:525-535` — пароль не отправляется, submit уходит в magic-link; `DesignApp.tsx:530` — кнопка Telegram вызывает `signIn` → `/auth/dev` (`DesignApp.tsx:211-219`) |
| Модерация участника: временный мут с длительностью, бан на сессию/навсегда с причиной | ЧАСТИЧНО | высокая | S | `client/src/components/Room/MembersList.tsx:48-97` | API есть: `apps/api/src/routes/rooms.ts:581` (temp mute), `apps/api/src/routes/social.ts:879-903` (session/permanent/blacklist). UI: `apps/web/src/design/RoomPeople.tsx:29-32` (только mute/kick), `RoomProfileModal.tsx:77` (только blacklist) |
| Чат: ответ на сообщение, закрепление, реакция на сообщение, переход по таймкоду | НЕТ | средняя | M | `client/src/components/Chat/Chat.tsx:79,136-141` | `apps/web/src/design/RoomChat.tsx:87-108` — нет reply/pin/reaction; `apps/api/src/routes/rooms.ts:612-628` — `/pin` без UI; `apps/realtime/src/socket/handlers.ts:423` — `chat:reaction` без отправителя |
| Поделиться комнатой: QR, ссылка с таймкодом, приглашение друга из комнаты | ЧАСТИЧНО | средняя | M | `client/src/components/Room/ShareRoomModal.tsx:25-60`, `client/src/utils/roomQoL.ts:89-107` | `apps/web/src/design/RoomHeader.tsx:28-51` — только копирование ссылки; `RoomPersonalSettings.tsx:41-47` — напоминание фиксировано 30 мин; QR и `?t=` не найдены |
| Каталог: сортировка, плотность, фильтр по источнику, карточка с хостом/LIVE/друзьями/превью очереди | ЧАСТИЧНО | средняя | M | `client/src/pages/BrowseRoomsPage.tsx:76` | `apps/web/src/design/RoomFeed.tsx:29-58` — фильтры all/friends/категории; карточка без хоста, LIVE, друзей и очереди; сортировки/плотности нет |
| Мастер создания: живой предпросмотр, описание, ручной лимит участников | ЧАСТИЧНО | средняя | S | `client/src/pages/CreateRoomPage.tsx:298-311,373-494` | `apps/web/src/design/CreateRoomWizard.tsx:161-243` — нет предпросмотра, описания и ручного лимита (лимит задаёт только пресет) |
| Ручной выбор качества видео | НЕТ | средняя | M | `client/src/components/Player/QualitySelector.tsx` | `apps/web/src/player/` — только адаптеры платформ, выбора качества нет |
| Статистика ведущего: уникальные зрители, топ-видео, совместные часы, топ-участники | НЕТ | средняя | M | `client/src/components/User/HostStatsWidget.tsx:42` | `apps/api/src` — маршрут `host-stats` не найден; в профиле `apps/web/src/design/ProfileView.tsx` блока нет |
| Настройки уведомлений: каналы, тихие часы, матрица событий | НЕТ | средняя | M | `client/src/components/Notifications/NotificationPreferences.tsx:224-467` | `apps/web/src/design/pages.tsx:94` — строка-заглушка; API есть: `apps/api/src/routes/social.ts:792` (`PUT /me/notification-preferences`) |
| Экспорт персональных данных (GDPR) | НЕТ | средняя | S | `client/src/features/AccountSettings/DataExportSection.tsx:22` | API есть: `apps/api/src/routes/social.ts:997` (`POST /me/export`); UI: `apps/web/src/design/pages.tsx:150-152` — только удаление/восстановление |
| Аватары: загрузка, кадрирование, отображение в профиле/друзьях/комнате | НЕТ | средняя | M | `client/src/components/User/AvatarUpload.tsx:35-66` | `apps/web/src/ds/Avatar.tsx:27` — только инициалы; `avatarUrl` в UI не используется (grep по `apps/web/src` пуст) |
| Закрепление достижений (3 слота) | НЕТ | низкая | S | `client/src/components/Achievements/PinnedAchievementSlot.tsx:38-60` | API есть: `apps/api/src/routes/extras.ts:509-525`; UI нет, только текст `apps/web/src/i18n/ru.ts:481` |
| Виджет «поделиться профилем»: QR, копирование, native share | НЕТ | низкая | S | `client/src/components/User/ProfileShareWidget.tsx:14-60` | `apps/web/src/design/ProfileView.tsx` — виджета нет |
| Карточка полноты профиля с действиями | НЕТ | низкая | S | `client/src/pages/ProfilePage.tsx:517-560` | `apps/web/src/design/ProfileView.tsx` — нет |
| Режим низкой пропускной способности | НЕТ | низкая | S | `client/src/components/Room/ShareRoomModal.tsx:225` | в `apps/web/src` не найден |
| Индикатор синхронизации/дрейфа плеера | НЕТ | низкая | S | `client/src/components/Player/SyncIndicator.tsx` | `apps/web/src/design/RoomStage.tsx:116` — только статус play/pause; коррекция дрейфа есть в `apps/web/src/player/useFollowSync.ts:51-73` |
| Сохранённая очередь / избранное на главной | ЧАСТИЧНО | низкая | S | `client/src/pages/HomePage.tsx:500` | избранное только в профиле: `apps/web/src/design/pages.tsx:446-450`; на главной нет |
| Запоминание настроек комнаты по умолчанию | ЧАСТИЧНО | низкая | S | `client/src/pages/CreateRoomPage.tsx:67-77` | `apps/web/src/design/CreateRoomWizard.tsx:45-47` — черновик не сохраняется |
| Категории комнат: автоопределение и явный выбор | ЕСТЬ | — | — | `client/src/pages/BrowseRoomsPage.tsx:76` (фильтры) | `apps/web/src/design/CreateRoomWizard.tsx:12,197-208`; `packages/db/prisma/schema.prisma:176-177` |
| Курсорная пагинация каталога | ЕСТЬ | — | — | `client/src/pages/BrowseRoomsPage.tsx` (страницы) | `apps/api/src/routes/rooms.ts:76` (`/rooms/catalog`), `apps/web/src/design/useRoomFeed.ts` |
| Уведомления: поповер, страница, «прочитать всё» | ЕСТЬ | — | — | `client/src/components/Notifications/NotificationPanel.tsx:39` | `apps/web/src/design/NotificationInbox.tsx:46,177-190` |
| Голос: мут, deafen, предпроверка микрофона/сети | ЕСТЬ | — | — | `client/src/components/Room/VoicePreflightModal.tsx`, `VoiceBar.tsx:53` | `apps/web/src/design/RoomVoiceCard.tsx:44-45`, `RoomPersonalSettings.tsx:28-72` |
| Чат: эмодзи, картинки, плавающие реакции, индикатор набора | ЕСТЬ | — | — | `client/src/components/Chat/Chat.tsx`, `EmojiPicker.tsx` | `apps/web/src/design/RoomChat.tsx:37-108` |
| Настройки комнаты ведущего: название, описание, категория, лимит, права, мут-олл, журнал | ЕСТЬ | — | — | `client/src/components/Room/RoomSettings.tsx:30-312` | `apps/web/src/design/RoomSettingsSheet.tsx:138-197` |
| Замена недоступного видео без выхода из комнаты | ЕСТЬ | — | — | `client/src/components/Player/VideoPlayer.tsx` | `apps/web/src/design/RoomStage.tsx:151-200` |
| Вход по ссылке из письма (magic link) | ЕСТЬ | — | — | `client/src/pages/AuthPage.tsx:185-210` | `apps/api/src/routes/extras.ts:560,582`; `apps/web/src/App.tsx:85-92`; `DesignApp.tsx:530` |
