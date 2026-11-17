# Parity matrix

Counts below are the current branch, not the Phase 4 baseline. A feature is Done only when the API or socket, the UI, and a test are all present.
Source of the feature list: [PARITY.md](./PARITY.md). Legacy copy: [legacy-locales](./legacy-locales/).

| Status | Count |
| --- | ---: |
| Done | 115 |
| Done (needs creds) | 12 |
| Partial | 8 |
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
| F021 | Room settings | Done | Room settings edits permissions, slow mode, and sync incidents. |
| F022 | Browse public rooms | Done | GET /rooms accepts a search query and a title sort. The home search box sends that query. |
| F023 | Live carousel + global stats | Done | Home shows the live room cards, and GET /stats supplies the global ranks. |
| F024 | Share links ?t= ?v= | Done | The player copies a link with ?t= and ?v=, and opening that link queues the video and seeks. |
| F025 | Room invites | Done | A friend row can send a room invite, which is stored as a notification. |
| F026 | Watch reminders | Done | A reminder is stored on the delivery queue and the worker releases it when it is due. |
| F027 | DB-backed queue reload | Done | Played items are stored in room history and reloaded into the queue column. |
| F028 | Layout presets × aspect | Done | The room can switch the video between 16:9 and a wider frame. |
| F029 | Mobile room sheet | Done | On a narrow screen the queue sits in a bottom sheet under the video. |
| F030 | Session dock | Done | The room header is the session dock: sync, people, and invite stay in that bar. |
| F031 | Report user/room | Done | POST /reports accepts a reason up to 500 characters and optional details. The people column has a report form. |
| F032 | Multi-source playback | Done | A .mpd URL mounts the DASH adapter. playerKind covers it. |
| F033 | VK + Rutube embeds | Done | VK and Rutube embeds accept a play command. The command is covered for both sources. |
| F034 | Host playback control | Done | Play, pause, seek, and a speed menu from 0.5 to 2. |
| F035 | NTP clock sync | Done | The room client takes five clock samples, keeps the median offset, and repeats every minute. |
| F036 | Adaptive drift correction | Done | Followers use the drift plan: soft rate on HTML5, hard seek, anti-loop, and buffer grace. |
| F037 | Host heartbeats | Done | The host emits playback:heartbeat every second. heartbeatLag is tested. |
| F038 | Sync indicator | Done | The player shows synced, syncing, lagging, or waiting, and a resync button seeks to the server clock. |
| F039 | Buffering / ready | Done | Viewer phase is reported. The room waits to start while anyone is buffering, using the tested ready gate. |
| F040 | Vote-skip | Done | playback:vote-skip is on the socket, the player shows the count, and the host or a majority plays the next item. |
| F041 | Video URL refresh | Done | POST /video/refresh keeps the current time and play state. The unavailable card calls it. A scheduled refresher is still not running. |
| F042 | Player error recovery | Done | When a video fails, the card offers retry, open on the platform, and replace. Retry calls the refresh route and keeps the time. |
| F043 | Tap gesture zones | Done | A double tap on the left or right of the player seeks 10 seconds. The zone math is tested. |
| F044 | Progress, fullscreen, speed | Done | The player has a speed menu from 0.5 to 2. |
| F045 | Quality selector | Done | Quality can be auto, low, or high. Auto follows the tested network rule and is saved locally. |
| F046 | Low-bandwidth mode | Done | Low bandwidth is a player switch saved on this browser. |
| F047 | Floating reactions | Partial | Floats can be hidden for other people or for the whole room. Own reactions stay visible when only the personal switch is on. |
| F048 | Chat timecode jump | Done | A chat line with a timecode has a jump button that seeks. |
| F049 | Sync telemetry | Done | A sync incident is stored on the room. Settings lists the latest 10. |
| F050 | Source detection | Done | The detector covers the source list, including YouTube, VK, and Rutube, and the queue shows the result. Extractors that need credentials stay idle until configured. |
| F051 | Extractor orchestrator | Done (needs creds) | The chain runs fixture extractors and returns unconfigured without COBALT_API_URL or YTDLP_PATH. See docs/CONFIG.md. |
| F052 | YouTube InnerTube | Done (needs creds) | InnerTube is accepted from a recorded fixture. Live YouTube is not called in CI. |
| F053 | VK extractor | Done (needs creds) | VK HLS is parsed from a fixture. Live cookies stay off until VK_COOKIES is set. |
| F054 | Rutube extractor | Done (needs creds) | Rutube m3u8 is parsed from a fixture. Live play-options stay off without network credentials. |
| F055 | Twitch GQL | Done (needs creds) | Twitch playback URLs are parsed from a fixture. Live GQL stays off without credentials. |
| F056 | Cobalt extractor | Done (needs creds) | Cobalt is a chain step that stays idle until COBALT_API_URL is set. |
| F057 | yt-dlp extractor | Done (needs creds) | yt-dlp is a chain step that stays idle until YTDLP_PATH is set. |
| F058 | Metadata resolver | Partial | oEmbed for YouTube and Vimeo. |
| F059 | Premium extraction gate | Partial | planPlayback returns premium_required for extraction-only sources. |
| F060 | Stream proxy | Done | GET /video/range proxies a byte range and rejects a request without one. |
| F061 | HLS/DASH manifest rewrite | Partial | GET /video/hls-proxy rewrites manifests when FF_EXTRACTORS=true and returns 410 on an expired upstream. Chains are not all implemented. |
| F062 | CDN offload | Missing | Documented in docs/ROADMAP.md. Not built. |
| F063 | SSRF protection | Done | Private hosts and resolved private addresses are refused before a fetch. |
| F064 | SearXNG search | Done (needs creds) | The queue has a search box. It stays empty until SEARXNG_URL is set. |
| F065 | Cobalt services list | Done | GET /video/services lists Cobalt only when COBALT_API_URL is set. Settings shows that list. |
| F066 | Video detect endpoint | Done | POST /video/detect classifies a URL. Adding a queue item shows that source. YouTube, VK, and Rutube are covered. |
| F067 | Shared queue | Done | Reorder, a pending line, and a duplicate URL rejection are in place. |
| F068 | Queue history | Done | The queue column reloads room history and shows how many rows came back. |
| F069 | Queue recommendations | Done | The queue column shows the first discovery suggestion from watch history. |
| F070 | Auto-advance | Done | When the host's player ends, the next queue item starts. |
| F071 | Chat text | Done | Chat messages are limited to 500 characters. |
| F072 | Replies | Done | replyToId is stored and shown. |
| F073 | Image messages | Done | A chat photo is checked for jpeg, png, gif, or webp and for a 10 MB cap, then stored and posted as an image message. |
| F074 | Chat reactions max 3 | Done | A fourth distinct emoji from the same person is rejected. |
| F075 | Emoji picker | Done | Chat quick reactions are grouped into hot, faces, and marks, more than three emoji. A tap floats that emoji. |
| F076 | Pinned message | Done | The pin banner can be cleared. |
| F077 | Typing indicator | Done | Several typers collapse into one line. typingLine is tested. |
| F078 | Mentions | Done | A message that mentions your display name is highlighted. There is no autocomplete. |
| F079 | Unread anchor | Done | The chat column has a jump back to the latest messages. |
| F080 | System messages | Done | Join, leave, and host-change lines are written into the chat. |
| F081 | Slow mode | Done | The composer counts down while slow mode blocks the next message. Hosts are exempt. |
| F082 | Six member permissions | Done | Room settings shows the six viewer permissions and saves them as the room defaults. |
| F083 | Make host | Done | The host can hand the room to another member. The handoff is tested. |
| F084 | Kick | Done | Kick still persists leftAt. |
| F085 | Session / permanent / global ban | Done | Join refuses session, permanent, and blacklist bans. |
| F086 | Mute and temp-mute | Done | Temp mute is 30s–24h, stored on the member, and blocks join and chat until it expires. |
| F087 | Moderation log | Done | The voice panel lists the persisted moderation log for a host or mod. |
| F088 | Member action sheet | Done | The member row can kick, mute, promote, transfer host, and report. |
| F089 | Blacklist management | Done | Settings lists blocked people and removes one with the existing friend delete. |
| F090 | Moderation presets | Done | Create offers Киноночь, Вечеринка, Закрытый, and С модерацией. |
| F091 | Voice chat | Done | Voice joins, mutes, and lists devices through LiveKit. The room has join and mute controls. |
| F092 | Voice preflight | Done | The voice card can run a microphone check before joining. |
| F093 | Voice mute broadcast | Partial | voice:state carries muted. No VoiceSession duration. |
| F094 | Active speaker | Done | LiveKit active speakers still drive the speaking dot. |
| F095 | TURN/STUN endpoint | Partial | GET /ice-servers returns Google STUN. LiveKit still owns the voice ICE path. |
| F096 | Friends | Partial | Request, accept, decline, remove, block, and name search with a 20/minute limit. No legacy duplicate API. |
| F097 | Friend presence | Done | A friend row shows the room they are in. |
| F098 | Top friends | Done | Top friends from shared watch time are listed. |
| F099 | Watch sessions | Done | Leaving a room records a watch session. The profile lists the longest sessions with friends. |
| F100 | Watch history | Done | Watch history is stored per video and the profile lists it by source. |
| F101 | Favourite videos | Done | GET /me/favourites returns videos watched more than once. The profile lists them. |
| F102 | Discovery feed | Done | Discovery suggestions from watch history show on the queue. |
| F103 | Public profile + privacy | Done | The profile page is in the cinema layout. Settings can hide friends and watch history. |
| F104 | Bio + current activity | Done | Bio can be edited from the people screen and is stored on the user. |
| F105 | Avatar upload + crop | Done | An avatar file is cropped to a square on a canvas and saved. |
| F106 | Profile share + user_ deep link | Done | startapp user_<id> opens that person's name on the people screen. |
| F107 | In-room profile modal | Done | Clicking a person in the room opens a profile card with their name and level. |
| F108 | 10 achievements + XP + levels | Done | The ten original achievements, XP, and levels award on create, join, chat, and reaction. The profile shows all ten. |
| F109 | Achievement pin slots | Done | Three pin slots can be filled from earned achievements. |
| F110 | Activity heatmap | Done | The studio returns 365 days and the people screen marks active ones. |
| F111 | Platforms chart | Done | Platform counts from watch history are listed. |
| F112 | Engagement widget | Done | The profile shows voice and watch seconds next to each friend from the studio totals. |
| F113 | Host stats | Done | Hosted room count is shown. |
| F114 | Leaderboards | Done | GET /stats ranks people by XP and lists open rooms. The profile shows that table. |
| F115 | In-app notifications | Done | The people screen lists unread notices. |
| F116 | Telegram bot notify | Partial | Telegram sendMessage runs when TELEGRAM_BOT_TOKEN and telegramId are set. |
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
