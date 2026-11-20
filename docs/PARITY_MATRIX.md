# Parity matrix

Counts below are the current branch, not the Phase 4 baseline. A feature is Done only when the API or socket, the UI, and a test are all present.
Source of the feature list: [PARITY.md](./PARITY.md). Legacy copy: [legacy-locales](./legacy-locales/).

| Status | Count |
| --- | ---: |
| Done | 122 |
| Done (needs creds) | 13 |
| Partial | 0 |
| Redesign | 0 |
| Missing | 2 |

A row is Done only when the API or socket, the UI, and a test all exist. A tested rule with no screen stays Partial. Partial means a slice exists and the rest is still open. Missing means Lume has no user-facing behaviour for it.

Voice uses LiveKit Cloud, not the old mediasoup process. That is a locked product decision. ICE and speaker detection go through LiveKit.

| ID | Feature | Lume | What is true now |
| --- | --- | --- | --- |
| F001 | Email + password register | Done | Register checks the shape rules, returns 409 on a duplicate email, and 503 when production has no Redis. The auth screen has a registration tab. Hash stays scrypt. |
| F002 | Email + password login | Done | Login is limited to 20 attempts per 15 minutes per email. |
| F003 | JWT access + rotating refresh | Done | The browser stores the refresh token and retries a 401 once. shouldRefresh covers the decision. |
| F004 | Logout with server revocation | Done | POST /auth/logout deletes the refresh token. A revoked token cannot rotate. The sign-out button calls it. |
| F005 | Magic-link login | Done | A link is issued for 15 minutes and used once. Opening `?magic=` verifies it and stores the session. SMTP is still optional; without it the link is returned to the caller. |
| F006 | Telegram Mini App auth | Done | initData expires after 300 seconds by default, and a clock more than 30 seconds ahead is rejected. |
| F007 | Telegram Login Widget | Done | POST /auth/telegram-widget checks the Login Widget hash. The auth screen posts the fields. |
| F008 | Link / unlink Telegram | Done | Settings can link a numeric Telegram id and unlink it. Unlink is refused without an email. A Telegram id already on another account returns 409. |
| F009 | Linked accounts status | Done | GET /auth/linked-accounts returns email and Telegram flags. Settings shows them as «почта · Telegram». |
| F010 | Dev auth bypass | Done | ALLOW_STUB_AUTH guest JWT. |
| F011 | Post-auth pending room | Done | A room code from the Telegram start param or ?code= is filled into the join field. |
| F012 | Onboarding | Done | Three onboarding lines show once, then the flag is saved on the account. |
| F013 | GDPR ZIP export | Done | People can download a 24-hour ZIP. The zip bytes and the expiry rule are tested. |
| F014 | Account deletion + purge | Done | Settings sends DELETE and can restore inside 30 days. The purge job still runs at 03:00 UTC when Redis and Postgres are up. |
| F015 | Create room wizard + presets | Done | Room codes are 8 characters. Create offers Киноночь, Вечеринка, Закрытый, and С модерацией. |
| F016 | Join by code | Done | Join by code works, including a code carried in the page query. |
| F017 | Join bans, capacity, history | Done | Join writes a system line. The service test checks the reclaim wording as well. |
| F018 | Permanent vs temporary host | Done | The returning owner gets «вернулся и забрал хост», covered by the room service test. |
| F019 | Host succession | Done | Leave promotes a moderator, otherwise the earliest member, and pauses playback when the host leaves. The chat line says the new host took over. |
| F020 | Resume-last-room snapshot | Done | An empty room stores a snapshot. POST /rooms/resume-last recreates it paused, with the saved time clamped to the duration. Home calls that route. |
| F021 | Room settings | Done | The live room has a settings sheet for title, description, public/private, the member cap, hide-reactions, and the six viewer defaults. Esc closes it. The defaults are projected onto every member without personal overrides on join and again when the host changes them, and chat, reactions, queue adds, invites, seeking, and voice joining consult them. The cap is enforced on join. |
| F022 | Browse public rooms | Done | GET /rooms accepts a search query and a title sort. The home search box sends that query. |
| F023 | Live carousel + global stats | Done | GET /stats/global aggregates online members, active rooms, distinct videos in watch history, and summed watch hours from Postgres rows. Home renders those counters and a horizontally scrolling carousel of the public rooms returned by GET /rooms, with working previous/next controls. |
| F024 | Share links ?t= ?v= | Done | The player copies a link with ?t= and ?v=, and opening that link queues the video and seeks. |
| F025 | Room invites | Done | A friend row can send a room invite, which is stored as a notification. |
| F026 | Watch reminders | Done | A reminder is stored on the delivery queue and the worker releases it when it is due. |
| F027 | DB-backed queue reload | Done | A played history row has an «В очередь» control. POST /rooms/:id/queue/reload copies the persisted RoomHistoryItem back into QueueItem, the socket emits queue:state, and a duplicate live row is refused with 409. |
| F028 | Layout presets × aspect | Done | The live header applies Обычный, Шире, and Погружение presets and switches 16:9 or 9:16. The player frame changes size, the layout is stored per aspect under `telerave-room-layout-v1`, synced across tabs, and saved on the room. |
| F029 | Mobile room sheet | Done | A narrow room has a bottom sheet with chat, members, and queue tabs over live state. Esc closes it, and queue items come from the persisted room queue. |
| F030 | Session dock | Done | The live room has a session dock bar with the persisted session timer, live member and voice counts, invite-link copy, a stored reminder, voice join/mute/leave, settings, and leave. GET /rooms/:id/session reads the room and membership rows. |
| F031 | Report user/room | Done | POST /reports stores the selected member. The live room reports that person, and the preview no longer sends targetId mark. |
| F032 | Multi-source playback | Done | A .mpd URL mounts the DASH adapter. playerKind covers it. |
| F033 | VK + Rutube embeds | Done | The live player mounts VK with js_api=1 and hide_logo=1 and Rutube with controls=false. Both adapters translate postMessage commands and ready, playing, buffering, time, duration, ended, and error events. The queue persists provider and externalId. |
| F034 | Host playback control | Done | Play, pause, seek, and a speed menu from 0.5 to 2. |
| F035 | NTP clock sync | Done | The room client takes five clock samples, keeps the median offset, and repeats every minute. |
| F036 | Adaptive drift correction | Done | Followers use the drift plan: soft rate on HTML5, hard seek, anti-loop, and buffer grace. |
| F037 | Host heartbeats | Done | The host emits playback:heartbeat every second. heartbeatLag is tested. |
| F038 | Sync indicator | Done | The player shows synced, syncing, lagging, or waiting, and a resync button seeks to the server clock. |
| F039 | Buffering / ready | Done | The sync engine turns play into pause while any viewer is buffering. The live room shows that hold. The held play is remembered and resumes automatically when the last buffering viewer becomes ready, is kicked, leaves, or disconnects; departure also clears the phase so a room cannot stay stuck on pause. |
| F040 | Vote-skip | Done | playback:vote-skip is on the socket, the player shows the count, and the host or a majority plays the next item. |
| F041 | Video URL refresh | Done | POST /video/refresh re-extracts the stream, persists the new URL and `expiresAt`, and keeps the current time and play state. A BullMQ `media.refresh` job refreshes the playing item of active rooms 5 minutes before expiry. |
| F042 | Player error recovery | Done | A failed live video shows retry, open, and replace. Retry is stored on the room. |
| F043 | Tap gesture zones | Done | A double tap on the left or right of the player seeks 10 seconds. The zone math is tested. |
| F044 | Progress, fullscreen, speed | Done | The player has a speed menu from 0.5 to 2. |
| F045 | Quality selector | Done | Quality can be auto, low, or high. Auto follows the tested network rule and is saved locally. |
| F046 | Low-bandwidth mode | Done | Low bandwidth is a player switch saved on this browser. |
| F047 | Floating reactions | Done | The live room reads hideOtherReactions from the profile and hides other people's floats. |
| F048 | Chat timecode jump | Done | A chat line with a timecode has a jump button that seeks. |
| F049 | Sync telemetry | Done | A sync incident is stored only from the sync-failure control. Adding a video does not write one. |
| F050 | Source detection | Done | The detector covers the source list, including YouTube, VK, and Rutube, and the queue shows the result. Extractors that need credentials stay idle until configured. |
| F051 | Extractor orchestrator | Done (needs creds) | `@lume/media` tries every configured adapter in order with a per-adapter timeout and returns `no_extractor`/per-attempt errors instead of guessing. See docs/CONFIG.md. |
| F052 | YouTube InnerTube | Done (needs creds) | Live InnerTube `player` request behind FF_EXTRACTORS, parsed into HLS/progressive/adaptive. CI uses a local node:http fixture. |
| F053 | VK extractor | Done (needs creds) | Live `video_ext.php` scraping with HLS/DASH/mp4 detection and `VK_COOKIES` rotation (`||` separated). |
| F054 | Rutube extractor | Done (needs creds) | Live `/api/play/options/<id>` request behind FF_EXTRACTORS, parsed into the balancer m3u8. |
| F055 | Twitch GQL | Done (needs creds) | Live PlaybackAccessToken GQL to usher HLS with `TWITCH_CLIENT_ID`; optional Helix title via the client secret. |
| F056 | Cobalt extractor | Done (needs creds) | Real POST to the self-hosted Cobalt API; registered only when `COBALT_API_URL` is set. |
| F057 | yt-dlp extractor | Done (needs creds) | Real `--dump-json` invocation through `YTDLP_PATH`; registered only when the path is set. |
| F058 | Metadata resolver | Done | POST /rooms/:id/queue resolves provider oEmbed JSON for title, poster and duration, then falls back to OpenGraph and schema.org duration. QueueItem.durationMs and RoomHistoryItem.durationMs are persisted, and the live queue renders the resolved name and duration instead of a raw oEmbed URL. The page fallback is DNS-checked, re-checks every redirect hop, caps the page read (512 KB) and the oEmbed JSON (1 MB), and refuses private hosts including bracketed IPv6; tests use a local `node:http` metadata server. |
| F059 | Premium extraction gate | Done | The live queue reads isPremium from /me and blocks the 13 extraction-only platforms with a Premium notice. POST /rooms/:id/queue and /video/resolve read the saved isPremium flag, so the socket path is gated too and a client cannot claim premium in the body. |
| F060 | Stream proxy | Done | GET /video/range checks a provider host allowlist, refuses private hosts (including bracketed IPv6), re-resolves the host and refuses private addresses on every redirect hop (so a public name that resolves private is refused too), caps the body at STREAM_MAX_BYTES, and streams the ranged upstream body instead of buffering it. CORS exposes range headers to the browser player. The live player sends direct files through this proxy. |
| F061 | HLS/DASH manifest rewrite | Done | GET /video/hls-proxy serves HLS master and media playlists plus DASH manifests without FF_EXTRACTORS. Variant, segment, key URI, BaseURL and SegmentTemplate references are rewritten to the proxy through the master → media → segment chain; segments stream through as binary with Range forwarded, and text manifests are capped at 1 MB (413 above it). The live HLS player and the existing DASH adapter both load their manifests through this endpoint. |
| F062 | CDN offload | Missing | Documented in docs/ROADMAP.md. Not built. |
| F063 | SSRF protection | Done | Private hosts and resolved private addresses are refused before a fetch. |
| F064 | SearXNG search | Done (needs creds) | The queue has a search box. It stays empty until SEARXNG_URL is set. |
| F065 | Cobalt services list | Done | GET /video/services lists Cobalt only when COBALT_API_URL is set. Settings shows that list. |
| F066 | Video detect endpoint | Done | POST /video/detect uses the caller's saved premium flag. The live queue shows source and plan. |
| F067 | Shared queue | Done | Reorder, a pending line, and a duplicate URL rejection are in place. |
| F068 | Queue history | Done | The live queue shows the last played items from the persisted history, reloads after the host advances, and the host can clear it. GET and DELETE /rooms/:id/history cap the list at 50 and delete only for the host. |
| F069 | Queue recommendations | Done | GET /me/discovery?roomId omits videos already waiting in that room's live queue. The live queue lists up to four history or favourite suggestions with a real «В очередь» control that adds the video and its title through the socket queue path, then persists it as a QueueItem. |
| F070 | Auto-advance | Done | When the host's player ends, the next queue item starts. |
| F071 | Chat text | Done | Chat messages are limited to 500 characters. |
| F072 | Replies | Done | replyToId is stored and shown. |
| F073 | Image messages | Done | A chat photo is checked for jpeg, png, gif, or webp and for a 10 MB cap, then stored and posted as an image message. |
| F074 | Chat reactions max 3 | Done | A fourth distinct emoji from the same person is rejected. |
| F075 | Emoji picker | Done | The live composer opens a picker with recent, faces, gestures, hearts, animals, food, and symbols tabs, a search field, and insertion into the draft. Recents are capped at 12 and stored per account on User.recentEmojis. |
| F076 | Pinned message | Done | The pin banner can be cleared. |
| F077 | Typing indicator | Done | Several typers collapse into one line. typingLine is tested. |
| F078 | Mentions | Done | A message that mentions your display name is highlighted. There is no autocomplete. |
| F079 | Unread anchor | Done | The live chat counts messages that arrive after join, marks the first unread line, and jumps to it from the «К новым» anchor. |
| F080 | System messages | Done | Join, leave, and host-change lines are written into the chat. |
| F081 | Slow mode | Done | The composer counts down while slow mode blocks the next message. Hosts are exempt. |
| F082 | Six member permissions | Done | POST /rooms/:id/defaults stores canChat, canQueue, canSpeak, canReact, canSeek, and canInvite. The live room edits those checkboxes. |
| F083 | Make host | Done | The host can hand the room to another member. The handoff is tested. |
| F084 | Kick | Done | Kick still persists leftAt. |
| F085 | Session / permanent / global ban | Done | Join refuses session, permanent, and blacklist bans. |
| F086 | Mute and temp-mute | Done | Temp mute is 30s–24h, stored on the member, and blocks join and chat until it expires. |
| F087 | Moderation log | Done | The voice panel lists the persisted moderation log for a host or mod. |
| F088 | Member action sheet | Done | The member row can kick, mute, promote, transfer host, and report. |
| F089 | Blacklist management | Done | GET /users/:id/blacklist lists the owner's global bans (roomId null) separately from friend blocks, and POST /users/:id/blacklist/remove lifts one. The live room profile can blacklist a member everywhere, and settings has a global blacklist section with a working remove. |
| F090 | Moderation presets | Done | The create chips send a preset id, and the API resolves it into privacy, member cap, hide-reactions, slow mode, and all six viewer defaults before the room is created. The wizard previews the same resolved rights. A closed preset joins with chat but without queue or voice rights. |
| F091 | Voice chat | Done | Voice joins, mutes, and lists devices through LiveKit. The room has join and mute controls. |
| F092 | Voice preflight | Done | The live voice card checks the mic level, looks for an audio output and plays a short test tone, and scores the network good/fair/poor. POST /voice/preflight stores the result on the account and GET returns it with checkedAt. |
| F093 | Voice mute broadcast | Done | voice:state broadcasts the microphone status, and Redis presence keeps each participant's join time. Every client derives one shared session clock from the earliest voice join, shows who is muted, and flushes its own seconds to POST /me/voice-seconds on leave. |
| F094 | Active speaker | Done | LiveKit active speakers still drive the speaking dot. |
| F095 | TURN/STUN endpoint | Done | GET /ice-servers is auth-gated and returns STUN from STUN_URLS (Google by default), a STUN entry for the configured LiveKit host, and TURN/TURNS URLs plus username and credential from env. The live voice card shows the issued list. |
| F096 | Friends | Done | Home search renders the people returned by GET /users/search, excluding the caller. |
| F097 | Friend presence | Done | A friend row shows the room they are in. |
| F098 | Top friends | Done | Top friends from shared watch time are listed. |
| F099 | Watch sessions | Done | Leaving a room records a watch session. The profile lists the longest sessions with friends. |
| F100 | Watch history | Done | GET /users/:id/watch-history returns the persisted rows newest-first with replay counts, and refuses other readers when isWatchHistoryPublic is off. The live profile lists that history. |
| F101 | Favourite videos | Done | A second watch of the same URL increments WatchHistory.watchCount. GET /me/favourites returns those rows with counts and timestamps, and the live profile lists them. |
| F102 | Discovery feed | Done | Discovery suggestions from watch history show on the queue. |
| F103 | Public profile + privacy | Done | GET /users/profile/:id, /users/:id/friends, /users/:id/watch-history, /users/:id/favourites, and /users/:id/top-friends all honor the owner's flags. Settings has live switches; a viewer's live public profile shows «Скрыто» until the owner turns a section back on. |
| F104 | Bio + current activity | Done | Bio can be edited from the people screen and is stored on the user. |
| F105 | Avatar upload + crop | Done | An avatar file is cropped to a square on a canvas and saved. |
| F106 | Profile share + user_ deep link | Done | startapp user_<id> opens that person's name on the people screen. |
| F107 | In-room profile modal | Done | A member row in the live room opens a profile card. Esc closes it, and the card can send a real friend request or a report. |
| F108 | 10 achievements + XP + levels | Done | GET /me/achievements and /users/:id/achievements return all ten definitions with earned flags, totalXp, level from XP, and nextLevelXp. The live profile renders all ten icons and highlights only earned ones, with a dynamic N из 10 count. |
| F109 | Achievement pin slots | Done | Three pin slots can be filled from earned achievements. |
| F110 | Activity heatmap | Done | The studio returns 365 days and the people screen marks active ones. |
| F111 | Platforms chart | Done | Platform counts from watch history are listed. |
| F112 | Engagement widget | Done | GET /users/:id/engagement aggregates persisted watch sessions once per session plus totalWatchTime, voice seconds flushed by the live voice timer, messages, and reactions. The live profile renders that widget with totals. |
| F113 | Host stats | Done | Hosted room count is shown. |
| F114 | Leaderboards | Done | GET /stats/leaderboard returns separate top lists for messages and reactions (counted from persisted Message and Reaction rows) and voice (persisted User.totalVoiceSeconds), with a limit of 1–50. The live profile renders all three boards from that endpoint; it no longer reads GET /stats. |
| F115 | In-app notifications | Done | The people screen lists unread notices. |
| F116 | Telegram bot notify | Done (needs creds) | Telegram sendMessage runs when TELEGRAM_BOT_TOKEN and telegramId are set. Settings only shows a sentence. |
| F117 | Email notifications | Done (needs creds) | Email send is skipped until SMTP_HOST is set. Documented in docs/CONFIG.md. |
| F118 | Web push + service worker | Done (needs creds) | The service worker is registered. Push send is skipped until VAPID_PUBLIC_KEY is set. |
| F119 | Per-channel × type prefs | Done | All 4 channels and 6 notification types are a grid of switches. |
| F120 | Digests + quiet hours | Done | Digest count is shown and the worker clears due rows every 15 minutes. |
| F121 | Digest preview | Done | The people screen shows the digest preview count. |
| F122 | Admin dashboard | Done | An admin sees tables for users, rooms, reports, and the audit log. |
| F123 | Admin users | Done | User search is paged and a row can be banned. |
| F124 | Admin rooms + force close | Done | Room rows can be force-closed, which also asks realtime to disconnect sockets. |
| F125 | Admin reports | Done | Open reports are paged and can be marked reviewed. |
| F126 | Audit log | Done | The audit table is paged and can be filtered by action. |
| F127 | Admin deep links | Done | /admin is a real path and opens the admin tables. |
| F128 | Health / live / ready | Done | In production, /ready returns 503 when Postgres or Redis is unset. The health test covers it. |
| F129 | Prometheus metrics | Done (needs creds) | GET /metrics is tested. Events are not uploaded until SENTRY_DSN is set. |
| F130 | Rate limiting | Done | Every mutating route is limited. Redis is used when REDIS_URL is set, otherwise the same window stays in memory. |
| F131 | Feature flags | Done | GET /flags lists the product flags, including whether extractors are on. |
| F132 | Themes | Done | Cinema and Gruvbox are the two styles, with dark, light, and system. Settings switches them. |
| F133 | i18n RU/EN | Done | All eight legacy namespaces load in Russian and English. The home line uses common.nav.home. |
| F134 | Landing page | Done | Signed-out home is the landing. Signed-in home is the session hub. |
| F135 | Home session hub | Done | Home is the session hub: resume, create, join, open rooms, and friends. |
| F136 | Telegram storage uploads | Done (needs creds) | Uploads stay on local disk. S3 and a Telegram storage chat are used when CDN_ENDPOINT or TELEGRAM_STORAGE_CHAT is set. |
| F137 | P2P segment mesh | Missing | Documented in docs/ROADMAP.md. Not built. |

## Checklist

The twelve phases in PARITY.md stay open until the rows they cover are Done. This file is the tracker. Update a row in the same commit that changes the behaviour.
