# Parity matrix

Counts below are the current branch, not the Phase 4 baseline. A feature is Done only when the API or socket, the UI, and a test are all present.
Source of the feature list: [PARITY.md](./PARITY.md). Legacy copy: [legacy-locales](./legacy-locales/).

| Status | Count |
| --- | ---: |
| Done | 13 |
| Partial | 62 |
| Missing | 62 |

A row is Done only when the API or socket, the UI, and a test all exist. A tested rule with no screen stays Partial. Partial means a slice exists and the rest is still open. Missing means Lume has no user-facing behaviour for it.

Voice uses LiveKit Cloud, not the old mediasoup process. That is a locked product decision. ICE and speaker detection go through LiveKit.

| ID | Feature | Lume | What is true now |
| --- | --- | --- | --- |
| F001 | Email + password register | Partial | Register exists with the old shape rules. Hash is scrypt, not bcrypt. No Redis-down 503. |
| F002 | Email + password login | Partial | Login checks the password and refuses a finished deletion. No 20/15 rate limit yet. |
| F003 | JWT access + rotating refresh | Partial | Access JWT only. No refresh rotation or deletedAt check. |
| F004 | Logout with server revocation | Partial | Client clears the session. The server does not revoke it. |
| F005 | Magic-link login | Missing | No token, mail, or verify route. |
| F006 | Telegram Mini App auth | Partial | HMAC initData works. Max age is 24h, not 300s. |
| F007 | Telegram Login Widget | Missing | No widget hash verification. |
| F008 | Link / unlink Telegram | Missing | No link routes. |
| F009 | Linked accounts status | Missing | No endpoint. |
| F010 | Dev auth bypass | Done | ALLOW_STUB_AUTH guest JWT. |
| F011 | Post-auth pending room | Missing | No sessionStorage resume. |
| F012 | Onboarding | Missing | No steps or flag. |
| F013 | GDPR ZIP export | Partial | GET /me/export/:token returns a ZIP for 24h, then 410. The lobby has no download button yet. |
| F014 | Account deletion + purge | Partial | Soft delete, restore, and a BullMQ purge at 03:00 UTC. The worker needs Redis and Postgres. |
| F015 | Create room wizard + presets | Partial | Title and public flag only. Codes are 6 chars. |
| F016 | Join by code | Partial | Join works. No /join/:code route. |
| F017 | Join bans, capacity, history | Partial | Join refuses a room ban, a session ban, and the owner's blacklist. System lines are still thin. |
| F018 | Permanent vs temporary host | Partial | Owner reclaim and temporary host on leave. System line for reclaim is not separate. |
| F019 | Host succession | Partial | Leave promotes a mod, otherwise the earliest member. Playback is not paused. |
| F020 | Resume-last-room snapshot | Partial | Empty room writes lastRoomSnapshot. People screen shows Продолжить просмотр. Recreate route is not wired. |
| F021 | Room settings | Missing | No description, max, defaults, hideReactions. |
| F022 | Browse public rooms | Partial | Public list only. No search, filters, or sorts. |
| F023 | Live carousel + global stats | Missing | No stats endpoint. |
| F024 | Share links ?t= ?v= | Done | The player copies a link with ?t= and ?v=, and opening that link queues the video and seeks. |
| F025 | Room invites | Missing | No invite event. |
| F026 | Watch reminders | Missing | No persisted reminder. |
| F027 | DB-backed queue reload | Partial | Queue is in Postgres. No room history table. |
| F028 | Layout presets × aspect | Partial | Resizable panels and aspect reflow exist. No enlarged/immersive presets. |
| F029 | Mobile room sheet | Partial | Reflow stacks panels. No chat/members/queue sheet. |
| F030 | Session dock | Partial | Room bar exists. Voice is a side panel. |
| F031 | Report user/room | Partial | POST /reports, 5/hour. No in-room form yet. |
| F032 | Multi-source playback | Partial | YouTube, Vimeo, Twitch, HTML5/HLS adapters. No DASH or merged audio. |
| F033 | VK + Rutube embeds | Partial | Best-effort adapters, not the postMessage APIs. |
| F034 | Host playback control | Partial | Play, pause, seek. No playback rate. |
| F035 | NTP clock sync | Done | The room client takes five clock samples, keeps the median offset, and repeats every minute. |
| F036 | Adaptive drift correction | Done | Followers use the drift plan: soft rate on HTML5, hard seek, anti-loop, and buffer grace. |
| F037 | Host heartbeats | Missing | Viewers follow the anchor, not a 1s heartbeat. |
| F038 | Sync indicator | Done | The player shows synced, syncing, lagging, or waiting, and a resync button seeks to the server clock. |
| F039 | Buffering / ready | Partial | Viewer phase is reported. No ready gate. |
| F040 | Vote-skip | Done | playback:vote-skip is on the socket, the player shows the count, and the host or a majority plays the next item. |
| F041 | Video URL refresh | Missing | No re-extract path. |
| F042 | Player error recovery | Partial | Limited-source copy only. |
| F043 | Tap gesture zones | Missing | No seek flash. |
| F044 | Progress, fullscreen, speed | Partial | Native controls on HTML5. No custom speed menu. |
| F045 | Quality selector | Missing | No quality preference. |
| F046 | Low-bandwidth mode | Missing | No flag or toggle. |
| F047 | Floating reactions | Partial | Quick emojis float over the player. Room-wide and personal hide switches are not in the UI. |
| F048 | Chat timecode jump | Done | A chat line with a timecode has a jump button that seeks. |
| F049 | Sync telemetry | Missing | No incident log. |
| F050 | Source detection | Partial | 25-source detector and playback plan exist. Not every extractor runs. |
| F051 | Extractor orchestrator | Partial | Empty registry behind FF_EXTRACTORS. |
| F052 | YouTube InnerTube | Missing | Embed only. |
| F053 | VK extractor | Missing | No cookie rotation. |
| F054 | Rutube extractor | Missing | No play-options call. |
| F055 | Twitch GQL | Missing | Embed only. |
| F056 | Cobalt extractor | Missing | No client. |
| F057 | yt-dlp extractor | Missing | Flag refuses extractors. |
| F058 | Metadata resolver | Partial | oEmbed for YouTube and Vimeo. |
| F059 | Premium extraction gate | Partial | planPlayback returns premium_required for extraction-only sources. |
| F060 | Stream proxy | Missing | No Range proxy. |
| F061 | HLS/DASH manifest rewrite | Partial | GET /video/hls-proxy rewrites manifests when FF_EXTRACTORS=true and returns 410 on an expired upstream. Chains are not all implemented. |
| F062 | CDN offload | Missing | Not implemented. Decision still open. |
| F063 | SSRF protection | Partial | The proxy refuses private URLs. DNS pinning is not in the fetcher yet. |
| F064 | SearXNG search | Missing | No search endpoint. |
| F065 | Cobalt services list | Missing | No endpoint. |
| F066 | Video detect endpoint | Missing | Detection is client-side only. |
| F067 | Shared queue | Partial | Add and next. No reorder, duplicate guard, or optimistic metadata fill. |
| F068 | Queue history | Missing | Played flag only. No history list. |
| F069 | Queue recommendations | Missing | No discovery feed. |
| F070 | Auto-advance | Missing | Ended does not play the next item. |
| F071 | Chat text | Partial | Messages work. Limit is 2000, not 500. Enter sends. |
| F072 | Replies | Done | replyToId is stored and shown. |
| F073 | Image messages | Missing | No upload. |
| F074 | Chat reactions max 3 | Done | A fourth distinct emoji from the same person is rejected. |
| F075 | Emoji picker | Missing | Three fixed emoji. |
| F076 | Pinned message | Missing | Not stored. |
| F077 | Typing indicator | Missing | No event. |
| F078 | Mentions | Missing | No highlight. |
| F079 | Unread anchor | Missing | No jump. |
| F080 | System messages | Partial | Join writes «присоединился к комнате». Leave and host-change lines are not written. |
| F081 | Slow mode | Partial | Chat send returns 429 slow_mode for non-hosts. The composer has no countdown. |
| F082 | Six member permissions | Partial | A host sees six permission toggles and an override flag. Room defaults are not edited from settings. |
| F083 | Make host | Missing | Host can make a mod, not transfer host. |
| F084 | Kick | Done | Kick still persists leftAt. |
| F085 | Session / permanent / global ban | Partial | Session, permanent, and blacklist bans are stored and the target is kicked. Join does not consult them yet. |
| F086 | Mute and temp-mute | Done | Temp mute is 30s–24h, stored on the member, and blocks join and chat until it expires. |
| F087 | Moderation log | Done | The voice panel lists the persisted moderation log for a host or mod. |
| F088 | Member action sheet | Partial | Kick, mute, promote. No ban or report. |
| F089 | Blacklist management | Missing | No list or remove. |
| F090 | Moderation presets | Missing | No create-wizard presets. |
| F091 | Voice chat | Partial | LiveKit instead of mediasoup, by product decision. Join, mute, devices. |
| F092 | Voice preflight | Partial | Mic picker after permission. No speaker test or network score. |
| F093 | Voice mute broadcast | Partial | voice:state carries muted. No VoiceSession duration. |
| F094 | Active speaker | Done | LiveKit active speakers still drive the speaking dot. |
| F095 | TURN/STUN endpoint | Partial | LiveKit Cloud owns ICE. No /ice-servers. |
| F096 | Friends | Partial | Request, accept, decline, remove, block, and name search with a 20/minute limit. No legacy duplicate API. |
| F097 | Friend presence | Missing | No friend:presence. |
| F098 | Top friends | Missing | No WatchSession. |
| F099 | Watch sessions | Missing | Not recorded. |
| F100 | Watch history | Missing | No table. |
| F101 | Favourite videos | Missing | No query. |
| F102 | Discovery feed | Missing | No endpoint. |
| F103 | Public profile + privacy | Missing | No profile page. |
| F104 | Bio + current activity | Missing | No bio column. |
| F105 | Avatar upload + crop | Missing | avatarUrl column unused. |
| F106 | Profile share + user_ deep link | Missing | startapp is not routed. |
| F107 | In-room profile modal | Missing | No modal. |
| F108 | 10 achievements + XP + levels | Partial | The old 10 achievements, XP, and level formula award on create, join, chat, and reaction. |
| F109 | Achievement pin slots | Missing | No pinSlot. |
| F110 | Activity heatmap | Missing | No aggregate. |
| F111 | Platforms chart | Missing | No aggregate. |
| F112 | Engagement widget | Missing | No voice-second total. |
| F113 | Host stats | Missing | No widget. |
| F114 | Leaderboards | Missing | No /stats. |
| F115 | In-app notifications | Partial | In-app feed is stored and listed. No socket badge. |
| F116 | Telegram bot notify | Partial | Telegram sendMessage runs when TELEGRAM_BOT_TOKEN and telegramId are set. |
| F117 | Email notifications | Partial | Email channel returns a stub. SMTP is not configured. |
| F118 | Web push + service worker | Partial | A service worker is registered and handles push and click. VAPID subscribe is not issued. |
| F119 | Per-channel × type prefs | Partial | Channel × kind preferences and digest/quiet hours can be saved. |
| F120 | Digests + quiet hours | Partial | Quiet hours and digest scheduling are tested. The 15-minute worker is not running. |
| F121 | Digest preview | Partial | Digest preview returns the queued count. |
| F122 | Admin dashboard | Partial | GET /admin/overview counts users, rooms, and open reports. |
| F123 | Admin users | Partial | Admin user search and soft ban. No SUPERADMIN-only role change. |
| F124 | Admin rooms + force close | Partial | Force-close marks the room ended and asks realtime to disconnect sockets. |
| F125 | Admin reports | Partial | Open reports can be reviewed or dismissed. |
| F126 | Audit log | Partial | Audit rows are written for reports, bans, and force-close. |
| F127 | Admin deep links | Missing | No /admin route. |
| F128 | Health / live / ready | Partial | /health only. It does not fail when Postgres is down. |
| F129 | Prometheus metrics | Missing | No /metrics. |
| F130 | Rate limiting | Missing | No sliding window. |
| F131 | Feature flags | Partial | FF_EXTRACTORS only. |
| F132 | Themes | Partial | Aurora stays locked unless theme.aurora is granted. The name Аврора receives it plus flair.spark. |
| F133 | i18n RU/EN | Partial | Flat dictionaries. Legacy namespaces are not loaded. |
| F134 | Landing page | Partial | Lobby is the signed-out screen. No separate hero. |
| F135 | Home session hub | Missing | No greeting, resume, or friends block. |
| F136 | Telegram storage uploads | Missing | No storage adapter. |
| F137 | P2P segment mesh | Missing | Dead in the old app. Not ported. Kept behind a flag decision. |

## Checklist

The twelve phases in PARITY.md stay open until the rows they cover are Done. This file is the tracker. Update a row in the same commit that changes the behaviour.
