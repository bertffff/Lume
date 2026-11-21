# Configuration and external credentials

Lume reads configuration from the process environment first and then from the
repository-root `.env` file. The loader never overrides a variable that is
already present in the process. `.env` is gitignored; copy the names from
[`.env.example`](../.env.example) and keep real values local.

Empty values deliberately keep optional features off. Automated tests never call
external services; they use fixtures, local `node:http` servers, or the
`ALLOW_STUB_*` switches.

## Local commands

```bash
pnpm install
cp .env.example .env
docker compose up -d          # Postgres 16 and Redis 7
pnpm db:migrate
pnpm dev
```

## Tests

`pnpm test` recreates `lume_test` for the API integration suite. Playwright E2E
also runs strictly against `lume_test`: `apps/api/scripts/prepare-e2e-db.ts`
recreates it and applies migrations before the API boots, so specs never write
rooms or users into the developer database `lume`. The E2E config always starts
its own API, realtime and preview servers on ports 3001, 3002 and 5173; stop
`pnpm dev` (or free those ports) before `pnpm test:e2e`.

Minimum useful local `.env`:

```bash
DATABASE_URL=postgresql://lume:lume@localhost:5432/lume?schema=public
REDIS_URL=redis://localhost:6379
JWT_SECRET=replace-with-a-long-random-string
ALLOW_STUB_AUTH=true
ALLOW_STUB_VOICE=true
```

`ALLOW_STUB_AUTH` and `ALLOW_STUB_VOICE` are development/test switches. Never
enable them in production.

## Core services

| Variable | Required | Feature | Empty or default behaviour |
| --- | --- | --- | --- |
| `NODE_ENV` | Production: yes | Runtime mode (`development`, `test`, `production`) | Defaults to `development` |
| `API_HOST`, `API_PORT` | No | API bind address | `0.0.0.0:3001` |
| `WEB_ORIGIN` | Production: yes | CORS origin and links in notifications | `http://localhost:5173` |
| `DATABASE_URL` | Production: yes | Postgres for accounts, rooms, queue, history, moderation | API still starts, but persisted routes return `503 database_unconfigured` |
| `REDIS_URL` | Production: **required** | Presence, refresh tokens, magic links, rate limits, worker queues | The API refuses to start in production without it. Development and tests fall back to in-memory stores |
| `REDIS_KEY_PREFIX` | No | Namespace for auth state and rate limits | `lume`; Playwright E2E uses `lume:e2e` so runs never share tokens |
| `JWT_SECRET` | Production: yes | Access-token signing | Token issuing returns `jwt_unconfigured` |
| `JWT_TTL_SECONDS` | No | Access-token lifetime | `43200` (12 hours) |
| `REALTIME_HOST`, `REALTIME_PORT` | No | Socket.IO bind address | `0.0.0.0:3002` |
| `REALTIME_REPLICA_INDEX`, `REALTIME_REPLICA_COUNT` | No | Room-hash routing between realtime replicas | `0` and `1`; the index must be smaller than the count |
| `REALTIME_ENFORCE_ROOM_OWNER` | No | Reject writes from a realtime replica that does not own the room hash | `false` |
| `API_URL` | Production: yes | API base used by realtime | `http://127.0.0.1:3001` |
| `REALTIME_URL` | Production: yes | Realtime base used by the API | `http://127.0.0.1:3002` |
| `VITE_API_URL`, `VITE_REALTIME_URL` | Production: yes | Browser build-time API and socket URLs | `http://127.0.0.1:3001` and `:3002` |
| `WORKER_HOST`, `WORKER_PORT` | No | Worker health server | `0.0.0.0:3003` |
| `BOT_HOST`, `BOT_PORT` | No | Bot health server | `0.0.0.0:3004` |

## Auth and Telegram

| Variable | Required | Feature | Empty or default behaviour |
| --- | --- | --- | --- |
| `TELEGRAM_BOT_TOKEN` | For Telegram auth/notifications | Mini App `initData` HMAC, Login Widget, bot polling, Telegram notifications | Dev auth can be stubbed; Telegram delivery is skipped |
| `TELEGRAM_BOT_USERNAME` | For bot deep links | Public bot name used in generated links | No bot link is emitted |
| `TELEGRAM_STORAGE_CHAT` | Optional | Telegram upload storage; requires `TELEGRAM_BOT_TOKEN` | Without both, uploads fall through to S3 or local disk |
| `WEBAPP_URL`, `MINI_APP_URL` | For bot deep links | Public HTTPS Mini App URL used by the `/start` `web_app` button | The bot replies with a text link and says the Mini App is not configured |
| `TELEGRAM_AUTH_MAX_AGE_SECONDS` | No | Maximum accepted `initData` age | `300` seconds; data more than 30 seconds in the future is rejected |
| `ALLOW_STUB_AUTH` | Local/test only | Guest JWT and `initData` without a bot token | `false` |
| `ALLOW_STUB_VOICE` | Local/test only | Voice token stub advertised by `GET /voice/livekit` | `false` |
| `DEV_ADMIN_NAMES` | Optional | Display names promoted to admin in development | No automatic admins |

## Voice (LiveKit Cloud)

| Variable | Required | Feature | Empty or default behaviour |
| --- | --- | --- | --- |
| `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET` | For real voice | LiveKit token minting, mute and disconnect | Voice panel says voice is off; token route returns `livekit_disabled` |
| `LIVEKIT_TOKEN_TTL_SECONDS` | No | LiveKit token lifetime | `3600` seconds |
| `STUN_URLS` | No | Comma-separated STUN list from `GET /ice-servers` | Google STUN |
| `TURN_URL`, `TURN_URLS` | No | TURN/TURNS URLs from `GET /ice-servers` | No relay |
| `TURN_USERNAME`, `TURN_CREDENTIAL` | With TURN | TURN credentials | TURN entries are omitted or unusable |

