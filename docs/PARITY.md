# Lume — Feature Parity Spec (source: bertffff/Telerave-v2 @ main)

> Tracker for what Lume actually implements: [PARITY_MATRIX.md](./PARITY_MATRIX.md).
> Old RU/EN strings: [legacy-locales](./legacy-locales/).

> Audience: the coding agent building **Lume**, which cannot read the old repo. This file describes everything you need to rebuild.
> Rule from the product owner: **every feature that existed in the old version, even partially, must exist in Lume.** Finish half-done features; don't drop them.
> UX rule: the old UI was judged "too flashy, clunky, AI-looking". Keep the **behaviour** and redesign the **presentation**. Each feature below carries QoL notes.
> Russian UI strings are quoted verbatim. The full old RU/EN locale files are in `./locales/{ru,en}/*.json`, with namespaces: `achievements admin auth chat common landing player room`. The achievement definitions and check logic are in `./achievements.ts`. It is self-contained apart from `prisma`, `logger` and the `AchievementInfo` type.
> The old stack, for reference: Fastify 5 + Socket.io + Prisma/Postgres + Redis + zod + mediasoup + bcrypt/JWT + sharp; React 18 + zustand + i18next + hls.js/dash.js + ReactPlayer; k8s, Prometheus/Grafana, Sentry. Server tests: 34 files and 328 tests, all passing. Client tests: 298 pass and 3 fail (see §7).

Legend for status: **W** = working, **P** = partial, **B** = broken / never wired, **S** = stub or dead code.
Lume priority: **P0** is MVP/launch-blocking, **P1** is needed at launch for parity, **P2** comes after launch but must still land.

---

## 1. Feature inventory

