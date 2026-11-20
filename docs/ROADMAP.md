# Roadmap, known gaps and risks

This file is the decision log for work that is intentionally outside the
current parity slice. [PARITY_MATRIX.md](./PARITY_MATRIX.md) remains the feature
tracker: 122 rows are Done, 13 are Done (needs creds), 0 are Partial, and 2 are
Missing because they are deliberately not ported.

## 1. Done (needs creds)

These rows have a real screen, persisted backend behaviour and automated tests.
Only the live vendor call needs credentials or network access. Empty values keep
the feature off; CI uses fixtures and local test servers.

| ID | Feature | Environment keys that turn the live path on | Current behaviour |
| --- | --- | --- | --- |
| F051 | Extractor orchestrator | `FF_EXTRACTORS`, adapters' keys | Provider adapters run in order with per-attempt timeouts; `no_extractor`/`failed` are explicit |
| F052 | YouTube InnerTube | `FF_EXTRACTORS` + YouTube egress | Live player request; CI uses a local `node:http` fixture |
| F053 | VK extractor | `FF_EXTRACTORS`, `VK_COOKIES` | Live embed scraping with cookie rotation |
| F054 | Rutube extractor | `FF_EXTRACTORS` + Rutube egress | Live play-options; CI uses a local fixture |
| F055 | Twitch GQL | `FF_EXTRACTORS`, `TWITCH_CLIENT_ID`, optional `TWITCH_CLIENT_SECRET` | Live GQL token to usher HLS; the secret only adds the Helix title |
| F056 | Cobalt extractor | `COBALT_API_URL` | Chain step stays idle until a Cobalt URL is set |
| F057 | yt-dlp extractor | `YTDLP_PATH` | Chain step stays idle until a yt-dlp binary path is set |
| F064 | SearXNG search | `SEARXNG_URL` | Real video search; the API reports `unavailable` with a reason when not configured |
| F116 | Telegram bot notify | `TELEGRAM_BOT_TOKEN` (plus the account's `telegramId`) | In-app notices still save; `sendMessage` runs only with a token and linked Telegram id |
| F117 | Email notifications | `SMTP_HOST`, `SMTP_FROM`, optional `SMTP_PORT`/`SMTP_USER`/`SMTP_PASSWORD` | Real nodemailer delivery; `skipped` only when SMTP is missing |
| F118 | Web push + service worker | `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | Real web-push delivery to stored subscriptions; `skipped` without keys |
| F129 | Prometheus metrics / Sentry | `SENTRY_DSN`, optional `METRICS_TOKEN` | `GET /metrics` works and reports `lume_sentry_configured 0`; nothing is uploaded |
| F136 | Telegram / S3 storage uploads | `CDN_*` or `TELEGRAM_BOT_TOKEN` + `TELEGRAM_STORAGE_CHAT` | Real `PutObject`/`sendDocument` with Postgres metadata; production answers `503 storage_unconfigured` when neither is set |

Rows F052 and F054 have no environment variable today because they need live
egress, not a secret. If those providers become first-class integrations, add
explicit keys and update [CONFIG.md](./CONFIG.md) in the same commit.

## 2. Deliberately not ported

### F062 — CDN offload

The old service could upload a video buffer to S3-compatible storage and remember
the public URL. Nothing called it, and the request signature was incomplete. A
future version should cache popular HLS segments, not full buffers, behind
`CDN_ENDPOINT`, `CDN_BUCKET`, `CDN_ACCESS_KEY`, `CDN_SECRET_KEY`, `CDN_REGION`
and `CDN_PUBLIC_URL`. Unsigned or half-signed uploads stay out. `CDN_ENDPOINT`
is currently only a storage-backend marker for uploads; segment caching is not
built.

### F137 — P2P segment mesh

The old client had a WebRTC data-channel mesh and a service worker, and the
server relayed signalling. The client never registered that worker, so no bytes
moved. A later version can share HLS segments between viewers in the same room,
drop private ICE candidates, and stay behind a flag. Until then Lume does not
ship the mesh.

## 3. Pixel diff against design mocks

The reference HTML mocks came from an older environment and are intentionally
not committed. `e2e/diff.spec.ts` skips the comparison when
`/tmp/lume-design/final` is absent, so a fresh checkout and CI stay green.

When the mocks are present, the current accepted mismatches are:

| Screen | Mismatch |
| --- | ---: |
| Room dark | 26% |
| Home dark | 15% |
| Home light | 17% |
| Create | 26% |
| Join | 27% |
| Onboarding | 32% |

The test currently hard-asserts only Home dark (`< 30%`) and Room dark
(`< 42%`); the other cases are informational. Closing the remaining gap needs a
dedicated visual pass, not more functional parity work.

## 4. Phase 6 — production hardening

| Item | Why | Definition of done |
| --- | --- | --- |
| k6 load tests | The current suite proves behaviour, not capacity | Scripts for join, chat, playback sync and queue writes; documented p95 latency and error budget at the target room count |
| OpenTelemetry | Prometheus counters alone cannot follow one room across API, realtime, worker and Redis | OTLP traces for HTTP, Socket.IO and BullMQ; sampling and redaction rules; staging exporter and dashboard |
| Staging environment | Production-only failures (TLS, CORS, Redis, LiveKit, SMTP) are invisible in CI | A staging stack with production-like env, seeded data, migrations and smoke checks |
| Backups and restore drills | Accounts, rooms, chat and history live in Postgres | Automated Postgres backups with point-in-time recovery, Redis snapshot policy, a documented restore drill and retention |
| BotFather production setup | Telegram Mini App and bot links depend on external bot configuration | Production bot, menu button, allowed origins, webhook/polling mode, secret rotation and a rollback note |

## 5. Phase 7 — monetization and growth

| Item | Why | Definition of done |
| --- | --- | --- |
| Telegram Stars payments | The free product stays fully usable; cosmetics are the paid layer | Invoice creation, webhook verification, idempotent fulfilment, refunds and a purchase audit trail |
| Referral system | Growth loop for Telegram and web invitations | Signed referral links, anti-abuse limits, attribution stored on the account, and a reward ledger |
| Product analytics | Decisions need real funnels instead of guesses | Event schema, consent-aware collection, retention cohorts, and dashboards for activation, room creation, watch time and retention |

Payments are not part of the current slice. The product model already has the
premium flag and cosmetic boundaries, but no checkout is wired.

## 6. Known technical debt and risks

- Uploads persist metadata in Postgres and bytes in S3/R2 or Telegram storage.
  Local disk remains a development-only backend; production without storage
  answers `503 storage_unconfigured`.
- The F041 proactive refresher runs as a BullMQ `media.refresh` job every minute
  for the playing item of active rooms. Manual refresh re-extracts and persists.
- Live metadata is cached in Redis with a 5-minute TTL and a circuit breaker;
  provider outages return `null` instead of hanging the request.
- Redis is required in production: the API refuses to boot without it.
- SMTP and web push send for real. Missing credentials produce `skipped` rows
  with a logged reason, never a fake `sent`.
- The API integration suite shares one Postgres database and serializes test
  files. It is stable, but parallelizing it requires per-worker schemas or
  transactional isolation.
- Playwright runs against built apps (`vite preview`, `node dist/index.js`), so
  `pnpm build` must run before `pnpm test:e2e`. A stale build produces misleading
  failures.
- Realtime scales by hashing rooms across replicas. Multi-replica deployments
  need shared Redis and the owner-enforcement setting; otherwise room writes can
  split.
- LiveKit Cloud is a vendor dependency for voice. An outage disables voice while
  chat and playback continue.
- External extractors break when providers change markup or anti-bot rules. The
  fixture tests prove the contract, not provider availability.
- The remaining pixel differences above are accepted debt, not visual parity.
- CI needs Postgres 16, Redis 7, migrations, a build and Chromium. It is heavier
  than a unit-only pipeline; caching pnpm and the browser is required to keep it
  fast.