Voice uses LiveKit Cloud by product decision. The mediasoup process from
TeleRave-v2 is not ported and is not planned.

## Media extraction, metadata and streaming

| Variable | Required | Feature | Empty or default behaviour |
| --- | --- | --- | --- |
| `FF_EXTRACTORS` | Optional | Enables the live extractor chain (YouTube InnerTube, Rutube, VK, Twitch, Cobalt, yt-dlp) | `/video/resolve` and `/video/refresh` answer `extractors_disabled`; nothing is guessed |
| `MEDIA_EXTRACTOR_TIMEOUT_MS` | No | Per-adapter and whole-chain deadline | `15000` ms |
| `COBALT_API_URL` | For Cobalt | Cobalt extractor and `GET /video/services` entry | Cobalt stays idle |
| `YTDLP_PATH` | For yt-dlp | yt-dlp chain step | yt-dlp stays idle |
| `VK_COOKIES` | For live VK | Cookie header(s); separate attempts with `||` rotate on login walls | VK fetch runs without cookies |
| `TWITCH_CLIENT_ID` | For live Twitch GQL | Twitch playback tokens; also enables the adapter | Twitch is skipped as `twitch_unconfigured` |
| `TWITCH_CLIENT_SECRET` | Optional | Optional Helix title lookup | Titles fall back to the channel name |
| `SEARXNG_URL` | For video search | Queue search through SearXNG (`categories=videos`) | Search returns `{ unavailable: true, reason: "searxng_unconfigured" }` |
| `OEMBED_BASE_URL` | Optional | Local/test oEmbed proxy; receives `?url=<encoded source>` | Provider oEmbed endpoints are tried directly |
| `METADATA_ALLOW_PRIVATE_HOSTS` | Test only | Allow private hosts when reading OpenGraph pages | `false`; private hosts are refused |
| `STREAM_ALLOWLIST` | Optional | Comma-separated host allowlist for `/video/range` and `/video/hls-proxy` | Only public hosts allowed by SSRF checks |
| `STREAM_MAX_BYTES` | No | Upstream stream cap | `524288000` (500 MB) |
| `STREAM_ALLOW_PRIVATE_HOSTS` | Test only | Allow private upstream hosts | `false` |
| `STREAM_HEADER_TIMEOUT_MS` | No | Upstream header timeout | `10000` ms |
| `CDN_ENDPOINT`, `CDN_BUCKET`, `CDN_ACCESS_KEY`, `CDN_SECRET_KEY` | For S3/R2 uploads | Real `PutObject` upload; the object key and metadata are stored in Postgres | The backend is skipped; production uploads answer `503 storage_unconfigured` |
| `CDN_PUBLIC_URL` | Optional | Public base for uploaded objects | `${CDN_ENDPOINT}/${CDN_BUCKET}/${key}` |
| `CDN_REGION` | Optional | S3 client region | `auto` (R2-compatible) |

Live extractors are opt-in. CI and normal test runs use recorded fixtures and
must stay offline.

## Notifications, metrics and operations

| Variable | Required | Feature | Empty or default behaviour |
| --- | --- | --- | --- |
| `SMTP_HOST`, `SMTP_FROM` | For email | Real nodemailer delivery for digests and magic links | Delivery is marked `skipped` with a logged reason, never `sent` |
| `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD` | With SMTP | SMTP connection details (465 uses TLS) | Port defaults to 587; auth is omitted without user and password |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | For web push | Real web-push delivery to stored subscriptions | Push is marked `skipped` with a logged reason |
| `SENTRY_DSN` | Optional | Error upload | `GET /metrics` reports `lume_sentry_configured 0`; nothing is sent |
| `METRICS_TOKEN` | Production: recommended | Bearer token for `GET /metrics` | Metrics endpoint is open |
| `DEV_ADMIN_NAMES` | Optional | Development admin promotion | No automatic admins |

## Deployment notes

- Set `NODE_ENV=production`, `DATABASE_URL`, `REDIS_URL`, `JWT_SECRET`,
  `WEB_ORIGIN`, `API_URL`, `REALTIME_URL`, and the two `VITE_*` URLs. Put the
  real values in the platform secret store, never in Git.
- Run `pnpm db:migrate` against the production database before starting the
  API. Run `pnpm build` once per release; the API, realtime and bot start from
  `dist/`.
- Expose only the web origin publicly. Keep Postgres and Redis on a private
  network. Terminate TLS at the reverse proxy and forward WebSocket upgrades to
  realtime.
- `/health` is liveness; `/ready` runs `SELECT 1` against Postgres and `PING`
  against Redis. Production returns `503` when either is missing or down.
  Point orchestrator probes at both.
- Configure LiveKit Cloud, SMTP, VAPID and `TELEGRAM_BOT_TOKEN` only after the
  core services are healthy. Missing optional credentials degrade features; they
  do not crash the process.
- Rate limits and auth state use Redis when `REDIS_URL` is set. Production
  without Redis refuses to boot (config error), so do not treat it as optional.
- Uploads need `CDN_*` or `TELEGRAM_*` in production; otherwise the API answers
  `503 storage_unconfigured` instead of returning a link that will break.
- Live extraction stays off unless `FF_EXTRACTORS` is `1` or `true`.
- Metrics are available at `GET /metrics`. Set `METRICS_TOKEN` before exposing
  the endpoint outside a private network.

## Design references

Themes planned for the redesign, not wired as fonts yet: Geologica, Onest,
JetBrains Mono. Palettes: Жар, Уголь, Аврора, Мел.