| # | Feature | Old file paths | Behaviour (summary) | Status | Lume prio |
|---|---|---|---|---|---|
| **Auth & account** |||||
| F001 | Email + password register | server/src/routes/index.ts, modules/auth/auth.service.ts, client pages/AuthPage.tsx | Password 8–128 chars with a lowercase letter, an uppercase letter and a digit. displayName 1–100. bcrypt cost 12. Duplicate email returns 409 "Пользователь с таким email уже существует". Fails with 503 if Redis is down in prod. | W | P0 |
| F002 | Email + password login | same | 401 "Неверный email или пароль". Rate limit 20/15 min. | W | P0 |
| F003 | JWT access + rotating refresh tokens | utils/jwt.ts, client utils/apiFetch.ts | Access token lives 30 min, or 7 days if Redis is unavailable ("longLived"). Refresh token lives 7 days in Redis and rotates on every use (the old one is revoked). Refresh checks `deletedAt`. The client auto-refreshes on 401 and logs out if refresh fails. | W | P0 |
| F004 | Logout with server revocation | routes, userStore | Revokes the refresh token. Client logout is non-blocking if the network fails. | W | P0 |
| F005 | Magic-link login | auth.service.ts | 32-byte hex token in Redis with a 15-min TTL, single use. The response is neutral when the email doesn't exist. Link is `${origin}/login?magic=TOKEN`, sent by email. Dev mode returns the link in the response. | P (needs SMTP) | P1 |
| F006 | Telegram Mini App auth (initData HMAC) | utils/telegram.ts, socket `auth` | HMAC-SHA256 with key = HMAC("WebAppData", botToken). Rejects data older than `telegramAuthMaxAgeSec` (300 s) or more than 30 s in the future. timingSafeEqual. Upserts the user by telegramId. | W | P0 |
| F007 | Telegram Login Widget (web) | auth.service.telegramWebLogin, route POST /api/auth/telegram-web-login | Validates widget hash. Creates or finds the user by telegramId. | W | P0 |
| F008 | Link / unlink Telegram to an email account | auth.service link/unlink, features/AccountSettings/TelegramLinkSection.tsx | 409 "Telegram account already linked to another user". Unlink is refused if Telegram is the only auth method. | W | P1 |
| F009 | Linked accounts status | GET /api/auth/linked-accounts | `{hasEmail, hasTelegram, …}` | W | P1 |
| F010 | Dev auth bypass | config ALLOW_DEV_AUTH, getDevUser() | Dev-only fake TG user (id 123456789, "Dev User"). Forbidden in prod. | W | P2 (dev only) |
| F011 | Post-auth redirect to a pending room | App.tsx (sessionStorage `telerave-pending-room`) | A deep link opened while logged out is remembered and resumed after login. | W | P0 |
| F012 | Onboarding (3 steps) | features/Onboarding/{Onboarding.tsx,steps.ts}, PATCH /api/users/:id/onboarding | Shown once, then `onboardingComplete=true`. | W | P1 |
| F013 | GDPR data export (ZIP) | modules/gdpr/*, features/AccountSettings/DataExportSection.tsx | Create a request, then download a ZIP (profile, watch-history, messages, achievements, friends, owned-rooms, README). The request expires after 24 h, after which download returns 410. | W | P1 |
| F014 | Account deletion (soft, 30-day grace) + cron purge | gdpr.service, DeleteAccountModal.tsx, index.ts cron `0 3 * * *` | Body `{confirmation:"DELETE", password?}`. Sets deletedAt and scheduledDeletionAt = now + 30 d. A daily cron hard-deletes. A deletion-status endpoint exists. | W (no "undo" UI) | P1 |
| **Rooms** |||||
| F015 | Create room (3-step wizard + presets) | pages/CreateRoomPage.tsx, socket room:create | Steps: video, access, permissions. Presets: friends (private, 12, chat+voice), public (50, chat+voice), private (6, chat only). None of the presets grant video control. Live preview card. Creation archives your own empty rooms. | W | P0 |
| F016 | Room code (nanoid 8) + join by code | config.room.codeLength, Home quick-join | Quick-join input on Home. `/join/:code` redirects. | W | P0 |
| F017 | Join flow (bans, capacity, state extrapolation) | socket room:join | Checks room bans and the owner's global blacklist. Full room gives "Комната заполнена". Player time is extrapolated as elapsed × rate. The joiner receives chat:history (50), chat:pinned, queue:state and queue:history. System message "X присоединился к комнате". | W | P0 |
| F018 | Permanent host / temporary host / host reclaim | RoomManager, socket join/leave | permanentHostId and originalOwnerId. Someone joining an empty room becomes temporary host. When the permanent host returns they reclaim host with "X вернулся и снова хост комнаты". | W | P0 |
| F019 | Host migration on leave | handleLeaveRoom | A moderator is preferred, otherwise the oldest joinedAt. Playback is paused. Messages: "… теперь хост" and "X покинул комнату". | W | P0 |
| F020 | Empty-room grace (3 min) + resume snapshot | RoomManager, roomResume.ts, GET/POST /api/rooms/resume-last, Home "sessionHub" | An empty room is deleted after 3 min and a snapshot is saved to User.lastRoomSnapshot: video, time, queue, history. Home shows "Продолжить просмотр" with time, queue count and history count. POST recreates the room with a new code, paused and with time clamped. | W | P0 |
| F021 | Room settings (host) | components/Room/RoomSettings.tsx, socket room:update | Title, description, public/private, maxMembers (preset list + "Другое" custom), default viewer permissions (applied to viewers without overrides), hideReactions. Esc closes. | W | P0 |
| F022 | Browse public rooms | pages/BrowseRoomsPage.tsx, GET /api/rooms | Search covers title and host name. Filters: all, live, friends (auth only), youtube, twitch, direct. Sorts: active, newest, capacity. Density: comfortable or compact. Cards show host, current video thumbnail and title, member preview (3), queue preview (2) and source facets. Filter/sort state persists to localStorage. A friends-online summary is shown. | W | P0 |
| F023 | Live rooms carousel + global stats widget | features/Home/LiveRoomsCarousel.tsx, GlobalStatsWidget.tsx, GET /api/stats/global, socket stats:global every 30 s | Animated counters: users online, active rooms, total videos, watch hours. | W (RU hardcoded) | P1 |
| F024 | Share room modal (link, QR, native share, TG deep link, friend invite, watch reminder, low-bandwidth toggle) | components/Room/ShareRoomModal.tsx, utils/roomQoL.buildRoomHandoffLinks | roomUrl and joinUrl with `?t=<sec>&v=<url>`. QR via api.qrserver.com. TG startParam `room_<code>`. Recent friends to invite (room:invite). "Напомнить" reminder (room:watch-reminder). Low-bandwidth toggle. | P (?t/?v are never read on join) | P0 |
| F025 | Room invites to friends | socket room:invite, notification ROOM_INVITE | Friend gets a socket `room:invited` event and a notification. | W | P1 |
| F026 | Watch reminders | socket room:watch-reminder (FF socialRetention) | 5 min to 7 days. Implemented as an in-process setTimeout that fires a SYSTEM notification. | P (lost on restart) | P1 |
| F027 | Resumable room (DB-backed queue/history reload) | RoomManager + RoomQueueItem/RoomHistoryItem | A room recreated from the DB on join reloads its queue and history. | W | P0 |
| F028 | Room layout presets × video aspect | features/RoomLayout/*, components/Room/RoomShell.tsx | Presets `enlarged` and `immersive` × aspect `horizontal` and `vertical`, auto-detected by useVideoAspect. Stored in localStorage `telerave-room-layout-v1`, separately per aspect, and synced across tabs. Animated grid transitions. | P (drag/resize, container queries and Storybook not done) | P0 (owner wants resizable modular blocks) |
| F029 | Mobile room sheet + panel switching | MobileRoomSheet.tsx, utils/roomQoL.getNextRoomPanel | Bottom sheet with tabs chat / members / queue. Esc closes. `getNextRoomPanel` was meant for swipe or keyboard cycling but is never used. | P | P0 |
| F030 | Session dock / room bar / header | SessionDock.tsx, RoomBar.tsx, RoomHeader.tsx, VoiceBar.tsx | Header shows invite and member count. The dock holds voice controls. | W | P0 |
| F031 | Report user/room | components/Room/ReportForm.tsx, POST /api/reports (5/h) | reason ≤500, details ≤2000. At least one target required. | W | P1 |
| **Player & sync** |||||
| F032 | Multi-source playback engine | components/Player/{VideoPlayer,PlayerEngine,EmbedPlayer}.tsx, utils/playbackStrategy.ts | ReactPlayer for embeds, hls.js for HLS, dash.js for DASH, native `<video>` for direct files. Separate audio track for "merge" streams. A per-source fallback step chain (§5.12). | W | P0 |
| F033 | Custom embeds VK + Rutube (postMessage API) | Player/embeds/VKEmbedPlayer.tsx, RutubeEmbedPlayer.tsx | VK `video_ext.php?...&js_api=1&hide_logo=1` with events ready, timeupdate, durationchange, ended, error, buffering, playing. Rutube `play/embed/<id>?controls=false` with events player:ready, timeUpdate, currentTime, durationChange, ended, error, waiting, playing. | W | P0 |
| F034 | Host-authoritative play/pause/seek/rate | socket player:* | Only the host, or a member with canControlVideo, can control playback. Rate range 0.25–4. The UI speed menu offers 0.5, 0.75, 1, 1.25, 1.5 and 2. | W | P0 |
| F035 | Clock sync (NTP-style) | client utils/clockSync.ts, socket sync:ping/pong | See §5.1. | W | P0 |
| F036 | Adaptive drift correction | client hooks/useAdaptiveSync.ts | See §5.2: soft rate nudges, hard seeks, anti-loop, buffer grace. | W | P0 |
| F037 | Host heartbeats | socket player:heartbeat (host, 1 s, event-driven) | Viewers correct against heartbeats. | W | P0 |
| F038 | Sync indicator with trust tiers + manual resync | Player/SyncIndicator.tsx | Tiers waiting, lagging (drift >3 s or hard-seeking), syncing (>150 ms or soft-correcting), synced. Shows latency and host health. "Resync" button appears when lagging. | W | P0 |
| F039 | Buffering / ready states per member | socket player:buffering/buffered/set-ready | room:member-updated toggles isBuffering and isReady. UI strings: "sync.waitingReady", "sync.ready". | P (no server gate such as "start when everyone is ready") | P1 |
| F040 | Vote-skip | socket player:vote-skip | needed = max(1, ceil(members/2)). The host skips instantly. Plays queue[0]. Broadcasts player:skip-votes. | W | P1 |
| F041 | Video URL refresh (expired links) | socket player:refresh-url, utils/urlManager.ts | Manual refresh re-extracts and keeps time and playing state. The proactive refresher (UrlLifecycleManager, 1-min check, refreshes 5 min before expiry) is **never initialised** (`init(io)` is not called). | P/B | P0 |
| F042 | Player error UX with recovery actions | VideoPlayer.tsx error.* keys | Host gets "Обновить ссылку" and "Заменить видео" (inline URL input). Viewers get a hint. "Открыть на платформе". Recovery and incident telemetry sent via player:recovery-action and player:sync-incident. | W | P0 |
| F043 | Tap-gesture zones | VideoPlayer.handleGestureZone | Left, centre and right thirds. Centre tap toggles play/pause. Double tap (<260 ms) on left or right seeks ±10 s with a "seek flash" animation. Host only. Tapping shows the controls. | W | P0 |
| F044 | Custom progress bar (pointer drag), fullscreen, speed menu | VideoPlayer.tsx | Progress uses pointer down and move. requestFullscreen. | W | P0 |
| F045 | Quality selector + network-aware auto quality | Player/QualitySelector.tsx, hooks/useNetworkQuality.ts | Per-viewer quality. Preference stored in localStorage `telerave-preferred-quality`. Network Information API: 2g/slow-2g is poor (≤500 kbps), 3g is fair, otherwise good. Embed quality APIs exist for VK (postMessage), Vimeo and Twitch, but setQuality was never finished for them. | P | P1 |
| F046 | Low-bandwidth mode | roomStore.lowBandwidthMode, FF lowBandwidth | Disables smooth scrolling and animations. Toggled from the Share modal, which is an odd location. | P | P1 |
| F047 | Floating reactions | socket reaction:send → reaction:float, Player/FloatingReactions.tsx | The emoji floats over the video at random x 10–90 %, y 30–70 %. Saved as a Reaction row (feeds achievements and heatmap). The room-level hideReactions setting and the per-user hideOtherReactions preference both suppress it. Quick emojis come from the user profile. | W | P0 |
| F048 | Chat timecode jump | utils/roomQoL.extractFirstTimecodeSeconds, Chat "jumpToTimecode" | Recognises `?t=123`, `mm:ss` and `h:mm:ss` in a message and shows a "Перейти к таймкоду" button. | W | P1 |
| F049 | Sync telemetry → Prometheus + admin timeline | socket player:sync-incident/recovery-action, monitoring | Metrics `telerave_player_sync_incidents_total` and `telerave_player_recovery_actions_total`. The admin room view shows the last 10 incidents. | W | P2 |
| **Video sources** |||||
| F050 | Source detection (25 platforms + direct) | server/src/utils/sourceRegistry.ts | Regex table (§5.11). Direct file extensions: .mp4 .webm .ogg .m3u8 .mpd .mkv .avi .mov | W | P0 |
| F051 | Extractor orchestrator with cache | extractors/orchestrator.ts | Redis `extract:<url>`. TTL = per-source TTL, capped at URL expiry minus 5 min. Negative results cached 300 s. | W | P0 |
| F052 | YouTube InnerTube extractor | extractors/youtube.ts | See §5.13. | W | P0 |
| F053 | VK extractor + cookie rotation | extractors/vk.ts, utils/vkCookieRotator.ts | oEmbed for metadata, then video_ext and m.vk.com HTML scraping for HLS or DASH. Cookie rotation with a 300 s cooldown on failure. | W | P0 |
| F054 | Rutube API + puppeteer fallback | extractors/rutube.ts, rutubePuppeteer.ts | `/api/play/options/<id>` with a yandex referer. A puppeteer fallback can be switched on by flag. | W | P0 |
| F055 | Twitch GQL | extractors/twitch.ts | PlaybackAccessToken persisted query → usher HLS, for both channels and VODs. | W | P1 |
| F056 | Cobalt extractor | extractors/cobalt.ts | Self-hosted Cobalt API, 15 s timeout. Used for 22 sources. | W | P0 |
| F057 | yt-dlp extractor | extractors/ytdlp.ts | `--dump-json --no-download --no-playlist`, prefers avc1. YouTube uses `player_client=android,ios`. Optional quality cap. | W | P0 |
| F058 | Metadata resolver (oEmbed / OG / GQL) | extractors/metadataResolver.ts, utils/metadataFetcher.ts | oEmbed for YouTube, Vimeo, Dailymotion, Facebook, Streamable and SoundCloud. Rutube API. Twitch GQL VideoMetadata. Generic OpenGraph regex fallback. Optional Twitch Helix. | W | P0 |
| F059 | Premium gating for extraction-only sources | orchestrator.resolvePlayback | Without premium, these 13 sources fail with `premium_required` "Платформа X требует Premium для совместного просмотра": tiktok, twitter, instagram, reddit, bilibili, ok, pinterest, snapchat, bluesky, xiaohongshu, newgrounds, tumblr, loom. Premium YouTube is forced to extraction (no ads). | W | P0 (premium design) |
| F060 | Stream proxy (CORS, headers, Range, size cap) | services/StreamProxy.ts, GET /api/video/proxy | Domain allowlist. Per-source Referer, UA and VK Cookie. Range support. 500 MB max, 30 s timeout, 5 redirects. Up to 5 concurrent streams per user. Upstream 403/410 returns 410 + `X-Telerave-Retry`; VK retries first with a rotated cookie. | W | P0 |
| F061 | HLS/DASH proxy + manifest rewrite | services/ManifestRewriter.ts, HlsSegmentCache.ts, GET /api/video/hls-proxy | Rewrites segment, variant and `URI=` lines to go through the proxy. Rutube fix: on non-master playlists, inject `#EXT-X-ENDLIST` and `#EXT-X-PLAYLIST-TYPE:VOD`. Manifests cached in Redis 30 s. Segments "recently served" for 60 s. | W | P0 |
| F062 | CDN offload (S3-compatible) | services/CdnOffload.ts | Has getCdnUrl and uploadToCdn, but **nothing calls them**. | S | P2 |
| F063 | SSRF protection | utils/ssrf.ts, safeFetch.ts | §5.15 | W | P0 |
| F064 | Video search (SearXNG) + service browser | utils/videoExtractor.searchVideos, Player/VideoServiceBrowser.tsx | Search goes to SearXNG `categories=videos, language=ru-RU, safesearch=0`, paginated with "Загрузить ещё". Results tagged with source. The browser also has "Вставить ссылку" with quality pick. | W | P1 |
| F065 | Cobalt services list | GET /api/video/services | Shows the supported platforms list. | W | P2 |
| F066 | Video detect endpoint | POST /api/video/detect | Classifies the URL before adding it. | W | P0 |
| **Queue** |||||
| F067 | Shared queue (add/remove/reorder/play) | socket queue:*, Player/VideoQueue.tsx | Permission-gated (§5.10). Duplicate URL gives "Уже в очереди". Optimistic add, then queue:item-updated with metadata. Autoplays if the host adds while nothing is playing. Drag reorder ("queue.dragHint"). | W | P0 |
| F068 | Queue history + clear history | queue:history, queue:clear-history | Last 50, host can clear. | W | P0 |
| F069 | Queue recommendations (favourites / history / preferred sources) | utils/roomQoL.createQueueRecommendations, GET /api/users/:id/discovery | Dedupes against the queue. Up to 6, each tagged favorite, source or history. The panel is collapsible and its state persisted. | W | P1 |
| F070 | Auto-advance on video end | VideoPlayer.handleVideoEnded | Next item from the queue. | W | P0 |
| **Chat** |||||
| F071 | Real-time chat (text, 500 chars) | components/Chat/Chat.tsx, socket chat:message | Enter sends, Shift+Enter adds a newline. History of 50 on join. | W | P0 |
| F072 | Replies | Message.replyToId | Reply preview, "Отменить ответ". | W | P0 |
| F073 | Image messages | POST /api/upload (≤10 MB jpeg/png/gif/webp) → type "image" | Stored in Telegram storage. Download button. | W | P1 |
| F074 | Message reactions | socket chat:react | Toggle, max 3 emojis per user per message. The UI compacts to 4 visible plus "+N". | W | P0 |
| F075 | Emoji picker (categories, search, recent) | Chat/EmojiPicker.tsx | "emoji.categories.recent", search. | W | P0 |
| F076 | Pinned message | socket chat:pin (host, FF chatComfort) | One pin per room, held in memory only. null unpins. | P (not persisted) | P1 |
| F077 | Typing indicator | socket chat:typing → chat:user-typing | 1/s throttle. | W | P0 |
| F078 | Mentions highlight | utils/roomQoL.shouldHighlightMention | `@username` or `@displayName` highlights the message for the mentioned user. No autocomplete, no notification. | P | P1 |
| F079 | Unread anchor + jump | Chat.tsx (unreadAnchorMessageId, "unread") | Jump to the first unread message. | W | P1 |
| F080 | System messages | socket | Join, leave, host change, mute, slow mode (see strings in §3). | W | P0 |
| F081 | Slow mode | mod:slow-mode, chat:slow-mode | 0–300 s, not applied to hosts. "Включен медленный режим: 1 сообщение в N сек." / "Медленный режим выключен". | W | P1 |
| **Moderation** |||||
| F082 | Per-member permissions + room defaults | mod:permissions, RoomMember perms, defaultViewerPermissions | Six permissions: canChat, canSpeak, canControlVideo, canAddToQueue, canRemoveFromQueue, canReorderQueue. permissionsOverridden protects a member from room default changes. | W | P0 |
| F083 | Make host (transfer) | mod:makeHost | Transfers permanent host if the current host is permanent. Message "X теперь хост". | W | P0 |
| F084 | Kick | mod:kick | mod:kicked, "Участник был исключён хостом". | W | P0 |
| F085 | Ban: session / permanent / blacklist | mod:ban | session lasts the room session (in memory). permanent is a room Ban. blacklist is a global owner Ban (roomId null) applied in all of the owner's rooms. | P (session ban not persisted) | P0 |
| F086 | Mute / temp-mute / unmute early | mod:mute, mod:temp-mute (30 s–24 h), mod:unmute-early | Toggles canChat and canSpeak. "Участник замьючен на …". | W | P1 |
| F087 | Moderation log | mod:get-log, RoomManager modLog | Last 100 entries, memory only. Shown in MembersList ("members.moderation.log"). | P (not persisted) | P1 |
| F088 | Member action sheet | MembersList.tsx | View profile, add friend, manage rights, make host, kick, session ban, ban, blacklist, report. Each action has a description line. | W | P0 |
| F089 | Blacklist management | GET/POST /api/users/:id/blacklist(/remove) | Lists global bans and lets you remove them. | W | P1 |
| F090 | Moderation presets | FF moderationPresets | Flag exists; presets show up in the create wizard. | P | P2 |
| **Voice** |||||
| F091 | Voice chat (mediasoup SFU, opus) | server/src/voice/mediasoupManager.ts, hooks/useVoiceChat.ts | Workers = min(CPUs, …) with RTC ports 40000–40100 split between them. Opus 48 kHz, 128 kbps max incoming. Producing needs canSpeak. | W | P1 |
| F092 | Voice preflight | Room/VoicePreflightModal.tsx (FF voicePreflight) | Mic and speaker device pickers, mic test level, network score good/fair/poor (classifyNetworkPreflight). Errors: micError, joinError, changeDeviceError. | W | P1 |
| F093 | Voice mute broadcast + VoiceSession tracking | voice:mute → voice:user-muted, VoiceSession model | Session duration feeds engagement totalVoiceSeconds. | W | P1 |
| F094 | Active-speaker indicator | types voice:speaker / voice:signal | Declared, never implemented. | S | P1 |
| F095 | TURN/STUN ICE config | GET /api/ice-servers | Google STUN + turn/turns. | W | P1 |
| **Social** |||||
| F096 | Friends (request / accept / remove / status) | /api/users/:id/friends/*, legacy /api/friends/* | Notifications FRIEND_REQUEST and FRIEND_ACCEPTED. Statuses none, friends, pending, incoming. | W (duplicate APIs) | P0 |
| F097 | Friend presence + "friend is in room" | socket friend:presence, friend:in-room | Online/offline, current room code. | W | P0 |
| F098 | Top friends | GET /api/users/:id/top-friends | Sum of WatchSession duration per partner. | W | P1 |
| F099 | Watch sessions (pairwise co-watch time) | handleLeaveRoom → WatchSession | Recorded only when the user stayed more than 30 s. Written on leave. | W | P1 |
| F100 | Watch history | WatchHistory, GET /api/users/:id/watch-history | Upserted for all members on every video change. Has watchCount and lastWatchedAt. Respects privacy. | W | P0 |
| F101 | Favourite videos | GET /api/users/:id/favorite-videos | Ordered by watchCount. | W | P1 |
| F102 | Discovery feed | GET /api/users/:id/discovery?source= | Top 3 sources, merges favourites, source picks and history, tags a reason. | W | P1 |
| F103 | Public profile + privacy flags | GET /api/users/profile/:id, PrivacySection.tsx | Flags isFriendsPublic, isFavoriteVideosPublic, isTopFriendsPublic, isWatchHistoryPublic, showUsername (+currentActivity.isVisible). | W | P0 |
| F104 | Bio (≤100) + current activity card | PATCH /api/users/me, CurrentActivityCard.tsx | Shows "Сейчас смотрит" with room, video and thumbnail. | W (RU hardcoded) | P1 |
| F105 | Avatar upload with crop | POST /api/upload/avatar, User/AvatarUpload.tsx | cropX, cropY and cropSize, converted by sharp to 512² webp at q85 and stored in Telegram storage. Rate limit 1/min. | W | P1 |
| F106 | Profile share widget (QR, copy, native share, TG deep link) | User/ProfileShareWidget.tsx | `https://t.me/<bot>?startapp=user_<userId>`. | P (the startapp `user_` prefix is not routed, see §6.4) | P1 |
| F107 | User profile modal (in-room) | User/UserProfileModal.tsx | Esc closes. Add friend, report. | W | P0 |
| **Gamification & stats** |||||
| F108 | 10 achievements + XP + levels | server/src/achievements/index.ts | §5.8 | P (only checked on join, server-time hours) | P1 |
| F109 | Achievement pin slots (3) | PATCH /api/users/me/achievements/:id/pin, PinnedAchievementSlot.tsx | Run as a transaction. Custom tooltip. | W | P1 |
| F110 | Activity heatmap | GET /api/users/:id/activity-heatmap, HeatmapWidget.tsx | Daily score = watchSeconds + 30·messages + 5·reactions. Default range 365 days, max 2 years. | W | P1 |
| F111 | Platforms chart | GET /api/users/:id/platforms, PlatformsChart.tsx | Top 8 sources. Bar chart (a donut was planned). | W | P2 |
| F112 | Engagement widget | GET /api/users/:id/engagement | Messages, reactions, voice seconds. | W | P2 |
| F113 | Host stats widget | GET /api/users/:id/host-stats, HostStatsWidget.tsx | Rooms hosted, unique viewers, top 5 videos, shared hours, top 5 participants. | W | P2 |
| F114 | Leaderboards / stats | GET /api/stats | Top 5 watchers, top 5 party-goers. | W (no UI found besides admin) | P2 |
| **Notifications** |||||
| F115 | In-app notifications (panel, unread badge) | modules/notifications/*, components/Notifications/* | Socket notification:new and notification:unread-count. Mark read / mark all read. Clicking navigates by type (friend → profile, invite → room). | W | P0 |
| F116 | Telegram bot notifications | channels/telegram.channel.ts | Bot sendMessage to telegramId. On by default. | W | P1 |
| F117 | Email notifications | channels/email.channel.ts (nodemailer SMTP) | Off by default. | W (needs SMTP) | P2 |
| F118 | Web push | channels/push.channel.ts (web-push VAPID), hooks/useNotifications.ts | The client subscribes through `navigator.serviceWorker.ready`, but **no service worker is ever registered**, so push never arrives. | B | P2 |
| F119 | Per-channel × per-type preferences | NotificationPreference, NotificationPreferences.tsx | Grid of 4 channels × 6 types. | W | P1 |
| F120 | Digest (instant/hourly/daily) + quiet hours + timezone | deliveryPreferences.ts, dispatcher.processDueDigestDeliveries, cron */15 | §5.9 | W | P2 |
| F121 | Digest preview | GET /api/notifications/digest-preview | | W | P2 |
| **Admin & ops** |||||
| F122 | Admin dashboard | features/Admin/AdminDashboard.tsx, GET /api/admin/stats | Users by role and platform totals. | W | P1 |
| F123 | Admin users (search, role filter, role change, ban/unban) | AdminUsers.tsx | Role change is SUPERADMIN only. Role cache in Redis is invalidated on change. | W | P1 |
| F124 | Admin rooms (list, detail with session timeline, delete, force close) | AdminRooms.tsx | Timeline: sync incidents, member joins, queue adds, reports, moderation actions. Force close only sets isActive=false and **does not kick live sockets**. | P | P1 |
| F125 | Admin reports (list, filter, resolve/dismiss with resolution) | AdminReports.tsx | | W | P1 |
| F126 | Audit log | AuditLog model, AdminAuditLog.tsx | Actions: user:role-change, user:ban, user:unban, room:delete, room:force-close, report:resolve. Filterable by admin, action and targetType. | W | P1 |
| F127 | Admin deep links | routes /admin/:entity/:targetId, ?tab=&target= | | W | P2 |
| F128 | Health / liveness / readiness | /api/health, /live, /ready | 503 when the DB is down. | W | P0 |
| F129 | Prometheus metrics | modules/monitoring, /metrics (token) | http duration/total, sockets active, socket events, active rooms, errors, player recovery/incidents. | W | P1 |
| F130 | Rate limiting (HTTP + socket, Redis sliding window) | utils/rateLimiter.ts | Redis ZSET with a 1 s window and an in-memory fallback. | W | P0 |
| F131 | Feature flags | config.featureFlags (FF_*), client store/featureFlags | smartQueue, voicePreflight, chatComfort, moderationPresets, lowBandwidth, socialRetention. All on by default. | W | P1 |
| F132 | Themes (dark / standard / light) | store/themeStore.ts (`telerave-theme`) | Default `standard`. | W | P0 (owner wants unique themes) |
| F133 | i18n RU/EN | client/public/locales | 8 namespaces. Many components still had hardcoded RU strings. | P | P0 |
| F134 | Landing page | features/Landing/HeroSection.tsx, LandingPage | Shown to logged-out visitors at `/`. | W | P0 |
| F135 | Home "session hub" | pages/HomePage.tsx | Greeting, level, quick join, resume, create, browse, social block (friends online, "Сейчас смотрят", invite via TG, recent, saved), stats. | W | P0 |
| F136 | Telegram storage for uploads | utils/telegramStorage.ts | Uploads photos to a bot chat topic; getFileUrl. | W | P1 (replace with S3 in Lume, keep as an option) |
| F137 | P2P segment mesh (WebRTC + service worker) | client/src/sw/{p2pMesh,useP2P,p2pServiceWorker}.ts, socket p2p:* | Server relays signalling and filters private IPs. The client code is **never imported or registered**. | S | P2 |

