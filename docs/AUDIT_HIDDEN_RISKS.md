# Hidden-risk audit (branch `cursor/lume-greenfield-87d4`)

Deep audit performed on 2026-11-20. Every item below has a regression test.

## 1. Realtime / React

- [x] F039: buffering phase is cleared on `room:leave`, `disconnect` and `mod:kick`.
- [x] F039: a held `play` is remembered and resumes automatically once no viewer buffers; it cannot be lost on a CAS conflict.
- [x] Host leave still pauses: a pending held play is dropped before the host-departure pause.
- [x] Room switching: a socket that joins a second room departs the previous room.
- [x] `react-hooks/exhaustive-deps`: 6 warnings -> 0 (`pnpm lint` is clean).

## 2. Proxy / resolver security (F058, F060, F061)

- [x] `ipBlocked` / `urlBlocked`: bracketed IPv6 (`[::1]`), IPv4-mapped, link-local, ULA, multicast, 6to4, NAT64.
- [x] `/video/range` and `/video/hls-proxy`: every redirect hop re-resolves the host and refuses private addresses.
- [x] Read caps: 512 KB OpenGraph page, 1 MB oEmbed JSON, 1 MB HLS/DASH text manifest (413 on overflow).
- [x] CORS: range headers exposed and the local dev origin alias (`localhost` / `127.0.0.1`) allowed.

## 3. No-stub mode and DB errors

- [x] `ALLOW_STUB_AUTH=false` + `ALLOW_STUB_VOICE=false` + empty provider keys -> clear 4xx/503, no 500.
- [x] Prisma `P2002` -> 409, `P2025` -> 404, `P2003` -> 409, connection `P1xxx` -> 503; raw errors never reach the client.
- [x] Fire-and-forget requests in the live room are guarded; voice failure/disabled states are visible.

## Verification

`pnpm lint`, `pnpm typecheck`, `pnpm build`, `pnpm test`, `pnpm test:e2e`.
