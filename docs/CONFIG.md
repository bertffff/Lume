# External credentials

Empty values keep the feature off. Tests never call these services.

| Variable | Feature | When it is empty |
| --- | --- | --- |
| `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET` | Voice | The panel says voice is off |
| `TELEGRAM_BOT_TOKEN` | Telegram notifications and Mini App verification | In-app notices still save. Dev initData can be stubbed |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM` | Email | `email` delivery returns `skipped`. Magic links are returned in the API response |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | Web push | The service worker is registered. Push send returns `skipped` |
| `SENTRY_DSN` | Error upload | `GET /metrics` reports `lume_sentry_configured 0`. Nothing is sent |
| `FF_EXTRACTORS`, `COBALT_API_URL`, `YTDLP_PATH`, `VK_COOKIES`, `TWITCH_CLIENT_ID`, `TWITCH_CLIENT_SECRET` | Live extraction | Resolvers use fixtures and return `unconfigured` |
| `SEARXNG_URL` | Video search | Search returns an empty list |
| `METRICS_TOKEN` | Prometheus | `/metrics` is open when this is empty |
| `CDN_*` | Segment cache | Not built. See `docs/ROADMAP.md` |

Themes for the upcoming redesign, not wired as fonts yet: Geologica, Onest, JetBrains Mono. Palettes: Жар, Уголь, Аврора, Мел.