**Total: 137 features.**

---

## 2. REST API (old, all under `/api`)

Auth column: **pub** = no auth. **auth** = Bearer JWT. **owner** = `:userId` must equal the caller (ownerMiddleware). **admin** = ADMIN or SUPERADMIN. **super** = SUPERADMIN only.
Validation used zod everywhere. Errors come back as `{error: string}`, often in Russian. Rate limits are per IP or user per window.

### 2.1 Health / infra
| Method | Path | Auth | Request → Response | Behaviour |
|---|---|---|---|---|
| GET | /api/health | pub | → `{status, timestamp, uptime, version, dependencies:{database, redis}, stats}` | 503 if the DB is down |
| GET | /api/health/live | pub | → 200 | k8s liveness |
| GET | /api/health/ready | pub | → 200/503 | k8s readiness |
| GET | /api/ice-servers | auth | → `{iceServers:[stun google, turn:host:3478, turns:host:5349 + username/credential]}` | TURN credential comes from env |
| GET | /metrics | metrics token | Prometheus text | §1 F129 |

### 2.2 Auth
| Method | Path | Auth | Request → Response | Behaviour |
|---|---|---|---|---|
| POST | /api/auth/register | pub, 10/15 min | `{email, password, displayName}` → `{token, refreshToken, user}` | Rules in F001. Email normalised. 409 on duplicate. 503 if Redis is down in prod. |
| POST | /api/auth/login | pub, 20/15 min | `{email, password}` → same | 401 "Неверный email или пароль". Refused if deletedAt is set. |
| POST | /api/auth/magic-link | pub, 5/15 min | `{email}` → `{ok:true[, magicLink in dev]}` | Neutral response. Uses the `Origin` header to build the link. |
| POST | /api/auth/magic-link/verify | pub | `{token}` (32–256 chars) → auth response | Single use. 401 "Invalid or expired magic link". |
| GET | /api/auth/me | auth | → user + achievements + isPremium + role | |
| POST | /api/auth/refresh | pub, 30/15 min | `{refreshToken}` → `{token, refreshToken}` | Rotation: the old token is revoked. Refused if the user is soft-deleted. |
| POST | /api/auth/logout | auth | `{refreshToken}` → `{ok}` | Revokes the token |
| POST | /api/auth/link-telegram | auth | `{initData}` → user | 400 on invalid initData, 409 if the Telegram account is already linked |
| POST | /api/auth/unlink-telegram | auth | → user | 400 if Telegram is the only auth method |
| GET | /api/auth/linked-accounts | auth | → `{hasEmail, hasTelegram, email, username}` | |
| POST | /api/auth/telegram-web-login | pub, 20/15 min | Login Widget fields `{id, first_name, last_name?, username?, photo_url?, auth_date, hash}` → auth response | Creates the user if missing |

### 2.3 Rooms
| Method | Path | Auth | Request → Response | Behaviour |
|---|---|---|---|---|
| GET | /api/rooms?page&limit(≤50)&search | pub | → `{rooms:[{…room, hostName, hostAvatar, currentVideo{title, thumbnail, source}, memberCount, memberPreview[3], queuePreview[2]}], total, sourceFacets}` | Public active rooms only. Search matches title or owner name (case-insensitive). The current video falls back to the last history item. |
| GET | /api/rooms/:code | pub | → room + onlineCount + members | |
| GET | /api/rooms/resume-last | auth | → `{available, snapshot:{title, videoTitle, thumbnail, currentTime, queueCount, historyCount, savedAt}}` | |
| POST | /api/rooms/resume-last | auth | → `{code}` | Recreates the room with a new code. The video is re-processed, isPlaying=false, time clamped to duration, queue and history recreated with new ids. The snapshot is then cleared. |

### 2.4 Users, profile, social
| Method | Path | Auth | Request → Response | Behaviour |
|---|---|---|---|---|
| GET | /api/users/profile/:id | pub (privacy filtered) | → profile incl. privacy flags, quickReaction, quickEmojis, defaultViewerPermissions, hideOtherReactions, bio, currentActivity{roomCode, roomTitle, videoTitle, videoThumbnail, isVisible}, achievements, totalAchievements (hardcoded 10) | |
| GET | /api/users/:telegramId | pub | → user by telegramId | legacy |
| PATCH | /api/users/me | auth | `{bio≤100?, displayName≤100?}` | |
| PATCH | /api/users/:userId/settings | owner | `{isFriendsPublic?, isFavoriteVideosPublic?, isTopFriendsPublic?, isWatchHistoryPublic?, showUsername?, quickReaction(≤4 chars)?, quickEmojis(1–10)?, defaultViewerPermissions?, hideOtherReactions?}` | Feeds ProfileSettings (RoomDefaultsSection, PrivacySection) |
| PATCH | /api/users/:userId/onboarding | owner | `{complete:true}` | |
| GET | /api/users/:userId/watch-history?limit≤100&offset | pub if isWatchHistoryPublic, else owner | → items | |
| GET | /api/users/:userId/favorite-videos | same | ordered by watchCount | |
| GET | /api/users/:userId/discovery?source=a,b | auth | → items tagged with a `reason` | Top 3 sources. Merges favourites, source picks and history; deduped by URL. |
| GET | /api/users/:userId/top-friends | pub | → `[{user, totalSeconds}]` | Sum of WatchSession per partner |
| GET | /api/users/:userId/friends?requesterId | pub if isFriendsPublic | → friends with isOnline and currentRoomCode | ⚠ requesterId comes from the query and can be spoofed |
| GET | /api/users/:userId/requests | owner | incoming pending requests | |
| POST | /api/users/:userId/friends/request | owner | `{targetId}` | Errors 'Blocked', 'Already friends', 'Request exists'. Emits socket friend:request and notification FRIEND_REQUEST. |
| POST | /api/users/:userId/friends/accept | owner | `{requesterId}` | Emits friend:accepted and FRIEND_ACCEPTED |
| POST | /api/users/:userId/friends/remove | owner | `{friendId}` | |
| GET | /api/users/:userId/friend-status/:targetId | auth | → `none|friends|pending|incoming` | |
| GET | /api/users/:userId/blacklist | owner | global bans (roomId null) | |
| POST | /api/users/:userId/blacklist/remove | owner | `{bannedUserId}` | |
| POST | /api/friends/request, /accept, /reject; DELETE /api/friends/:id; GET /api/friends/:telegramId | auth | legacy duplicate of the above (IDOR checked) | **Lume: provide one friends API only** |
| GET | /api/users/:id/achievements | pub | → `{unlocked:[{key, title, description, icon, xpReward, unlockedAt, pinSlot}], totalXp, level, nextLevelXp = level*500}` | |
| PATCH | /api/users/me/achievements/:achievementId/pin | auth | `{slot:1|2|3|null}` | Transaction: frees the slot, then assigns it |
| GET | /api/users/:id/activity-heatmap?from&to | pub | → `[{date, score, watchSeconds, messages, reactions}]` | Max range 2 years, default 365 days |
| GET | /api/users/:id/platforms | pub | top 8 sources with counts | |
| GET | /api/users/:id/engagement | pub | `{totalMessages, totalReactions, totalVoiceSeconds}` | |
| GET | /api/users/:id/host-stats | pub | `{hasHostData, roomsHosted, uniqueViewers, topVideos[5], sharedHours, topParticipants[5]}` | |

### 2.5 Video
| Method | Path | Auth | Request → Response | Behaviour |
|---|---|---|---|---|
| POST | /api/video/detect | pub, 30/min | `{url}` → `{source, videoId, playbackType, supported, premiumRequired?}` | |
| GET | /api/video/extract?url&quality | auth, 20/min | → ExtractResult `{url, audioUrl?, streamType, expiresAt, title, thumbnail, duration, author}` | Goes through the orchestrator |
| GET | /api/video/search?q&page | auth, 30/min | → `{results:[{title, url, thumbnail, description, source, duration, publishedDate}], query, page}` | SearXNG. Returns an empty list on failure. |
| GET | /api/video/proxy?url | auth, 60/min | byte stream | Allowlist, Range, `Cache-Control: max-age=1800`. 410 + `X-Telerave-Retry: true` when the source is dead. |
| GET | /api/video/hls-proxy?url&source | auth, 300/min | rewritten manifest or segment | Manifest via Redis cache (30 s, `X-Cache: HIT|MISS`). Manifest max-age 60 for VK, 5 otherwise. Segments max-age 300, or 600 if recently served. 410 on a dead source, 504 on timeout, 502 otherwise. |
| GET | /api/video/services | pub | Cobalt services + version | |

### 2.6 Stats, uploads, reports
| Method | Path | Auth | Request → Response |
|---|---|---|---|
| GET | /api/stats | auth | totals, live, last 24 h, top 5 watchers, top 5 party-goers |
| GET | /api/stats/global | pub (cached 30 s) | `{usersOnline, activeRooms, totalVideos, totalWatchHours}` |
| POST | /api/upload/avatar | auth, 1/min | multipart file (jpeg/png/webp ≤5 MB) + cropX, cropY, cropSize → `{avatarUrl}`. Uses sharp to make a 512×512 webp at q85. |
| POST | /api/upload | auth | multipart (jpeg/png/gif/webp ≤10 MB) → `{url}`. Error: "Неподдерживаемый формат. Используйте JPEG, PNG, GIF или WebP" |
| POST | /api/reports | auth, 5/h | `{targetUserId?, targetRoomId?, reason 1–500, details ≤2000}`. At least one target is required. |

### 2.7 GDPR
| Method | Path | Auth | Behaviour |
|---|---|---|---|
| POST | /api/users/:userId/gdpr/export | owner | 201 → `{id, status, expiresAt}`. Expires in 24 h. |
| GET | /api/users/:userId/gdpr/export/:exportId/download | owner | Streams a ZIP (archiver, zlib 6) containing profile.json, watch-history.json, messages.json, achievements.json, friends.json, owned-rooms.json and README.json. File name `telerave-data-YYYY-MM-DD.zip`. 410 "Export link has expired. Please request a new export." |
| DELETE | /api/users/:userId/account | owner | `{confirmation:"DELETE", password?}`. The password is checked if the user has one (401 on mismatch). Soft delete: deletedAt=now, scheduledDeletionAt=now+30 d. |
| GET | /api/users/:userId/account/deletion-status | auth | `{deletedAt, scheduledDeletionAt}` |
Cron: `0 3 * * *` runs purgeExpiredDeletions (hard delete in a transaction) and expireOldExportRequests.

### 2.8 Notifications (`/api/notifications`, auth)
| Method | Path | Behaviour |
|---|---|---|
| GET | / ?page&limit&unreadOnly | list |
| GET | /unread-count | `{count}` |
| GET | /digest-preview | the pending queued deliveries rendered as a digest |
| PATCH | /:id/read | |
| POST | /read-all | |
| GET/PUT | /preferences | `[{channel, eventType, enabled}]`. Defaults: IN_APP on, TELEGRAM on, EMAIL off, PUSH off |
| GET/PUT | /delivery-preferences | `{digest:INSTANT|HOURLY|DAILY, quietHoursEnabled, quietStart:"22:00", quietEnd:"08:00", timezone:"UTC"}` |
| POST/DELETE | /push-subscribe | `{endpoint, keys:{p256dh, auth}}` |
Cron `*/15 * * * *` runs processDueDigestDeliveries.

### 2.9 Admin (`/api/admin`, every route uses authMiddleware + requireAdmin; role cached in Redis `admin:role:<id>`)
| Method | Path | Notes |
|---|---|---|
| GET | /stats | platform stats incl. usersByRole |
| GET | /users?page&limit≤100&search≤200&role&sortBy&order | |
| GET | /users/:id | detail + timeline-like recent activity |
| PATCH | /users/:id/role | **super**. `{role}`. Audit `user:role-change`. Invalidates the role cache. |
| POST | /users/:id/ban | `{type: session|permanent|blacklist, reason 1–500, roomId?}`. Audit `user:ban`. |
| DELETE | /bans/:banId | Audit `user:unban` |
| GET | /rooms?search&isActive | |
| GET | /rooms/:id | detail + playbackIncidents (last 10 from memory) + last 5 audit logs + `sessionTimeline` (types sync-incident, member-joined, queue-added, report-opened, moderation-action) |
| DELETE | /rooms/:id | Audit `room:delete` |
| POST | /rooms/:id/close | Sets isActive=false. Audit `room:force-close`. ⚠ does not disconnect live members. |
| GET | /reports?status | |
| GET | /reports/:id | |
| PATCH | /reports/:id | `{status: RESOLVED|DISMISSED, resolution 1–1000}`. Audit `report:resolve`. |
| GET | /audit-logs?adminId&action&targetType | |

