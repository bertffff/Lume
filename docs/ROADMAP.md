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
| F051 | Extractor orchestrator | `FF_EXTRACTORS`, `COBALT_API_URL`, `YTDLP_PATH` | Fixture extractors run; live steps return `unconfigured` until configured |
| F052 | YouTube InnerTube | No dedicated key; live YouTube egress + a recorded fixture | InnerTube is accepted from a fixture. Live YouTube is not called in CI |
| F053 | VK extractor | `VK_COOKIES` | VK HLS is parsed from a fixture. Cookie rotation stays off until cookies are set |
| F054 | Rutube extractor | No dedicated key; live Rutube egress | Rutube m3u8 is parsed from a fixture. Live play-options stay off without network access |
| F055 | Twitch GQL | `TWITCH_CLIENT_ID`, `TWITCH_CLIENT_SECRET` | Playback URLs are parsed from a fixture. Live GQL stays off without credentials |
| F056 | Cobalt extractor | `COBALT_API_URL` | Chain step stays idle until a Cobalt URL is set |
| F057 | yt-dlp extractor | `YTDLP_PATH` | Chain step stays idle until a yt-dlp binary path is set |
| F064 | SearXNG search | `SEARXNG_URL` | Queue search returns an empty list until SearXNG is configured |
| F116 | Telegram bot notify | `TELEGRAM_BOT_TOKEN` (plus the account's `telegramId`) | In-app notices still save; `sendMessage` runs only with a token and linked Telegram id |
| F117 | Email notifications | `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM` | Email delivery returns `skipped`; magic links are returned in the API response |
| F118 | Web push + service worker | `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | The service worker is registered; push send returns `skipped` |
| F129 | Prometheus metrics / Sentry | `SENTRY_DSN`, optional `METRICS_TOKEN` | `GET /metrics` works and reports `lume_sentry_configured 0`; nothing is uploaded |
| F136 | Telegram / S3 storage uploads | `TELEGRAM_BOT_TOKEN`, `TELEGRAM_STORAGE_CHAT`, `CDN_ENDPOINT` | Local disk is the default. The other backends are selected by env; real S3 signing/upload is still a stub |

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

- Uploads are kept in an in-memory `Map` (plus a local-disk marker) and disappear
  on API restart. Real object storage and signed URLs are still needed.
- `CDN_ENDPOINT` and `TELEGRAM_STORAGE_CHAT` select a backend marker; they do not
  perform a real S3 or Telegram upload yet.
- The proactive video URL refresher from F041 is not scheduled. Refresh is manual
  and preserves the current time and play state.
- Live metadata depends on provider oEmbed/OpenGraph. There is no production
  cache, circuit breaker or per-provider budget yet.
- Redis is optional in the schema but required for production auth and reliable
  rate limiting. Treating it as optional in deployment is a production risk.
- SMTP and web push are guarded stubs. They report `skipped`; they do not send
  mail or push notifications yet.
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
