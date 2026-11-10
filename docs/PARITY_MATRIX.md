# Parity matrix

Counts below are the current branch, not the Phase 4 baseline. A feature is Done only when the API or socket, the UI, and a test are all present.
Source of the feature list: [PARITY.md](./PARITY.md). Legacy copy: [legacy-locales](./legacy-locales/).

| Status | Count |
| --- | ---: |
| Done | 62 |
| Done (needs creds) | 12 |
| Partial | 37 |
| Missing | 19 |

A row is Done only when the API or socket, the UI, and a test all exist. A tested rule with no screen stays Partial. Partial means a slice exists and the rest is still open. Missing means Lume has no user-facing behaviour for it.

Voice uses LiveKit Cloud, not the old mediasoup process. That is a locked product decision. ICE and speaker detection go through LiveKit.

| ID | Feature | Lume | What is true now |
| --- | --- | --- | --- |
| F001 | Email + password register | Partial | Register exists with the old shape rules. Hash is scrypt, not bcrypt. No Redis-down 503. |
| F002 | Email + password login | Done | Login is limited to 20 attempts per 15 minutes per email. |
| F003 | JWT access + rotating refresh | Partial | POST /auth/refresh rotates a token. The web client does not call it yet. |
| F004 | Logout with server revocation | Partial | Client clears the session. The server does not revoke it. |
| F005 | Magic-link login | Partial | The landing page can request a link. It does not sign the browser in when the link returns. |
| F006 | Telegram Mini App auth | Done | initData expires after 300 seconds by default, and a clock more than 30 seconds ahead is rejected. |
| F007 | Telegram Login Widget | Missing | No widget hash verification. |
| F008 | Link / unlink Telegram | Missing | No link routes. |
| F009 | Linked accounts status | Missing | No endpoint. |
| F010 | Dev auth bypass | Done | ALLOW_STUB_AUTH guest JWT. |
| F011 | Post-auth pending room | Done | A room code from the Telegram start param or ?code= is filled into the join field. |
| F012 | Onboarding | Done | Three onboarding lines show once, then the flag is saved on the account. |
| F013 | GDPR ZIP export | Done | People can download a 24-hour ZIP. The zip bytes and the expiry rule are tested. |
| F014 | Account deletion + purge | Partial | Soft delete, restore, and a BullMQ purge at 03:00 UTC. The worker needs Redis and Postgres. |
| F015 | Create room wizard + presets | Done | Room codes are 8 characters. Create offers Киноночь, Вечеринка, Закрытый, and С модерацией. |
| F016 | Join by code | Done | Join by code works, including a code carried in the page query. |
| F017 | Join bans, capacity, history | Partial | Join refuses a room ban, a session ban, and the owner's blacklist. System lines are still thin. |
| F018 | Permanent vs temporary host | Partial | Owner reclaim and temporary host on leave. System line for reclaim is not separate. |
| F019 | Host succession | Partial | Leave promotes a mod, otherwise the earliest member. Playback is not paused. |
| F020 | Resume-last-room snapshot | Partial | Empty room writes lastRoomSnapshot. People screen shows Продолжить просмотр. Recreate route is not wired. |
| F021 | Room settings | Redesign | Description, member cap, and hide-reactions already save. The full settings sheet waits for the design pack. |
| F022 | Browse public rooms | Partial | Public list only. No search, filters, or sorts. |
| F023 | Live carousel + global stats | Redesign | Global counters and the live carousel wait for the design pack. |
| F024 | Share links ?t= ?v= | Done | The player copies a link with ?t= and ?v=, and opening that link queues the video and seeks. |
| F025 | Room invites | Done | A friend row can send a room invite, which is stored as a notification. |
| F026 | Watch reminders | Done | A reminder is stored on the delivery queue and the worker releases it when it is due. |
| F027 | DB-backed queue reload | Partial | Queue is in Postgres. No room history table. |
| F028 | Layout presets × aspect | Redesign | Resizable panels stay. Enlarged and immersive presets wait for the design pack. |
| F029 | Mobile room sheet | Redesign | The mobile sheet waits for the design pack. Panels already reflow. |
| F030 | Session dock | Redesign | The session dock waits for the design pack. The room bar and voice panel stay. |
| F031 | Report user/room | Partial | POST /reports, 5/hour. No in-room form yet. |
| F032 | Multi-source playback | Partial | YouTube, Vimeo, Twitch, HTML5/HLS adapters. No DASH or merged audio. |
| F033 | VK + Rutube embeds | Partial | Best-effort adapters, not the postMessage APIs. |
| F034 | Host playback control | Done | Play, pause, seek, and a speed menu from 0.5 to 2. |
| F035 | NTP clock sync | Done | The room client takes five clock samples, keeps the median offset, and repeats every minute. |
| F036 | Adaptive drift correction | Done | Followers use the drift plan: soft rate on HTML5, hard seek, anti-loop, and buffer grace. |
| F037 | Host heartbeats | Missing | Viewers follow the anchor, not a 1s heartbeat. |
| F038 | Sync indicator | Done | The player shows synced, syncing, lagging, or waiting, and a resync button seeks to the server clock. |
| F039 | Buffering / ready | Partial | Viewer phase is reported. No ready gate. |
| F040 | Vote-skip | Done | playback:vote-skip is on the socket, the player shows the count, and the host or a majority plays the next item. |
| F041 | Video URL refresh | Missing | No re-extract path. |
| F042 | Player error recovery | Partial | Limited-source copy only. |
| F043 | Tap gesture zones | Done | A double tap on the left or right of the player seeks 10 seconds. The zone math is tested. |
| F044 | Progress, fullscreen, speed | Done | The player has a speed menu from 0.5 to 2. |
| F045 | Quality selector | Done | Quality can be auto, low, or high. Auto follows the tested network rule and is saved locally. |
| F046 | Low-bandwidth mode | Done | Low bandwidth is a player switch saved on this browser. |
| F047 | Floating reactions | Partial | Floats can be hidden for other people or for the whole room. Own reactions stay visible when only the personal switch is on. |
| F048 | Chat timecode jump | Done | A chat line with a timecode has a jump button that seeks. |
| F049 | Sync telemetry | Missing | No incident log. |
| F050 | Source detection | Partial | 25-source detector and playback plan exist. Not every extractor runs. |
| F051 | Extractor orchestrator | Done (needs creds) | The chain runs fixture extractors and returns unconfigured without COBALT_API_URL or YTDLP_PATH. See docs/CONFIG.md. |
| F052 | YouTube InnerTube | Done (needs creds) | InnerTube is accepted from a recorded fixture. Live YouTube is not called in CI. |
| F053 | VK extractor | Done (needs creds) | VK HLS is parsed from a fixture. Live cookies stay off until VK_COOKIES is set. |
| F054 | Rutube extractor | Done (needs creds) | Rutube m3u8 is parsed from a fixture. Live play-options stay off without network credentials. |
| F055 | Twitch GQL | Done (needs creds) | Twitch playback URLs are parsed from a fixture. Live GQL stays off without credentials. |
| F056 | Cobalt extractor | Done (needs creds) | Cobalt is a chain step that stays idle until COBALT_API_URL is set. |
| F057 | yt-dlp extractor | Done (needs creds) | yt-dlp is a chain step that stays idle until YTDLP_PATH is set. |
| F058 | Metadata resolver | Partial | oEmbed for YouTube and Vimeo. |
| F059 | Premium extraction gate | Partial | planPlayback returns premium_required for extraction-only sources. |
| F060 | Stream proxy | Missing | No Range proxy. |
| F061 | HLS/DASH manifest rewrite | Partial | GET /video/hls-proxy rewrites manifests when FF_EXTRACTORS=true and returns 410 on an expired upstream. Chains are not all implemented. |
| F062 | CDN offload | Missing | Documented in docs/ROADMAP.md. Not built. |
| F063 | SSRF protection | Done | Private hosts and resolved private addresses are refused before a fetch. |
| F064 | SearXNG search | Done (needs creds) | The queue has a search box. It stays empty until SEARXNG_URL is set. |
| F065 | Cobalt services list | Partial | GET /video/services is empty until COBALT_API_URL is set. No screen lists it. |
| F066 | Video detect endpoint | Partial | POST /video/detect classifies a URL. The queue field does not call it. |
| F067 | Shared queue | Done | Reorder, a pending line, and a duplicate URL rejection are in place. |
| F068 | Queue history | Partial | The queue panel shows how many history rows the room has. |
| F069 | Queue recommendations | Partial | The queue panel shows the first discovery suggestion from watch history. |
| F070 | Auto-advance | Done | When the host's player ends, the next queue item starts. |
| F071 | Chat text | Done | Chat messages are limited to 500 characters. |
| F072 | Replies | Done | replyToId is stored and shown. |
| F073 | Image messages | Done | A chat photo is checked for jpeg, png, gif, or webp and for a 10 MB cap, then stored and posted as an image message. |
| F074 | Chat reactions max 3 | Done | A fourth distinct emoji from the same person is rejected. |
| F075 | Emoji picker | Missing | Three fixed emoji. |
| F076 | Pinned message | Done | The pin banner can be cleared. |
| F077 | Typing indicator | Partial | Typing is broadcast and shown for about three seconds. |
| F078 | Mentions | Done | A message that mentions your display name is highlighted. There is no autocomplete. |
| F079 | Unread anchor | Missing | No jump. |
| F080 | System messages | Done | Join, leave, and host-change lines are written into the chat. |
| F081 | Slow mode | Done | The composer counts down while slow mode blocks the next message. Hosts are exempt. |
| F082 | Six member permissions | Partial | A host sees six permission toggles and an override flag. Room defaults are not edited from settings. |
| F083 | Make host | Done | The host can hand the room to another member. The handoff is tested. |
| F084 | Kick | Done | Kick still persists leftAt. |
| F085 | Session / permanent / global ban | Done | Join refuses session, permanent, and blacklist bans. |
| F086 | Mute and temp-mute | Done | Temp mute is 30s–24h, stored on the member, and blocks join and chat until it expires. |
| F087 | Moderation log | Done | The voice panel lists the persisted moderation log for a host or mod. |
| F088 | Member action sheet | Done | The member row can kick, mute, promote, transfer host, and report. |
| F089 | Blacklist management | Missing | No list or remove. |
| F090 | Moderation presets | Missing | No create-wizard presets. |
| F091 | Voice chat | Partial | LiveKit instead of mediasoup, by product decision. Join, mute, devices. |
| F092 | Voice preflight | Partial | Mic picker after permission. No speaker test or network score. |
| F093 | Voice mute broadcast | Partial | voice:state carries muted. No VoiceSession duration. |
| F094 | Active speaker | Done | LiveKit active speakers still drive the speaking dot. |
| F095 | TURN/STUN endpoint | Partial | GET /ice-servers returns Google STUN. LiveKit still owns the voice ICE path. |
| F096 | Friends | Partial | Request, accept, decline, remove, block, and name search with a 20/minute limit. No legacy duplicate API. |
| F097 | Friend presence | Done | A friend row shows the room they are in. |
| F098 | Top friends | Done | Top friends from shared watch time are listed. |
| F099 | Watch sessions | Missing | Not recorded. |
| F100 | Watch history | Missing | No table. |
| F101 | Favourite videos | Missing | No query. |
| F102 | Discovery feed | Done | Discovery suggestions from watch history show on the queue. |
| F103 | Public profile + privacy | Missing | No profile page. |
| F104 | Bio + current activity | Done | Bio can be edited from the people screen and is stored on the user. |
| F105 | Avatar upload + crop | Done | An avatar file is cropped to a square on a canvas and saved. |
| F106 | Profile share + user_ deep link | Done | startapp user_<id> opens that person's name on the people screen. |
| F107 | In-room profile modal | Missing | No modal. |
| F108 | 10 achievements + XP + levels | Partial | The old 10 achievements, XP, and level formula award on create, join, chat, and reaction. |
| F109 | Achievement pin slots | Done | Three pin slots can be filled from earned achievements. |
| F110 | Activity heatmap | Done | The studio returns 365 days and the people screen marks active ones. |
| F111 | Platforms chart | Done | Platform counts from watch history are listed. |
| F112 | Engagement widget | Missing | No voice-second total. |
| F113 | Host stats | Done | Hosted room count is shown. |
| F114 | Leaderboards | Partial | GET /stats exists and returns empty lists. No screen ranks people. |
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
| F128 | Health / live / ready | Partial | /health only. It does not fail when Postgres is down. |
| F129 | Prometheus metrics | Done (needs creds) | GET /metrics is tested. Events are not uploaded until SENTRY_DSN is set. |
| F130 | Rate limiting | Done | Every mutating route is limited. Redis is used when REDIS_URL is set, otherwise the same window stays in memory. |
| F131 | Feature flags | Done | GET /flags lists the product flags, including whether extractors are on. |
| F132 | Themes | Redesign | Жар and Мел wait for the design pack. Ember and Aurora stay. |
| F133 | i18n RU/EN | Partial | Flat dictionaries. Legacy namespaces are not loaded. |
| F134 | Landing page | Done | Signed-out home is the landing. Signed-in home is the session hub. |
| F135 | Home session hub | Redesign | The session-hub layout waits for the design pack. Resume and friends already exist as sections. |
| F136 | Telegram storage uploads | Done (needs creds) | Uploads stay on local disk. S3 and a Telegram storage chat are used when CDN_ENDPOINT or TELEGRAM_STORAGE_CHAT is set. |
| F137 | P2P segment mesh | Missing | Documented in docs/ROADMAP.md. Not built. |

## Checklist

The twelve phases in PARITY.md stay open until the rows they cover are Done. This file is the tracker. Update a row in the same commit that changes the behaviour.