---

## 3. Socket.io events

Transport: Socket.io. Auth happens via the `auth` event after connect: a JWT ("Bearer x" in the `initData` field), raw Telegram initData, or dev auth. Server keeps `userSocketMap` userId → socketId (⚠ a single socket per user).
Rate limits are events per second per socket (Redis sliding window). Payloads are zod-validated; invalid input is silently ignored.

### 3.1 Client → Server
| Event | Payload | Limit | Permission | Behaviour |
|---|---|---|---|---|
| auth | `{user}` + initData/JWT; ack `AuthResponse` | 3 | — | Validates and upserts the TG user. Sets userSocketMap. Emits friend:presence (online) to friends and notification:unread-count to self. |
| room:create | `{title, description?, isPublic, videoUrl?, videoSource?, maxMembers?}`; ack room | 1 | auth | Leaves the current room, archives the user's empty rooms into a snapshot, creates the room in the DB and in memory. The host gets all permissions. Processes the video. totalParties++ |
| room:join | `{roomCode}`; ack `{success, error?}` | 1 | auth, not banned | See F017/F018. Emits room:joined, room:member-joined, chat:history, chat:pinned, queue:state, queue:history and a system message. Runs the achievement check (may emit achievement:unlocked). Emits friend:presence and friend:in-room to friends. |
| room:leave | — | — | member | handleLeaveRoom (WatchSessions, totalWatchTime, host migration, system msg) |
| room:update | `{title?, description?, isPublic?, maxMembers?, defaultViewerPermissions?, hideReactions?}`; ack | — | host | Broadcasts room:updated. New defaults apply to members without overrides. |
| room:invite | `{userId, roomCode}`; ack | — | member | Sends room:invited to the target + ROOM_INVITE notification |
| room:watch-reminder | `{roomCode, delayMinutes 5..10080, title?}`; ack | — | auth, FF socialRetention | setTimeout → SYSTEM notification |
| player:play / pause / seek | `{currentTime}` | 3 | host or canControlVideo | Updates state with updatedAt and updatedBy. Broadcasts `{currentTime, timestamp}` plus a heartbeat. |
| player:rate | `{rate 0.25–4}` | — | same | broadcast |
| player:change-video | `{videoUrl, videoSource?, recovery?}` | 2 | same | processVideoUrl with the user's premium flag. Resets ready/buffering. Upserts WatchHistory for all members. Pushes the previous video to history. Broadcasts player:video-changed. Tracks the URL expiry. |
| player:refresh-url | `{originalUrl?, forceExtraction?, recovery?}` | 2 | any member | Invalidates the cache and re-extracts. Skipped for embeds unless forceExtraction. Keeps time and playing state. |
| player:sync-request | — | 2 | member | → player:state (extrapolated) |
| player:heartbeat | `{currentTime, playbackRate, isPlaying}` | 3 | host only | → player:heartbeat `{serverTime, currentTime, playbackRate, isPlaying, hostId}` to the room |
| player:buffering / buffered | `{currentTime}` | 5 | member | Sets member isBuffering, or isBuffering=false + isReady=true. room:member-updated. Relays player:buffering/buffered `{userId}`. |
| player:set-ready | `{isReady}` | 5 | member | room:member-updated |
| player:vote-skip | — | 2 | member | §5.3 |
| player:recovery-action / sync-incident | telemetry | 5 / 6 | member | metrics + incident ring buffer |
| queue:add | `{url, title?}`; ack | 2 | canAddToQueue | Rejects duplicates with "Уже в очереди". Optimistic queue:added, then async metadata → queue:item-updated. Persisted to the DB. Autoplays if the host adds while idle. |
| queue:remove | `{id}` | 3 | canRemoveFromQueue (or host) | queue:removed |
| queue:reorder | `{order: id[]}` | — | host or canReorderQueue | queue:state |
| queue:play | `{id}` | — | host | plays the item now |
| queue:clear-history | — | — | host | queue:history [] |
| chat:message | `{content ≤500, replyToId?, type?: text|image, imageUrl?}` | 5 | canChat, not temp-muted, slow mode for non-hosts | Persists, then broadcasts chat:message (with replyTo preview). Slow-mode violators get chat:slow-mode `{interval}` back. |
| chat:react | `{messageId, emoji}` | 2 | member | Toggle. Max 3 distinct emojis per user per message. Broadcasts chat:message-reaction `{messageId, reactions:[{emoji, count, userIds}]}`. |
| chat:pin | `{messageId|null}` | 2 | host, FF chatComfort | chat:pinned (in memory) |
| chat:typing | — | 1 | member | chat:user-typing `{userId, displayName}` to others |
| reaction:send | `{emoji}` | 2 | member | Saves a Reaction row. reaction:float `{id, emoji, userId, x:10–90, y:30–70}`. |
| voice:join | ack `{rtpCapabilities}` | — | member | Creates a VoiceSession row and the router. Broadcasts voice:user-joined. |
| voice:create-transport / connect-transport | mediasoup params; ack | — | in voice | WebRTC transports |
| voice:produce | `{kind, rtpParameters}`; ack `{id}` | — | canSpeak | Broadcasts voice:new-producer `{peerId, producerId}` |
| voice:consume / get-producers | ack | — | in voice | |
| voice:mute | `{muted}` | — | in voice | voice:user-muted |
| voice:leave | — | — | in voice | Closes the VoiceSession (duration). voice:user-left. |
| mod:permissions | `{userId, permissions: Partial<MemberPermissions>}` | — | host | Sets permissionsOverridden=true. room:member-updated. Logged. |
| mod:makeHost | `{userId}` | — | host | System message "X теперь хост" |
| mod:kick | `{userId}` | — | host | mod:kicked to the target, which is disconnected from the room. "Участник был исключён хостом". |
| mod:ban | `{userId, type: session|permanent|blacklist, reason?}` | — | host | mod:banned, then kick |
| mod:mute | `{userId, muted}` | — | host | Toggles canChat and canSpeak. mod:muted. |
| mod:temp-mute | `{userId, duration 30..86400 s, reason?}` | — | host | mod:temp-muted `{expiresAt}`. "Участник замьючен на …". Auto-unmutes. |
| mod:unmute-early | `{userId}` | — | host | mod:unmuted |
| mod:slow-mode | `{interval 0..300}` | — | host | mod:slow-mode-changed + system message |
| mod:get-log | ack `[{id, action, moderatorId, targetId?, reason?, details?, timestamp}]` | — | host | last 100 |
| sync:ping | `{clientTime}` | — | any | sync:pong `{clientTime, serverTime}` |
| p2p:offer / answer / ice-candidate / have-segment | relay | — | member | p2p:peer-has-segment. ICE candidates with private IPs are filtered. Client never wired. |
| notification:mark-read / mark-all-read / subscribe-push / unsubscribe-push | see types | — | auth | |
| disconnect | — | — | — | handleLeaveRoom + friend:presence offline |

### 3.2 Server → Client
`room:joined, room:member-joined, room:member-left, room:members, room:member-updated, room:updated, room:state, room:error, player:state, player:play|pause|seek {currentTime, timestamp}, player:rate, player:video-changed {videoUrl, videoSource, originalUrl, originalSource, audioUrl, streamType, expiresAt, playbackType: embed|direct|extraction, platform, videoId, embedUrl, isPlaying, duration, title, thumbnail, author, error, errorMessage}, player:heartbeat, player:buffering, player:buffered, player:skip-votes {votes, needed}, queue:state, queue:added, queue:item-updated, queue:removed, queue:history, queue:error {error}, chat:message, chat:history, chat:user-typing, chat:message-reaction, chat:pinned, chat:slow-mode, reaction:float, voice:user-joined|left|muted, voice:new-producer, voice:signal (unused), voice:speaker (unused), mod:kicked|banned|muted|temp-muted|unmuted|slow-mode-changed, friend:request, friend:accepted, friend:in-room, friend:presence, room:invited, sync:pong, achievement:unlocked, notification:new, notification:unread-count, stats:global (broadcast every 30 s)`.

Key shapes:
- `MemberPermissions {canChat, canSpeak, canControlVideo, canAddToQueue, canRemoveFromQueue, canReorderQueue}`
- `PlayerState {videoUrl, videoSource, originalUrl?, originalSource?, audioUrl?, streamType?: direct|hls|dash|merge, expiresAt?, playbackType?, platform?, videoId?, embedUrl?, isPlaying, currentTime, playbackRate, duration, updatedAt, updatedBy, title?, thumbnail?, author?, error?, errorMessage?}`
- `RoomMemberInfo {userId, displayName, avatarUrl, role: host|moderator|viewer, permissions, permissionsOverridden, isBuffering, isReady, isMuted, joinedAt}`
- `QueueItem {id, url, title, thumbnail, duration, source, author, addedBy, addedByName, position}`
- `ChatMessage {id, content, type: text|image|system, userId, displayName, avatarUrl, createdAt, imageUrl?, replyToId?, replyTo?{id, content, displayName, type}, reactions?}`

System message strings (verbatim RU): "X присоединился к комнате", "X покинул комнату", "X теперь хост", "X вернулся и снова хост комнаты", "Участник был исключён хостом", "Участник замьючен на …", "Включен медленный режим: 1 сообщение в N сек.", "Медленный режим выключен". Errors: "Комната заполнена", "Уже в очереди", "Не удалось загрузить следующее видео".

---

## 4. Data model (old Prisma schema, comments stripped, verbatim otherwise)

Notes for Lume:
- You may redesign the schema, but every field below represents a feature that must survive.
- Add what was missing: persisted pins, persisted mod log/kicks, session bans with expiry, a scheduled-jobs table for reminders, and Premium/cosmetics entitlements.
- `Room.maxMembers` defaults to 50 in the DB, while the runtime config default is 100. Pick one.

