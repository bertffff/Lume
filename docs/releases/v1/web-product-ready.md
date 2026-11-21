# Web product-ready — verification evidence

Date: 2026-11-21. Branch: `cursor/lume-greenfield-87d4`.

## Delivered

| Area | Evidence |
| --- | --- |
| Theme split | `surfaces.css` owns geometry; `check-theme-tokens.mjs` rejects geometry in theme files; 137 before/after screenshots were pixel-identical |
| Contrast | `design/contrast.test.ts` asserts WCAG AA for cinema/gruvbox × dark/light |
| Room flow | `resolveFlow` measures the room container; resize handles persist `playerRatio` 0.35–0.8; `e2e/room-flow.spec.ts` covers side/below/stack |
| Session rail | 48px narrow rail with SVG icons, tooltips, unread/voice badges and keyboard focus; `e2e/room-chat.spec.ts` |
| Chat | sticky-bottom follow, "к новым сообщениям", image previews through the real upload/socket pipeline |
| Emoji | viewport-clamped portal, flip above the composer, Tab trap, Esc/outside close, focus restore |
| Voice | stable cards, speaking ring, deafen, explicit fallback banner |
| Primitives | Button/Field/Toggle/Badge/Card/Modal/ConfirmDialog/Toast/States with jsdom tests |
| Shell and dead code | `AppShell`, admin on primitives, dead `RoomLayoutView` panels, Lobby, PeopleScreen, legacy `.tr-*` layer removed |
| i18n | zero Cyrillic literals outside dictionaries, guarded by `i18n/hardcoded.test.ts`; parameter interpolation |
| Telegram | design-token theme params, BackButton on sub-screens, haptics, `100dvh` + safe areas, single scroll |
| A11y | axe-core WCAG 2 A/AA on home/create/join/auth: no serious/critical findings |
| E2E | per-test users, serial aggregate specs, build freshness gate, 40 committed baselines |

## Commands

`pnpm lint` — 9/9 tasks, theme guard clean. `pnpm typecheck` — 13/13. `pnpm build` — 9/9, zero warnings (bundle budget 720 kB). `pnpm test` — 12/12 tasks; web 24 tests. `pnpm test:e2e` — 64 passed, 17 skipped, 0 failed.

## Known gaps

- Live provider calls stay out of CI; fixtures and local servers prove the contract.
- Premium/payment flows remain out of scope; no dead links to them were introduced.
- The E2E suite is serialized for aggregate-sensitive specs; a test-only Redis scope header was deliberately not added.