```prisma
generator client {
  provider = "prisma-client-js"
}
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
model User {
  id                       String                   @id @default(cuid())
  telegramId               BigInt?                  @unique
  username                 String?
  displayName              String
  avatarUrl                String?
  level                    Int                      @default(1)
  xp                       Int                      @default(0)
  totalWatchTime           Int                      @default(0)
  totalParties             Int                      @default(0)
  createdAt                DateTime                 @default(now())
  updatedAt                DateTime                 @updatedAt
  isFriendsPublic          Boolean                  @default(true)
  isFavoriteVideosPublic   Boolean                  @default(true)
  isTopFriendsPublic       Boolean                  @default(true)
  isWatchHistoryPublic     Boolean                  @default(true)
  showUsername             Boolean                  @default(false)
  defaultViewerPermissions Json?
  hideOtherReactions       Boolean                  @default(false)
  quickEmojis              Json                     @default("[\"👍\", \"❤️\", \"😂\", \"😮\", \"😢\", \"🔥\"]")
  quickReaction            String                   @default("❤️")
  isPremium                Boolean                  @default(false)
  email                    String?                  @unique
  passwordHash             String?
  role                     Role                     @default(USER)
  deletedAt                DateTime?
  scheduledDeletionAt      DateTime?
  onboardingComplete       Boolean                  @default(false)
  bio                      String?                  @db.VarChar(100)
  currentRoomCode          String?
  lastRoomSnapshot         Json?
  lastRoomSnapshotAt       DateTime?
  auditLogs                AuditLog[]
  receivedBans             Ban[]                    @relation("BannedUser")
  issuedBans               Ban[]                    @relation("BanOwner")
  dataExportRequests       DataExportRequest[]
  receivedFriendRequests   Friendship[]             @relation("FriendshipAddressee")
  sentFriendRequests       Friendship[]             @relation("FriendshipRequester")
  messageReactions         MessageReaction[]
  messages                 Message[]
  notificationDelivery     NotificationDeliveryPreference?
  notificationDeliveryQueue NotificationDeliveryQueue[]
  notificationPreferences  NotificationPreference[]
  notifications            Notification[]
  pushSubscriptions        PushSubscription[]
  reactions                Reaction[]
  submittedReports         Report[]                 @relation("ReportReporter")
  resolvedReports          Report[]                 @relation("ReportResolver")
  targetedReports          Report[]                 @relation("ReportTargetUser")
  roomMembers              RoomMember[]
  hostedRooms              Room[]                   @relation("RoomHost")
  ownedRooms               Room[]                   @relation("RoomOwner")
  achievements             UserAchievement[]
  watchHistory             WatchHistory[]
  partnerSessions          WatchSession[]           @relation("WatchSessionPartner")
  watchSessions            WatchSession[]           @relation("WatchSessionUser")
  voiceSessions            VoiceSession[]
  @@index([telegramId])
  @@index([scheduledDeletionAt])
  @@map("users")
}
model Room {
  id                       String            @id @default(cuid())
  code                     String            @unique
  title                    String
  description              String?
  isPublic                 Boolean           @default(true)
  maxMembers               Int               @default(50)
  videoUrl                 String?
  videoSource              String?
  isActive                 Boolean           @default(true)
  createdAt                DateTime          @default(now())
  updatedAt                DateTime          @updatedAt
  ownerId                  String
  hostId                   String?
  defaultViewerPermissions Json?
  hideReactions            Boolean           @default(false)
  messages                 Message[]
  reactions                Reaction[]
  reports                  Report[]          @relation("ReportTargetRoom")
  roomHistory              RoomHistoryItem[]
  members                  RoomMember[]
  queueItems               RoomQueueItem[]
  host                     User?             @relation("RoomHost", fields: [hostId], references: [id])
  owner                    User              @relation("RoomOwner", fields: [ownerId], references: [id])
  watchHistory             WatchHistory[]
  watchSessions            WatchSession[]
  @@index([code])
  @@index([isPublic, isActive])
  @@map("rooms")
}
model RoomMember {
  id       String   @id @default(cuid())
  role     String   @default("viewer")
  joinedAt DateTime @default(now())
  userId   String
  roomId   String
  room     Room     @relation(fields: [roomId], references: [id], onDelete: Cascade)
  user     User     @relation(fields: [userId], references: [id])
  @@unique([userId, roomId])
  @@map("room_members")
}
model VoiceSession {
  id             String    @id @default(cuid())
  userId         String
  roomCode       String
  startedAt      DateTime  @default(now())
  endedAt        DateTime?
  durationSeconds Int      @default(0)
  user           User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@index([userId, startedAt])
  @@index([roomCode])
  @@map("voice_sessions")
}
model Message {
  id               String            @id @default(cuid())
  content          String
  type             String            @default("text")
  createdAt        DateTime          @default(now())
  userId           String
  roomId           String
  imageUrl         String?
  replyToId        String?
  messageReactions MessageReaction[]
  replyTo          Message?          @relation("MessageReplies", fields: [replyToId], references: [id])
  replies          Message[]         @relation("MessageReplies")
  room             Room              @relation(fields: [roomId], references: [id], onDelete: Cascade)
  user             User              @relation(fields: [userId], references: [id])
  @@index([roomId, createdAt])
  @@map("messages")
}
model MessageReaction {
  id        String   @id @default(cuid())
  emoji     String
  createdAt DateTime @default(now())
  messageId String
  userId    String
  message   Message  @relation(fields: [messageId], references: [id], onDelete: Cascade)
  user      User     @relation(fields: [userId], references: [id])
  @@unique([messageId, userId, emoji])
  @@map("message_reactions")
}
model Reaction {
  id        String   @id @default(cuid())
  emoji     String
  createdAt DateTime @default(now())
  userId    String
  roomId    String
  room      Room     @relation(fields: [roomId], references: [id], onDelete: Cascade)
  user      User     @relation(fields: [userId], references: [id])
  @@map("reactions")
}
model Achievement {
  id          String            @id @default(cuid())
  key         String            @unique
  title       String
  description String
  icon        String
  xpReward    Int               @default(50)
  condition   String
  users       UserAchievement[]
  @@map("achievements")
}
model UserAchievement {
  id            String      @id @default(cuid())
  unlockedAt    DateTime    @default(now())
  userId        String
  achievementId String
  pinSlot       Int?
  achievement   Achievement @relation(fields: [achievementId], references: [id])
  user          User        @relation(fields: [userId], references: [id])
  @@unique([userId, achievementId])
  @@map("user_achievements")
}
model Friendship {
  id          String   @id @default(cuid())
  status      String   @default("pending")
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  requesterId String
  addresseeId String
  addressee   User     @relation("FriendshipAddressee", fields: [addresseeId], references: [id])
  requester   User     @relation("FriendshipRequester", fields: [requesterId], references: [id])
  @@unique([requesterId, addresseeId])
  @@map("friendships")
}
model Ban {
  id           String   @id @default(cuid())
  type         String   @default("session")
  reason       String?
  roomId       String?
  createdAt    DateTime @default(now())
  ownerId      String
  bannedUserId String
  bannedUser   User     @relation("BannedUser", fields: [bannedUserId], references: [id])
  owner        User     @relation("BanOwner", fields: [ownerId], references: [id])
  @@unique([ownerId, bannedUserId, roomId])
  @@map("bans")
}
model WatchHistory {
  id            String   @id @default(cuid())
  videoUrl      String
  title         String?
  thumbnail     String?
  source        String?
  author        String?
  duration      Int?
  watchCount    Int      @default(1)
  lastWatchedAt DateTime @default(now())
  createdAt     DateTime @default(now())
  userId        String
  roomId        String?
  room          Room?    @relation(fields: [roomId], references: [id])
  user          User     @relation(fields: [userId], references: [id])
  @@unique([userId, videoUrl])
  @@index([userId, lastWatchedAt])
  @@map("watch_history")
}
model WatchSession {
  id            String   @id @default(cuid())
  watchDuration Int      @default(0)
  sessionDate   DateTime @default(now())
  userId        String
  partnerId     String
  roomId        String?
  partner       User     @relation("WatchSessionPartner", fields: [partnerId], references: [id])
  room          Room?    @relation(fields: [roomId], references: [id])
  user          User     @relation("WatchSessionUser", fields: [userId], references: [id])
  @@index([userId, partnerId])
  @@map("watch_sessions")
}
model RoomQueueItem {
  id          String   @id @default(cuid())
  url         String
  title       String?
  thumbnail   String?
  author      String?
  duration    Int?
  source      String
  addedBy     String
  addedByName String
  position    Int      @default(0)
  createdAt   DateTime @default(now())
  roomId      String
  room        Room     @relation(fields: [roomId], references: [id], onDelete: Cascade)
  @@index([roomId, position])
  @@map("room_queue_items")
}
model RoomHistoryItem {
  id          String   @id @default(cuid())
  url         String
  title       String?
  thumbnail   String?
  author      String?
  duration    Int?
  source      String
  addedBy     String
  addedByName String
  watchedAt   DateTime @default(now())
  roomId      String
  room        Room     @relation(fields: [roomId], references: [id], onDelete: Cascade)
  @@index([roomId, watchedAt])
  @@map("room_history_items")
}
model DataExportRequest {
  id            String       @id @default(cuid())
  status        ExportStatus @default(PENDING)
  downloadToken String       @unique @default(cuid())
  filePath      String?
  createdAt     DateTime     @default(now())
  expiresAt     DateTime
  userId        String
  user          User         @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@index([userId, status])
  @@index([expiresAt])
  @@map("data_export_requests")
}
model Report {
  id           String       @id @default(cuid())
  reason       String
  details      String?
  status       ReportStatus @default(OPEN)
  resolution   String?
  resolvedAt   DateTime?
  createdAt    DateTime     @default(now())
  updatedAt    DateTime     @updatedAt
  reporterId   String
  targetUserId String?
  targetRoomId String?
  resolvedById String?
  reporter     User         @relation("ReportReporter", fields: [reporterId], references: [id])
  resolvedBy   User?        @relation("ReportResolver", fields: [resolvedById], references: [id])
  targetRoom   Room?        @relation("ReportTargetRoom", fields: [targetRoomId], references: [id])
  targetUser   User?        @relation("ReportTargetUser", fields: [targetUserId], references: [id])
  @@index([status])
  @@index([reporterId])
  @@map("reports")
}
model AuditLog {
  id         String   @id @default(cuid())
  action     String
  targetType String
  targetId   String
  details    Json?
  createdAt  DateTime @default(now())
  adminId    String
  admin      User     @relation(fields: [adminId], references: [id])
  @@index([adminId])
  @@index([action])
  @@index([createdAt])
  @@map("audit_logs")
}
model Notification {
  id        String              @id @default(cuid())
  type      NotificationType
  title     String
  body      String
  data      Json?
  channel   NotificationChannel @default(IN_APP)
  isRead    Boolean             @default(false)
  createdAt DateTime            @default(now())
  userId    String
  deliveryQueue NotificationDeliveryQueue[]
  user      User                @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@index([userId, isRead])
  @@index([userId, createdAt])
  @@map("notifications")
}
model PushSubscription {
  id        String   @id @default(cuid())
  endpoint  String
  keys      Json
  createdAt DateTime @default(now())
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@unique([userId, endpoint])
  @@map("push_subscriptions")
}
model NotificationPreference {
  id        String              @id @default(cuid())
  channel   NotificationChannel
  eventType NotificationType
  enabled   Boolean             @default(true)
  userId    String
  user      User                @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@unique([userId, channel, eventType])
  @@map("notification_preferences")
}
model NotificationDeliveryPreference {
  id                String             @id @default(cuid())
  digest            NotificationDigest @default(INSTANT)
  quietHoursEnabled Boolean            @default(false)
  quietStart        String             @default("22:00")
  quietEnd          String             @default("08:00")
  timezone          String             @default("UTC")
  updatedAt         DateTime           @updatedAt
  userId            String             @unique
  user              User               @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@map("notification_delivery_preferences")
}
model NotificationDeliveryQueue {
  id             String                     @id @default(cuid())
  channel        NotificationChannel
  eventType      NotificationType
  status         NotificationDeliveryStatus @default(PENDING)
  scheduledFor   DateTime
  attempts       Int                        @default(0)
  lastError      String?
  createdAt      DateTime                   @default(now())
  updatedAt      DateTime                   @updatedAt
  userId         String
  notificationId String
  user           User                       @relation(fields: [userId], references: [id], onDelete: Cascade)
  notification   Notification               @relation(fields: [notificationId], references: [id], onDelete: Cascade)
  @@index([status, scheduledFor])
  @@index([userId])
  @@unique([notificationId, channel])
  @@map("notification_delivery_queue")
}
enum ExportStatus {
  PENDING
  PROCESSING
  READY
  EXPIRED
  FAILED
}
enum Role {
  USER
  ADMIN
  SUPERADMIN
}
enum ReportStatus {
  OPEN
  REVIEWING
  RESOLVED
  DISMISSED
}
enum NotificationChannel {
  IN_APP
  PUSH
  EMAIL
  TELEGRAM
}
enum NotificationDigest {
  INSTANT
  HOURLY
  DAILY
}
enum NotificationDeliveryStatus {
  PENDING
  SENT
  FAILED
}
enum NotificationType {
  FRIEND_REQUEST
  FRIEND_ACCEPTED
  ROOM_INVITE
  ACHIEVEMENT_UNLOCKED
  SYSTEM
  MOD_ACTION
}
```

Enums summary: `Role {USER, ADMIN, SUPERADMIN}`; `ExportStatus {PENDING, PROCESSING, READY, EXPIRED, FAILED}`; `ReportStatus {OPEN, REVIEWING, RESOLVED, DISMISSED}`; `NotificationChannel {IN_APP, PUSH, EMAIL, TELEGRAM}`; `NotificationDigest {INSTANT, HOURLY, DAILY}`; `NotificationDeliveryStatus {PENDING, SENT, FAILED}`; `NotificationType {FRIEND_REQUEST, FRIEND_ACCEPTED, ROOM_INVITE, ACHIEVEMENT_UNLOCKED, SYSTEM, MOD_ACTION}`. String enums held in plain columns: `Friendship.status pending|accepted|blocked`, `Ban.type session|permanent|blacklist`, `Message.type text|image|system`, `RoomMember.role host|moderator|viewer`.

In-memory only (not in the DB): room runtime state (members, playerState, permissions, pinned message, slow mode, temp mutes, mod log, skip votes). It was mirrored to Redis `room:state:<code>` with a 10-min TTL but never read back as the source of truth.

---

## 5. Algorithms and business rules

### 5.1 Clock sync (client `utils/clockSync.ts`)
- Each round sends 5 `sync:ping {clientTime=t1}` samples, 200 ms apart, with a 3 s timeout per sample. On pong `{clientTime, serverTime=t2}` at t4: `offset = ((t2 - t1) + (t2 - t4)) / 2` (t3 = t2) and `rtt = t4 - t1`.
- The round's offset is the median of its samples. Keep a window of the last 10 round offsets; the effective offset is the median of the window.
- RTT is smoothed with an EWMA: `rtt = (rtt*9 + new)/10`.
- Recalibrate every 60 s. `serverNow() = Date.now() + offset`.
- **Lume**: keep this. Also recalibrate on `visibilitychange` and on network change.

### 5.2 Adaptive drift correction (client `hooks/useAdaptiveSync.ts`, viewers only)
- **Expected position.** `expected = hb.currentTime + (serverNow - hb.serverTime)/1000 * hb.playbackRate` if playing, otherwise `hb.currentTime`. `drift = local - expected`, smoothed as the median of the last 3 samples.
- **Thresholds.** Soft correction starts at 150 ms (1000 ms for embeds). Hard seek at 1500 ms for HLS/direct and 3000 ms for embeds; the hard-seek threshold drops to 500 ms during the first 10 s after load.
- **Soft correction** sets playbackRate to 0.98/1.02 if |drift| < 500 ms, 0.96/1.04 if < 1500 ms, otherwise 0.95/1.05, for 5 s, then restores the host rate.
- **Hard seek.** Skipped if the target is not buffered (wait instead). Anti-loop: at most 2 seeks in 8 s around the same target (±3 s), after which status becomes `waiting`.
- **Buffer grace.** No corrections for 5 s after buffering.
- **Statuses:** `synced | soft-correcting | hard-seeking | waiting`.
- **Telemetry and UI.** Incident telemetry (player:sync-incident) is deduped per 500 ms drift bucket for 15 s. UI updates are throttled to 500 ms. A forced resync runs 300 ms after the player becomes ready.

### 5.3 Vote-skip
- `needed = max(1, ceil(memberCount/2))`. The host's vote skips immediately.
- Votes are one per user per video, held in memory and reset on video change.
- On success the server plays `queue[0]` (removing it from the queue). Every vote broadcasts `player:skip-votes {votes, needed}`.
- **Lume QoL**: show a progress pill ("2/3 за пропуск"), let a user withdraw their vote, and let the host disable vote-skip in settings.

### 5.4 Ready-check / buffering
- Members report `player:buffering`, `player:buffered` (which sets isReady=true) and `player:set-ready {isReady}`. The server only relays these states; nothing gates playback.
- The UI shows "sync.waitingReady" / "sync.ready" and buffering markers in the members list.
- **Lume should finish it**: (a) host option "ждать всех" pauses automatically when anyone has been buffering for more than N s and resumes once all are ready; (b) an explicit "Ready check" button with a 10 s countdown.

### 5.5 Slow mode
- Room interval 0–300 s, where 0 means off; the host is exempt.
- Implemented with the rate limiter: key `slow-mode:<code>:<userId>`, 1 message per interval.
- A violation sends `chat:slow-mode {interval}` to the sender only. Changes broadcast `mod:slow-mode-changed` plus a system message.
- **Lume**: show a countdown in the composer and persist the setting on the room.

### 5.6 Typing
- `chat:typing` is limited to 1/s and relayed to others as `{userId, displayName}`.
- The client shows "X печатает…" and hides it after ~3 s with no new event.
- **Lume**: collapse multiple typers ("Аня и ещё 2 печатают").

### 5.7 Pinned messages / reactions / replies / images / floating reactions
- **Pin.** One per room, host only, behind flag chatComfort. Stored in memory, sent on join, unpinned with null. **Lume**: persist `Room.pinnedMessageId`, let moderators pin, and click the pin to jump to the message.
- **Message reactions.** Toggle. At most 3 distinct emojis per user per message (DB unique on message+user+emoji). Aggregated as `{emoji, count, userIds}`. The UI sorts by count then emoji, shows 4 and collapses the rest into "+N".
- **Replies.** `replyToId` is a self relation. The broadcast includes `replyTo {id, content, displayName, type}`. Clicking the preview should scroll to the original.
- **Images.** Upload via POST /api/upload (≤10 MB, jpeg/png/gif/webp), then `chat:message {type:'image', imageUrl}`. Lightbox and download in the UI.
- **Floating reactions.** `reaction:send {emoji}` (2/s) saves a Reaction row, then broadcasts `reaction:float {id, emoji, userId, x∈[10,90]%, y∈[30,70]%}`, which animates over the player.
  - Hidden when `room.hideReactions` is set (room-wide) or the viewer has `user.hideOtherReactions` set (own reactions still show).
  - The quick bar uses `user.quickEmojis` (default `👍❤️😂😮😢🔥`, 1–10 items). `user.quickReaction` (default ❤️) is the one-tap or double-click reaction.
- **Mentions.** `@username` or `@displayName` (word-bounded) highlights the message for the mentioned user. **Lume should add**: @-autocomplete and a mention notification.
- **Timecodes.** `?t=N`, `h:mm:ss` or `mm:ss` in text shows a "Перейти к таймкоду" button (seek for the host, a local preview hint for viewers).

### 5.8 Achievements (10) and levels
Defined in `./achievements.ts`. Checks run on **room:join only**. Unlocking adds xpReward to user.xp, recomputes `level = floor(xp/500)+1`, emits `achievement:unlocked` and sends an ACHIEVEMENT_UNLOCKED notification. `nextLevelXp = level*500`.

| key | title (RU) | XP | condition |
|---|---|---|---|
| first_party | 🎉 Первая вечеринка | 50 | totalParties ≥ 1 |
| party_animal | 🦁 Тусовщик | 200 | totalParties ≥ 10 |
| party_legend | 👑 Легенда вечеринок | 1000 | totalParties ≥ 100 |
| night_watch | 🌙 Ночной дозор | 100 | join between 00:00 and 04:59 **server** time |
| marathon | 🏃 Марафонец | 300 | totalWatchTime ≥ 18 000 s (5 h) |
| binge_watcher | 📺 Запойный зритель | 500 | totalWatchTime ≥ 86 400 s (24 h) |
| social_butterfly | 🦋 Душа компании | 150 | ≥ 100 messages sent |
| host_master | 🎬 Мастер хост | 250 | ≥ 10 rooms owned |
| early_bird | 🐦 Ранняя пташка | 100 | join between 05:00 and 06:59 server time |
| reaction_king | 😂 Король реакций | 100 | ≥ 50 floating reactions sent |

Lume fixes:
- Evaluate on the relevant event (message sent, reaction, leave, room created), not only on join.
- Use the user's timezone, taken from the client or the delivery preferences.
- Compute totalAchievements dynamically.
- Show a toast and a confetti-free subtle animation on unlock.

### 5.9 Notifications
- **Types:** FRIEND_REQUEST, FRIEND_ACCEPTED, ROOM_INVITE, ACHIEVEMENT_UNLOCKED, SYSTEM (reminders and digests), MOD_ACTION.
- **Channels:**
  - IN_APP: socket `notification:new` + `notification:unread-count`, on by default.
  - TELEGRAM: bot `sendMessage` to telegramId, on by default.
  - EMAIL: nodemailer SMTP, off by default.
  - PUSH: web-push VAPID, off by default.
- **Preferences:** one row per (user, channel, eventType) with an `enabled` flag.
- **Dispatch** (`dispatch(userId, type, title, body, data)`):
  1. For each channel, decide: `skip` if the channel is disabled; `send` for IN_APP; otherwise `queue` if digest ≠ INSTANT or quiet hours are active, else `send`.
  2. Create the Notification row.
  3. Enqueue queued channels into NotificationDeliveryQueue (unique notification+channel) with `scheduledFor`.
  4. Send the rest in parallel with allSettled.
- **Next attempt:** DAILY → +24 h at the top of the hour. HOURLY, or currently in quiet hours → next full hour. Otherwise → +15 min.
- **Quiet hours:** `HH:MM` start and end in the user's IANA timezone (via Intl). Supports wrapping past midnight (22:00–08:00).
- **Digest cron** (every 15 min, up to 100 due items):
  1. Group by user+channel.
  2. If still in quiet hours, reschedule.
  3. Re-check that the channel is still enabled; mark FAILED if not.
  4. Build the digest. A single item is sent as-is. Several items become title `"TeleRave digest: N updates"`, with a body listing the top 3 types with counts plus the last 5 "- title: body" lines. Data: `{digest:true, count, notificationIds, channel}`.
  5. Mark SENT, or FAILED with lastError.
- **Client:** bell with an unread badge and a panel. Clicking navigates: FRIEND_* and ACHIEVEMENT go to /profile, ROOM_INVITE goes to /room/:code (or /browse), MOD_ACTION goes to /browse. Mark all read. Preferences grid + digest/quiet-hours form.

### 5.10 Moderation permission matrix
| Action | Host | Moderator* | Viewer (default) |
|---|---|---|---|
| play/pause/seek/rate/change video | ✅ | via canControlVideo | ❌ (canControlVideo default false) |
| refresh broken URL | ✅ | ✅ | ✅ |
| queue add | ✅ | canAddToQueue | per room defaults |
| queue remove | ✅ | canRemoveFromQueue | per room defaults |
| queue reorder | ✅ | canReorderQueue | per room defaults |
| queue play now / clear history | ✅ | ❌ | ❌ |
| chat | ✅ (exempt from slow mode) | canChat | canChat |
| speak in voice | ✅ | canSpeak | canSpeak |
| pin message | ✅ | ❌ | ❌ |
| room settings | ✅ | ❌ | ❌ |
| kick/ban/mute/temp-mute/slow-mode/permissions/make host/mod log | ✅ | ❌ | ❌ |
| vote skip, react, float reaction, invite, report | ✅ | ✅ | ✅ |

\*`moderator` exists as a role in types and is preferred during host migration, but **nothing ever assigns it**. **Lume**: add "Сделать модератором" and give moderators kick, temp-mute, pin, queue management and slow mode, but not ban, settings or host transfer.

Ban semantics:
- `session` lasts until the room is gone and lives only in memory.
- `permanent` is a DB Ban with this roomId.
- `blacklist` is a DB Ban with roomId=null and owner=host. It blocks the user from **all** rooms owned by that host. Listed under Profile → blacklist, where it can be removed.

Temp-mute is 30 s to 24 h with auto-unmute and `mod:temp-muted {expiresAt}`. Kick removes the member and emits `mod:kicked`.

### 5.11 Source registry (detection, extractor chains, cache TTL, embed support)
| Source | URL patterns (regex) | Extractor chain | Cache TTL | Embed? | Extraction-only (Premium) |
|---|---|---|---|---|---|
| youtube | `youtube.com/(watch?v=|embed/|v/|shorts/|live/)`, `youtu.be/`, `youtube-nocookie.com/embed/` | innertube → cobalt → ytdlp | 5 h | ✅ ReactPlayer | — (Premium forces extraction for no ads) |
| vk | `vk.com/video`, `vkvideo.ru`, `vk.com/clip` | cobalt → vk-api → ytdlp | 24 h | ✅ custom `video_ext.php?oid&id&hd=2&js_api=1&no_controls=1` | — |
| rutube | `rutube.ru/(video|play/embed|shorts)/` | rutube-api → cobalt → ytdlp → rutube-puppeteer | 2 h | ✅ custom `play/embed/<id>?controls=false` (but extraction preferred) | — |
| twitch | `twitch.tv/` | ytdlp → twitch-gql | 1 h | ✅ `player.twitch.tv/?video=v<id>|channel=<name>&parent=APP_DOMAIN` | — |
| vimeo | `vimeo.com/(video/)?\d+` | cobalt → ytdlp | 2 h | ✅ | — |
| dailymotion | `dailymotion.com/video/`, `dai.ly/` | cobalt → ytdlp | 1 h | ✅ (extraction preferred) | — |
| facebook | `facebook.com/(watch|reel)/`, `fb.watch/`, `facebook.com/*/videos/` | cobalt → ytdlp | 1 h | ✅ (original URL) | — |
| streamable | `streamable.com/` | cobalt → ytdlp | 1 h | ✅ | — |
| soundcloud | `soundcloud.com/*/*` | cobalt → ytdlp | 1 h | ✅ (audio-only) | — |
| tiktok | `tiktok.com/@*/video/`, `tiktok.com/t/`, `vm.tiktok.com/` | cobalt → ytdlp | 30 min | ❌ | ✅ |
| twitter | `(twitter|x).com/*/status/` | cobalt → ytdlp | 30 min | ❌ | ✅ |
| instagram | `instagram.com/(p|reel|reels|tv)/` | cobalt → ytdlp | 30 min | ❌ | ✅ |
| reddit | `reddit.com/r/*/comments/`, `redd.it/` | cobalt → ytdlp | 1 h | ❌ | ✅ |
| bilibili | `bilibili.com/video/`, `b23.tv/` | cobalt → ytdlp | 1 h | ❌ | ✅ |
| ok | `ok.ru/video/` | cobalt → ytdlp | 1 h | ❌ | ✅ |
| pinterest | `pinterest.com/pin/` | cobalt → ytdlp | 30 min | ❌ | ✅ |
| snapchat | `snapchat.com/(spotlight|add)/`, `t.snapchat.com/` | cobalt → ytdlp | 30 min | ❌ | ✅ |
| bluesky | `bsky.app/profile/*/post/` | cobalt → ytdlp | 30 min | ❌ | ✅ |
| xiaohongshu | `xiaohongshu.com/(explore|discovery/item)/`, `xhslink.com/` | cobalt → ytdlp | 30 min | ❌ | ✅ |
| newgrounds | `newgrounds.com/(portal/view|audio/listen)/` | cobalt → ytdlp | 1 h | ❌ | ✅ |
| tumblr | `tumblr.com/post/`, `*.tumblr.com/` | cobalt → ytdlp | 1 h | ❌ | ✅ |
| loom | `loom.com/share/` | cobalt → ytdlp | 1 h | ❌ | ✅ |
| direct | path ends in .mp4 .webm .ogg .m3u8 .mpd .mkv .avi .mov | — (proxied) | — | native | — |

Each source also has a per-source RU error message, e.g. "Видео с YouTube не загружается. Возможно, оно ограничено по возрасту или региону.", "Видео с VK не загружается. Видео может быть приватным.", "Стрим или видео с Twitch недоступны.", "Видео с TikTok не загружается. Попробуйте обновить ссылку.", "Видео с Instagram не загружается. Возможно, контент приватный." Capabilities per source: syncControl, seekable, qualitySelection (YouTube, VK, Rutube, Twitch, Vimeo), audioOnly (SoundCloud), liveSupport (YouTube, Rutube, Twitch, Facebook).

### 5.12 Playback resolution (`orchestrator.resolvePlayback`) + client fallback chain
Server:
1. Direct URL: hls/dash goes to `/api/video/hls-proxy`, mp4 etc. to `/api/video/proxy`. playbackType `direct`.
2. YouTube + Premium: force extraction (innertube → ytdlp → cobalt). If the age-restriction check is terminal, return an error.
3. If the source supports embeds and is not rutube or dailymotion, return playbackType `embed` with embedUrl, videoId and metadata from the resolver.
4. If the source is extraction-only and the user is not Premium, return error `premium_required` "Платформа X требует Premium для совместного просмотра".
5. Otherwise extract via the chain. Twitch HLS is wrapped in hls-proxy. The result carries url, audioUrl?, streamType, expiresAt.
6. When the extractor returns a generic title such as "Video" or the domain, fall back to the metadata resolver.

Client step chain per source (`utils/playbackStrategy.ts`):
- youtube, vimeo, dailymotion, facebook, streamable: reactplayer → reextract → error.
- soundcloud: reactplayer → reextract → audio-only.
- vk: native → hls → reextract.
- rutube, twitch: hls → reextract.
- extraction-only sources: reextract.
- direct: native → hls → proxy.
- unknown: native → proxy → error.
- The step is overridden by playbackType embed, direct or extraction.
- "reextract" emits `player:refresh-url {forceExtraction:true}`.

### 5.13 Extractors, per platform
- **YouTube InnerTube** (`https://www.youtube.com/youtubei/v1/player`):
  - **signatureTimestamp.** Scraped from base.js: fetch the youtube.com homepage, find the base.js URL, parse `signatureTimestamp`. Cached 6 h, fallback 20080.
  - **Bypass strategies, tried in order:**
    1. ANDROID 19.29.37 with `params:'CgIQBg=='`.
    2. TVHTML5_SIMPLY_EMBEDDED_PLAYER 2.0 with `clientScreen:'WATCH'` and `thirdParty.embedUrl`.
    3. IOS 19.29.1.
    4. WEB (current version), only when the reason contains CHECK_REQUIRED.
    5. WEB_CREATOR + auth.
    - Every request sends `contentCheckOk` and `racyCheckOk`.
  - **Playability.** Valid: OK, LIVE_STREAM_OFFLINE. Unlockable (try the next strategy): AGE_VERIFICATION_REQUIRED, AGE_CHECK_REQUIRED, CONTENT_CHECK_REQUIRED, LOGIN_REQUIRED, UNPLAYABLE.
  - **Headers:** X-YouTube-Client-Name/Version, Origin/Referer youtube.com.
  - **Stream choice.** Prefer a progressive mp4 (avc1). Otherwise use adaptive video+audio ("merge": the client plays separate audio in sync), or HLS for live.
  - **Cache.** Results cached in memory for 5 min.
- **VK.**
  1. `vk.com/video_oembed.json` for metadata.
  2. `video_ext.php?oid&id` HTML: regex `"hls":"…"` → proxied HLS. `"dash_(uni|sep)":"…"` → DASH. Also mp4_NNN.
  3. Fallback to `m.vk.com/video<oid>_<id>`.
  - Cookie jar rotation from env (several cookies; reportFailure / reportSuccess with a 300 s cooldown).
  - cobalt is first in the chain so VK works without cookies.
- **Rutube.** `rutube.ru/api/video/<id>/?format=json` for metadata, then `api/play/options/<id>/?no_404=true&referer=https://yandex.ru` with a yandex Referer gives `video_balancer.m3u8`. The manifest rewriter adds VOD markers. Puppeteer fallback: headless Chromium opens `rutube.ru/video/<id>/` and sniffs the m3u8 (flag-gated).
- **Twitch GQL.** POST `gql.twitch.tv/gql` with the public web Client-ID and persisted query `PlaybackAccessToken` (sha256 `ed230aa1…0c02`), which returns a token and signature. Then `usher.ttvnw.net/api/channel/hls/<channel>.m3u8` or `usher.ttvnw.net/vod/<id>.m3u8` with `sig`, `token`, `allow_source` and `p`. Metadata comes from GQL `VideoMetadata`, or from Helix if TWITCH_CLIENT_ID and TWITCH_CLIENT_SECRET are set.
- **Cobalt.** POST to the self-hosted instance (`COBALT_API_URL`, 15 s timeout) and parse the `tunnel`, `redirect` or `picker` response. Negative results cached 5 min. `isAvailable()` health check.
- **yt-dlp.** CLI `--dump-json --no-download --no-warnings --no-playlist --format 'bestvideo[vcodec^=avc1]+bestaudio/best[vcodec^=avc1]/bestvideo+bestaudio/best' --no-check-certificate`. YouTube gets `--extractor-args youtube:player_client=android,ios`. With a quality option, `bestvideo[height<=Q]…`. `--version` is the availability check.

### 5.14 HLS proxy / manifest rewrite
- `rewriteManifest(body, baseUrl, source, proxyEndpoint)` detects HLS vs DASH.
- **HLS:**
  - Every non-comment line (segment or variant playlist) is made absolute against baseUrl and rewritten to `/api/video/hls-proxy?url=<enc>&source=<src>`.
  - `URI="…"` attributes inside tags are rewritten the same way (#EXT-X-KEY, #EXT-X-MAP, #EXT-X-MEDIA).
  - Rutube fix: for non-master playlists, add `#EXT-X-ENDLIST` if it is missing and insert `#EXT-X-PLAYLIST-TYPE:VOD` after the header, so hls.js does not treat a VOD as live.
- **DASH:** rewrites BaseURL and media/initialization templates.
- **Caching:**
  - Manifests are cached in Redis `hls:manifest:<source>:<url>` for 30 s.
  - Segments are marked in `hls:seg:<url>` for 60 s.
  - Cache-Control: manifest max-age 60 for VK, 5 otherwise. Segments 300 s, or 600 s if recently served.
- **Upstream headers:** UA, a per-source Referer/Origin map, and a VK cookie.
- **Errors:** 403/410 upstream returns 410 + `X-Telerave-Retry: true`. The client then calls player:refresh-url. VK retries once with a rotated cookie first.

### 5.15 SSRF protection (`utils/ssrf.ts`, `safeFetch.ts`)
- **Scheme:** only http and https.
- **Blocked hostnames:** localhost, localhost.localdomain, ip6-localhost, ip6-loopback, `*.local`, `*.internal`.
- **Private IPv4:**
  - 127/8, 10/8, 0/8, 169.254/16, 255.255.255.255
  - 172.16–31, 192.168/16, 192.0.0/24, 192.0.2/24, 198.51.100/24, 203.0.113/24, 198.18–19
  - 100.64–127 (CGNAT), ≥224 (multicast/reserved)
- **Private IPv6:** ::1, ::, fe80:, fc/fd (ULA), ff (multicast). `::ffff:a.b.c.d` is unwrapped and checked as IPv4.
- **DNS:** the hostname is resolved and the resolved IP checked too. `safeFetch` pins the resolved IP with an undici Agent dispatcher to stop DNS rebinding, re-validates every redirect (max 5) and enforces a timeout.
- **Allowlist.** Proxy endpoints also require the host to match the CDN allowlist: googlevideo, cdninstagram, twimg, tiktokcdn, fbcdn, scdn.co, streamable, vkuservideo, vk-cdn, userapi, rutube, dmcdn, vimeocdn, akamaized, bilivideo(.com/.cn), redd.it/redditmedia, mycdn.me, tumblr, pinimg, ttvnw, jtvnw, ngfiles/newgrounds, loomcdn/loom, plus the Cobalt instance host.
- P2P ICE candidates with private IPs are dropped server-side.

### 5.16 CDN offload (stub)
- `CDN_ENDPOINT`, `CDN_BUCKET`, `CDN_ACCESS_KEY`, `CDN_SECRET_KEY`, `CDN_REGION`, `CDN_PUBLIC_URL`, `CDN_SIGNED_URL_TTL` (3600).
- `uploadToCdn(originalUrl, buffer, contentType)` PUTs `videos/<sha256(url)[:16]>.<ext>` and caches `cdn:url:<hash>` in Redis. `getCdnUrl` looks it up.
- **Never called.** The S3 SigV4 signing is incomplete (only x-amz-date and content sha headers are set).
- **Lume**: either implement properly (segment caching for popular rooms, behind Premium/infra) or drop it with an explicit decision. Recommended: implement as an optional HLS segment cache on S3/R2.

### 5.17 SearXNG search
- `GET {SEARXNG_URL}/search?q&format=json&categories=videos&pageno&language=ru-RU&safesearch=0` with a 10 s timeout.
- Maps each result to `{title, url, thumbnail|img_src, description=content, source=detectSourceFromUrl(url), duration=length, publishedDate}`. Returns an empty list on any error.
- **Lume**:
  - Make language follow the UI locale.
  - Filter results to supported sources and badge each one as "Embed", "Premium" or "Unsupported".
  - Debounce live search.
  - Show paste-URL detection inline.

### 5.18 Watch history / watch sessions / discovery / top friends
- **WatchHistory** is unique per (user, videoUrl). It is upserted for **every room member** on each `player:change-video` (watchCount++, lastWatchedAt=now, title/thumbnail/source). Favourites = ordered by watchCount.
- **WatchSession** is written on leave when the leaver was in the room for more than 30 s. One row is written per remaining member, as the pair (user→partner) and (partner→user), with `watchDuration` = overlap seconds and `sessionDate`. Top friends = sum(watchDuration) grouped by partner.
- **totalWatchTime** += seconds in the room on leave or disconnect.
- **Discovery:**
  1. Count history by source and take the top 3, or `?source=`.
  2. Build lists: favourites (reason `favorite`), history from those sources (`source`), recent history (`history`).
  3. Dedupe by URL.
- The client uses this for queue recommendations (limit 6, excluding URLs already queued).

### 5.19 Friends discovery / blacklist
- Friend-request guards: Blocked (an existing ban or blocked friendship), Already friends, Request exists.
- Presence: on auth or connect, friends get `friend:presence {isOnline:true, currentRoomCode}`. On join they get `friend:in-room`. On disconnect they get offline.
- Browse → "friends" filter and Home "Сейчас смотрят" use the friends list with isOnline and currentRoomCode.
- Telegram "invite a friend" deep link: `https://t.me/<bot>?startapp=user_<userId>`. **Lume**: route `user_` to a profile/add-friend screen.

### 5.20 Activity heatmap / stats widgets
- Heatmap day score = `watchSeconds + 30*messages + 5*reactions`, aggregated per calendar day (UTC) over WatchHistory/WatchSession, Message and Reaction.
- The client renders a GitHub-style year grid with legend "Меньше … Больше" and a tooltip per day.
- Platforms: top 8 sources by history count.
- Engagement: message count, reaction count, voice seconds summed from VoiceSession.
- Host stats (from rooms owned):
  - roomsHosted.
  - uniqueViewers: distinct RoomMember users excluding the host.
  - topVideos(5): RoomHistoryItem grouped by url.
  - sharedHours: WatchSession where userId=host.
  - topParticipants(5).
  - `hasHostData=false` hides the widget.
- Global stats (cached 30 s and broadcast via socket): usersOnline = userSocketMap size, activeRooms = in-memory rooms, totalVideos = count of WatchHistory rows, totalWatchHours = sum(totalWatchTime)/3600.

### 5.21 Admin panel and audit log
- **Access.** requireAdmin checks ADMIN or SUPERADMIN, with the role cached in Redis. Role changes need SUPERADMIN and invalidate the cache.
- **Audit.** Every mutating admin action writes `AuditLog {adminId, action, targetType, targetId, details Json, createdAt}`. Actions: `user:role-change {from, to}`, `user:ban {type, reason, roomId}`, `user:unban`, `room:delete {title}`, `room:force-close {title, code}`, `report:resolve {status, resolution}`.
- **Client:**
  - `/admin` tabs: Dashboard, Users, Rooms, Reports, Audit Log (`?tab=`).
  - Detail drawer at `/admin/:entity/:targetId`.
  - Tables with pagination, search and filters. Role badges (SUPERADMIN highlighted).
  - The room detail shows the session timeline.
- **Lume should add:**
  - Force-close actually kicks sockets with a system message.
  - Moderation actions taken in rooms (kick/ban/mute) also go to a persistent mod-log table, visible to admins.
  - Bulk actions on reports.

### 5.22 Resume last room
- When a room empties, the permanent host gets a snapshot saved in `User.lastRoomSnapshot` (+`lastRoomSnapshotAt`), and the room is deleted after 3 min. room:create also archives the user's other empty rooms into the snapshot.
- Snapshot contents: `{title, description, isPublic, maxMembers, defaultViewerPermissions, hideReactions, playerState(url, source, currentTime, duration, title, thumbnail), queue[], history[]}`.
- Home "sessionHub" shows the resume card ("home.actions.resumeViewing", resumeFromTime, resumeQueueCount, resumeHistoryCount).
- POST /api/rooms/resume-last recreates the room.

### 5.23 Telegram storage
- `uploadPhoto(buffer, topic)` calls sendPhoto/sendDocument to a storage chat (env bot + chat id + per-topic thread ids: avatars, chat images). `getFileUrl(fileId)` goes through Bot API getFile.
- **Lume**: use S3/R2 as primary and keep the Telegram backend as an optional adapter.

---

## 6. Client UX inventory

### 6.1 Routes / pages
| Route | Page | Auth | Content |
|---|---|---|---|
| `/` | LandingPage when logged out (HeroSection). HomePage when logged in. | — | **Home "session hub"**: greeting + level; quick join by code; resume-last-room card; Create / Browse CTAs; social block (friends online, "Сейчас смотрят" friend rooms, invite via Telegram, recently watched, saved/favourites); stats (level, parties, watched); feature tiles; LiveRoomsCarousel; GlobalStatsWidget. Onboarding overlay on first visit. |
| `/login` | AuthPage | pub | Email/password login and register tabs, magic link, Telegram Login Widget, `?magic=` auto-verify. Redirects to the pending room after login. |
| `/create` | CreateRoomPage | auth | 3-step wizard (video → access → permissions). Presets friends/public/private. Live preview card. Supported-platforms hint. Validation "create.errors.nameRequired" / "invalidVideoUrl". |
| `/browse` | BrowseRoomsPage | pub | Search, filter chips, sort, density toggle, pagination, friend summary, preferred sources, empty state with "Создать свою". Errors: timeout, server error, retry. |
| `/room/:code` | RoomPage → RoomShell | auth | Player (theater), social rail (chat / members / queue tabs), session dock (voice), room bar/header, mobile sheet. Modals: settings, share, voice preflight, report, user profile. |
| `/join/:code` | JoinRedirect | — | → `/room/:code`, remembering it as pending if logged out |
| `/profile` | ProfilePage | auth | Tabs: overview (Infographics: heatmap, platforms, engagement, host stats, top friends, favourites, current activity, profile share), history, achievements (pin slots), friends (requests, list, blacklist). Settings panels: ProfileSettings (bio, display name, avatar crop, quick emojis/reaction, room defaults, privacy), AccountSettings (Telegram link, export, delete), NotificationPreferences, theme, language. |
| `/admin`, `/admin/:entity/:targetId` | Admin | admin | Dashboard, Users, Rooms, Reports, Audit log |
| `/dev/design-system`, `/dev/room-fixture` | dev only | — | Design-system and room fixture pages, dev builds only |

### 6.2 Key components and interactions
- **VideoPlayer:**
  - Gesture zones: left/centre/right thirds. Double tap on a side seeks ±10 s with a seek flash. Single tap shows the controls.
  - Custom progress bar with pointer drag. Speed menu (0.5–2). Quality selector. Fullscreen.
  - Sync indicator pill. "Ожидание видео" / insert-video hint when empty.
  - Error panel: host gets "Обновить ссылку" and "Заменить видео" with an inline URL input; viewers get a hint; "Открыть на платформе" for both.
  - Embed "not supported" card.
- **FloatingReactions** overlay. **ReactionBar** shows the quick emojis.
- **VideoQueue:**
  - Add-URL input, drag reorder, play-now (host), remove.
  - History tab with "Очистить историю".
  - Recommendations block (collapsible, persisted): from favourites, from history.
  - Empty states.
- **VideoServiceBrowser**: search via SearXNG with results grid, load more, "Вставить ссылку", quality pick.
- **Chat:**
  - Message list with avatars and grouping. System messages styled differently.
  - Reply preview bar. Image attach ("photo"). Emoji picker with categories, search and recent.
  - Reactions compacted (4 + "+N"). Pinned banner ("pinned.title"). Typing line. Unread anchor and jump ("unread").
  - Mention highlight. Timecode jump button. Slow-mode notice.
  - Enter sends, Shift+Enter adds a newline.
- **MembersList:**
  - Host / moderator / viewer groups ("members.titleWithCount").
  - Buffering and ready markers. Mic state.
  - Per-member action sheet with descriptions: view profile, add friend / request sent / already friends, manage rights (6 toggles), make host, kick, session ban, ban, blacklist, report.
  - Moderation panel: slow mode (off / N s), temp mute with reason, moderation log.
- **RoomSettings:**
  - Name, description, public/private cards, maxMembers options plus "Другое" with a custom input.
  - Default permissions (6). hideReactions toggle. Room code with copy.
  - Esc closes. Save error state.
- **ShareRoomModal**: copy link, QR, native share, Telegram share, recent friends to invite ("share.noFriendsHint"), reminder picker ("share.reminderTitle"), low-bandwidth toggle.
- **VoicePreflightModal**: mic and speaker selection, mic test meter, network score, join.
- **VoiceBar/SessionDock**: join/leave, mute/unmute, connected count.
- **UserProfileModal**: avatar, level, bio, pinned achievements, current activity, friend button, report.
- **Notifications**: bell + NotificationPanel (Esc closes, keyboard-activatable items with Enter/Space) + NotificationPreferences (channel × type grid, digest, quiet hours, push permission request).
- **Layout/MobileMenu**: desktop nav (hidden on mobile), mobile header + slide-out menu (Esc closes), theme switch, language switch.
- **AvatarUpload**: pick an image, square crop UI, upload.
- **PinnedAchievementSlot** ×3 with a custom Tooltip.
- **Onboarding**: 3 steps with skip and done. Stored server-side.

### 6.3 Keyboard shortcuts (old)
The old app had **only**: Esc to close modals/panels/sheets (settings, share, report, profile modal, notification panel, mobile menu, mobile room sheet); Enter to send and Shift+Enter for a newline in chat; Enter/Space on notification items. **No player hotkeys existed.** Lume should add them (§7).

### 6.4 Telegram Mini App behaviour (old)
- **Init:** `tg.ready()`, `tg.expand()`, `setHeaderColor('#0f0f1a')`, `setBackgroundColor('#0f0f1a')` (hardcoded). The user is pre-filled from `initDataUnsafe.user`. Telegram context = `initData` is non-empty.
- **themeParams**: **not used**; colorScheme is read but ignored. Lume must map themeParams into CSS variables and follow color-scheme changes (`themeChanged`).
- **BackButton**: shown in RoomPage. It leaves the room, clears the session and navigates to `/`.
- **MainButton**: a helper exists (`showMainButton`) but is **never used**. Lume: use it for "Создать комнату", "Присоединиться" and "Сохранить".
- **startapp deep links**: `start_param` = `room_<code>` or `<code>` goes to `/room/<code>`. Handled in both App.tsx and HomePage. If not authenticated, the code is stored as pending and the user is sent to `/login`. `user_<id>` is generated by ProfileShareWidget but **not routed**.
- **Haptics** (`HapticFeedback`): `impactOccurred('light')` at 24 call sites (taps, toggles, reactions), `impactOccurred('medium')` at 8 (primary actions), `notificationOccurred('success')` at 4 and `notificationOccurred('error')` at 5.
- Also missing and needed in Lume: `SettingsButton`, `closingConfirmation` while in voice, `viewport` / `safeAreaInset` / `contentSafeAreaInset` handling, fullscreen API (Bot API 8), `shareMessage`/`switchInlineQuery` for invites, `CloudStorage` for preferences, home-screen shortcut.

### 6.5 i18n
i18next with HTTP backend, files at `public/locales/{ru,en}/{achievements,admin,auth,chat,common,landing,player,room}.json` (copied to `./locales`). Default language is RU. Known gaps: many widgets had hardcoded RU strings (GlobalStatsWidget, BioSection, CurrentActivityCard, AvatarUpload, achievements UI, heatmap/platforms labels). The `quality.unavailable` key was missing. There was no pluralisation. **Lume**: ICU plurals, no hardcoded strings, and a lint rule enforcing that.

### 6.6 Local persistence keys (old)
`telerave-theme` (theme), `telerave-room-layout-v1` (layout per aspect), `telerave-preferred-quality`, sessionStorage `telerave-pending-room`, plus persisted zustand slices: room store (recommendations expanded, lowBandwidthMode), browse filters, user/auth tokens, emoji recents.

---

## 7. Known bugs, half-done items, and how Lume should finish them

| # | Issue (old) | Evidence | Lume resolution |
|---|---|---|---|
| K01 | 3 failing client tests: migration-audit (hardcoded colour class) and 2 Layout tests (md:hidden / hidden md:flex regex) | client-tests.txt | No hardcoded colours: use design tokens. Behavioural tests instead of class regexes. |
| K02 | Proactive URL refresh never runs: `UrlLifecycleManager.init(io)` is never called, so expiring extraction URLs die mid-video | utils/urlManager.ts, index.ts | Run a scheduler that re-extracts 5 min before `expiresAt` and pushes `player:video-changed` (keeping time and state), plus client-side refresh on 410. |
| K03 | Room state lives only in memory, so a single replica and a restart loses rooms. Redis copy is never authoritative. | RoomManager | Redis (or DB) as the source of truth, Socket.io Redis adapter, sticky sessions, crash-safe resume. |
| K04 | One socket per user (`userSocketMap`), so a second tab or device breaks notifications and presence | socket/index.ts | userId → Set<socketId>. Use rooms per user (`user:<id>`). |
| K05 | Watch reminders use `setTimeout` and are lost on restart | room:watch-reminder | Persistent job queue (BullMQ or a DB `scheduled_jobs` table). Let users list and cancel reminders. |
| K06 | Pinned message, mod log, slow mode, temp mutes and session bans live only in memory | RoomManager | Persist them: pinnedMessageId, ModerationAction table, Ban with expiresAt and type session. |
| K07 | Kick/ban/mute in rooms aren't in any persistent audit | — | Write ModerationAction rows and surface them in the admin room timeline. |
| K08 | Duplicate friends APIs, and privacy checks rely on a spoofable `?requesterId` | routes/index.ts | One friends API. Requester comes from the JWT. |
| K09 | `moderator` role exists but is never assignable | types.ts | "Назначить модератором" plus the matrix in §5.10. |
| K10 | Achievements: checked only on join, server-local hours, `totalAchievements` hardcoded 10, level only recomputed on unlock | achievements/index.ts | Event-driven checks, user timezone, dynamic totals, level derived from xp everywhere. |
| K11 | Watch time measured from socket connect time on the first join. WatchSessions only on leave (lost on crash). | socket handleLeaveRoom | Track `joinedAt` per room join. Flush sessions periodically (every 60 s) and on leave. |
| K12 | Web push is broken: the client subscribes via `serviceWorker.ready` but no SW is registered | hooks/useNotifications.ts | Ship a real SW (Workbox/vite-pwa) with push and notificationclick deep links. Make it a PWA. |
| K13 | P2P segment mesh is dead code (client never imported; server relays p2p:*) | client/src/sw/*, docs/p2p-roadmap.md | Phase P2: WebRTC data-channel segment sharing for HLS (p2p-media-loader style) behind a flag, or delete it on purpose. |
| K14 | CDN offload is never called and SigV4 is incomplete | services/CdnOffload.ts | Implement an optional S3/R2 segment cache with proper SigV4 (aws-sdk), or record a decision to drop it. |
| K15 | Admin force-close doesn't disconnect live members | admin.service.forceCloseRoom | Emit room:closed, eject sockets, delete runtime state. |
| K16 | `voice:speaker` / `voice:signal` declared but unused; no active-speaker UI | types.ts | mediasoup AudioLevelObserver → `voice:active-speakers`; speaking ring on avatars. |
| K17 | Share links carry `?t=` and `?v=` but RoomPage ignores them | roomQoL.buildRoomHandoffLinks | On join, `t` is a hint: seek locally if the room is idle, or offer "перейти к моменту". |
| K18 | `getNextRoomPanel` unused (panel cycling) | roomQoL.ts | Swipe between tabs on mobile, `[`/`]` hotkeys on desktop. |
| K19 | Telegram MainButton unused, themeParams ignored, header colour hardcoded, `user_` startapp not routed | hooks/useTelegram.ts | See §6.4. |
| K20 | Room layout M7 unfinished: no drag/resize panels, no container queries, no Storybook. LayoutPresetMenu choice missing per audit. | RoomShell.tsx TODO, PROGRESS.md | Owner requirement: modular, resizable, auto-layout by aspect. Use react-resizable-panels (desktop), container queries, saved layouts per aspect, Storybook. |
| K21 | Embed quality control incomplete: setQuality not wired for Vimeo/Twitch/VK, no `getQualityLevels` on embeds | AUDIT M5 | Unified QualityLevel API across engines. Per-viewer choice persisted. |
| K22 | Ready-check is display-only | §5.4 | Add the gating options from §5.4. |
| K23 | Mentions: highlight only, no autocomplete or notification | roomQoL.shouldHighlightMention | @-autocomplete from members, MENTION notification type. |
| K24 | Hardcoded RU strings, no plurals; `quality.unavailable` missing | AUDIT | Full i18n with ICU plurals. |
| K25 | Room.maxMembers default mismatch (DB 50 vs config 100) | schema vs config | Single default (by plan: free vs premium). |
| K26 | Low-bandwidth toggle hidden inside the Share modal | ShareRoomModal | Move it to player settings or profile, and auto-suggest it on a poor network (useNetworkQuality). |
| K27 | Magic link and email notifications depend on SMTP; nothing in the UI says email is off | email.channel | Transactional email provider, plus a status-aware UI. |
| K28 | GDPR delete has no "cancel deletion" path in the UI during the 30-day grace | gdpr | "Восстановить аккаунт" on login while scheduledDeletionAt is in the future. |
| K29 | Leaderboard data (`/api/stats` top watchers / party-goers) has no user-facing UI | routes | A small leaderboard on Home/Profile (friends-only toggle). |
| K30 | No player hotkeys | §6.3 | Space/K play-pause (host), J/L or ←/→ ±10 s, ↑/↓ volume, M mute, F fullscreen, C chat focus, R react quick, `?` shortcuts sheet. |
| K31 | Admin users: no "premium" management; isPremium is set manually in the DB | schema | Entitlements model + admin toggle + billing integration. |

---

## 8. Phase-grouped parity checklist

### Phase 0 — Foundations
- [ ] Postgres schema covering every model in §4 (+ K06/K07/K31 additions)
- [ ] Redis: sessions/refresh tokens, rate limiter (sliding window, memory fallback), extract cache, manifest cache, room state (authoritative), Socket.io adapter
- [ ] Config + feature flags (smartQueue, voicePreflight, chatComfort, moderationPresets, lowBandwidth, socialRetention)
- [ ] Health/live/ready, Prometheus metrics (§F129), Sentry
- [ ] SSRF-safe fetch with IP pinning (§5.15)
- [ ] i18n RU/EN from `./locales` with ICU plurals; theme tokens (dark/standard/light + Telegram themeParams)

### Phase 1 — Auth & accounts
- [ ] Register/login (rules F001/F002), JWT 30 min + rotating refresh 7 d, logout revoke
- [ ] Telegram Mini App initData auth (300 s max age), Telegram Login Widget
- [ ] Magic link (15 min, single use, neutral response)
- [ ] Link/unlink Telegram, linked accounts
- [ ] Pending-room redirect after login; onboarding (3 steps)
- [ ] GDPR export ZIP (24 h) + soft delete (30 d) + daily purge + restore path (K28)

### Phase 2 — Rooms core
- [ ] Create wizard with presets; 8-char codes; join by code / `/join/:code` / `startapp=room_<code>`
- [ ] Join rules: bans, capacity, extrapolated state, history 50, pinned, queue + history
- [ ] Permanent/temporary host, reclaim, migration (moderator first), system messages (verbatim §3)
- [ ] Empty-room 3-min grace + resume snapshot + Home resume card
- [ ] Room settings (title, desc, visibility, maxMembers incl. custom, default perms, hideReactions)
- [ ] Browse: search, filters, sorts, density, previews, facets, friends filter
- [ ] Share: link, QR, native share, TG share, invite friends, reminders (persistent), handoff `?t=` (K17)

### Phase 3 — Player & sync
- [ ] Source registry (25 platforms + direct, §5.11) and detection endpoint
- [ ] Orchestrator + cache TTL rules + premium gating + embed-vs-extraction rules (§5.12)
- [ ] Extractors: InnerTube (5 strategies + STS), VK (+cookie rotation), Rutube (+puppeteer), Twitch GQL, Cobalt, yt-dlp
- [ ] Metadata resolver (oEmbed/OG/GQL/Helix)
- [ ] Stream proxy + HLS/DASH proxy with manifest rewrite and Rutube VOD fix, 410 retry signalling
- [ ] Proactive URL refresh before expiry (K02) + manual refresh + replace video
- [ ] Engines: embeds (YouTube/Vimeo/Dailymotion/Facebook/Streamable/SoundCloud/Twitch, custom VK & Rutube), hls.js, dash.js, native, merged audio
- [ ] Client fallback chains per source (§5.12)
- [ ] Clock sync (§5.1) + adaptive sync (§5.2) + host heartbeats + sync indicator with resync
- [ ] Buffering/ready states + ready-check gating (K22)
- [ ] Vote-skip (§5.3), auto-advance
- [ ] Gesture zones, seek flash, progress drag, speed menu, fullscreen, quality selector + network-aware auto, low-bandwidth mode, hotkeys (K30)
- [ ] Sync/recovery telemetry → metrics + admin timeline

### Phase 4 — Queue & discovery
- [ ] Queue add/remove/reorder/play-now with permissions, duplicate guard, optimistic add + metadata update, autoplay
- [ ] History (50) + clear; recommendations (favourites/source/history, limit 6)
- [ ] SearXNG search + service browser with paste detection and badges

### Phase 5 — Chat & reactions
- [ ] Messages (500 chars), replies, image messages (≤10 MB), emoji picker (recent/search)
- [ ] Message reactions (max 3/user/message, compact 4+N)
- [ ] Persisted pin (moderators too), typing (aggregated), unread anchor, mentions + autocomplete + notification, timecode jump
- [ ] Floating reactions with quickEmojis/quickReaction, room hideReactions, user hideOtherReactions
- [ ] Slow mode with composer countdown

### Phase 6 — Moderation
- [ ] 6 per-member permissions + room defaults + override flag
- [ ] Moderator role (K09), make host, kick, ban session/permanent/blacklist (persisted), mute, temp-mute 30 s–24 h, unmute early, slow mode
- [ ] Persistent moderation log (in-room UI + admin)
- [ ] Blacklist management in profile; reports (5/h)

### Phase 7 — Voice
- [ ] mediasoup SFU (opus, 128 kbps), TURN/STUN ICE endpoint
- [ ] Preflight (devices, mic test, network score), mute broadcast, VoiceSession tracking
- [ ] Active speaker indicators (K16)

### Phase 8 — Social & profile
- [ ] Single friends API (request/accept/remove/status), presence, friend:in-room, invites
- [ ] Profile: bio, display name, avatar crop upload, current activity, privacy flags (5), quick emojis/reaction, default viewer permissions, hideOtherReactions
- [ ] Watch history, favourites, discovery, top friends, WatchSessions (periodic flush)
- [ ] Profile share (QR, copy, native, `startapp=user_<id>` routed)

### Phase 9 — Gamification & stats
- [ ] 10 achievements (event-driven, user timezone) + XP + level formula + pin slots (3)
- [ ] Heatmap, platforms, engagement, host stats, global stats (live), leaderboard UI (K29)

### Phase 10 — Notifications
- [ ] In-app (bell, panel, unread count, mark read/all, click-to-navigate)
- [ ] Telegram bot channel, email channel, web push with a real service worker (K12)
- [ ] Per channel × type preferences, digest INSTANT/HOURLY/DAILY, quiet hours with timezone, 15-min digest worker, digest preview

### Phase 11 — Admin & ops
- [ ] Admin dashboard, users (search/role filter/role change super-only/ban/unban), rooms (detail + timeline, delete, force-close that ejects), reports (resolve/dismiss), audit log with filters, deep links
- [ ] Premium entitlements management (K31)
- [ ] Optional CDN segment cache (K14), optional P2P mesh (K13)

### Phase 12 — Telegram-native polish & layout
- [ ] themeParams → CSS vars, BackButton everywhere, MainButton for primary actions, SettingsButton, closing confirmation in voice, safe areas, fullscreen, haptics mapping (light = taps, medium = primary actions, success/error = results)
- [ ] Modular resizable room layout with auto-layout by video aspect, saved per aspect, container queries, mobile sheet with swipe between tabs (K18, K20)
