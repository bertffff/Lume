# Lume UX Parity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship three distinct layouts over live Lume, six-character invites, and a categorized public-room feed.

**Architecture:** Shared contracts and live view models feed independent style compositions. The server owns visibility, code issuance, category, and playback-derived data.

**Tech Stack:** React, Vite, TypeScript, Fastify, Prisma/Postgres, Socket.IO, Redis, LiveKit, Lucide, Vitest, Playwright.

**Spec:** [Approved design](../specs/2026-11-21-lume-ux-parity-design.md) and [static audit](../../UX_PARITY_AUDIT.md).

## Global Constraints

- Work on `cursor/lume-greenfield-87d4`; never switch to or push `main`. No Premium/payment work or production deploy. Leave user-supplied untracked references unchanged.
- RED → GREEN per task. The integrator owns `DesignApp.tsx`, `pages.tsx`, shared locale files, Playwright config and baselines. Agents own only their assigned files. Run in parallel only with disjoint write surfaces; no agent commits or pushes from the shared index.
- No fake progress, time, quality, latency or users. Russian control labels, visible hover/focus, WCAG AA, padding ≥ `6px 12px`, gap ≥ `8px`. Capture and read screenshots at `1440×900` and `390×844`; also verify widths 360 and 430.
- Isolate E2E DB, Redis and ports. Build before Playwright. Fix existing Vite warning without raising the reporting threshold. Temporary screenshots outside Git; update only reviewed versioned Playwright baselines.

## Review Focus

1. Old invites must not return from rollback; migration preserves room IDs, dependent rows and permissions (Task 2).
2. Friend presence and public summaries must not reveal closed rooms; private members may still use the private room normally (Task 1).
3. Concurrent refresh/filter changes must not append stale/duplicate directory pages (Tasks 4, 6).
4. Missing playback, a changed video and sparse activity must not produce fabricated metrics or change another participant's playback (Tasks 5, 7).
5. Long notification text, six-code paste and room controls must remain accessible in narrow Mini App with system-mode changes (Tasks 2, 3, 7–9).

---

### Task 0: Isolated verification runner (integrator, before API/browser RED)

**Files:** `playwright.config.ts`, `apps/api/scripts/prepare-e2e-db.ts`, `apps/api/vitest.global-setup.ts` (safety check), `turbo.json` (build-env hashing if needed), release evidence under `docs/releases/`.

**Interfaces:** parameterize local API/realtime/web/mock ports and endpoint origins together, with `VITE_API_URL`/`VITE_REALTIME_URL` set at build time. Require a positively identified disposable E2E database and dedicated Redis before a destructive setup; validate the target and refuse defaults in unsafe environments. Keep current API integration tests serialized on their separate disposable `lume_test`; never run their setup concurrently, or in parallel with E2E if distinct infrastructure cannot be proven.

- [ ] Add a guard test or dry-run contract check for malformed/unsafe DB names and omitted E2E target; verify occupied defaults fail preflight without stopping an existing service or touching its database. Inspect E2E helper fixtures for hardcoded origins and make the same configuration authoritative there.
- [ ] Provision disposable local infrastructure on free ports without using existing running services and prove API migration and one existing Playwright smoke. Do not accept a failed service boot as product RED. Integrator commit: `test: isolate browser acceptance infrastructure` if config changes are required.

### Task 1: Close room-presence disclosure

**Files:** `apps/api/src/routes/social.ts`, `apps/api/src/routes/extras.ts`, new `apps/api/src/access/presence.ts`; `apps/api/src/test/profile-privacy.test.ts`.

**Interface:** `visiblePublicRoom(seat: PresenceSeat | null): { roomId: string; roomTitle: string } | null`. Route-specific social checks apply before serialization; catalogue can reuse the eligibility policy without exposing presence to pending/blocked users.

- [ ] Write `hides private and disallowed room presence`: `isPublic:false` makes `currentActivity` and both room fields null in profile/user/friends; no pending/blocked presence, even if public; `/stats` omits private room identities. Assert a public accepted-friend control case and unchanged authorized room detail. `/stats/global` retains anonymous aggregates only; it must not serialize ID/title or link any user to a room.
- [ ] Run `pnpm --filter @lume/api test src/test/profile-privacy.test.ts` against isolated DB; expect private room identity in a failing assertion on the old code.
- [ ] Apply the shared fail-closed server policy to both profile projections, friends and the public stats listing; accepted/public presence remains. Add ban/visibility checks before returning the relationship between viewer, friend and room.
- [ ] Rerun the same test; pair with security review. Integrator commit: `fix: protect closed room presence`.

### Task 2: Six-character invites and hard cutover

**Files:** new `packages/contracts/src/room-code.ts` and test; `packages/contracts/src/room.ts`, `index.ts`; `apps/api/src/rooms/{service,prisma-repo}.ts`, `apps/api/src/routes/rooms.ts`, `apps/api/src/http/limit.ts`; `packages/db/prisma/schema.prisma` and new migration/backfill; `apps/bot/src/{links,bot}.ts`; web `App.tsx`, `SessionDock.tsx`, new `design/RoomCodeInput.tsx` and its surface styles (integrator replaces call sites).

**Interfaces:** `parseRoomCode(input: string): string | null`, `formatRoomCode(code: string): string`; canonical `7kq2mx`, display `7KQ-2MX`. Existing `/rooms/join { code }`, web `/join/:code` and Telegram `room_<code>` preserve route shape. `/join/:code` rejection leads to recoverable not-found UX; unrelated `user_<id>` remains unchanged.

- [ ] Contract and bot tests: `expect(parseRoomCode(" 7KQ-2MX ")).toBe("7kq2mx")`; 5/7/8-char inputs, ambiguous symbols and malformed grouping return `null`. API tests reject old invite, validate throttling, verify atomic collision retry, unchanged bans/permissions, and preserve room ID/relationships through migration. Playwright test types and pastes 3–3, asserts exactly six visible cells and verifies live join including after auth.
- [ ] Run `pnpm --filter @lume/contracts test src/room-code.test.ts`, `pnpm --filter @lume/bot test src/links.test.ts`, and `pnpm --filter @lume/api test src/rooms/service.test.ts`; record failing assertions, not setup errors. Verify the added API fixture against isolated Postgres.
- [ ] Implement shared parser and formatting; uniform crypto generator on the server, unique constraint, retry on the actual colliding insert, stricter join limit by IP and account. Preserve stable IDs; use fresh six-character assignments, not a prefix or a legacy alias. Update `apps/web/src/design/shot-fixtures.ts` to valid, non-live six-character examples. Add forward-only cutover runbook and post-migration validation; no production execution. Run `pnpm --filter @lume/contracts build` before downstream tests (their export points to `dist`).
- [ ] Rerun the same unit/API targets, verify the rollback procedure on a disposable snapshot and run targeted Playwright after build. Integrator commit: `feat: migrate room invitations to six characters`.

### Task 3: Appearance shell and icon library

**Files:** `packages/contracts/src/theme.ts`, `apps/web/package.json`, `pnpm-lock.yaml`, `apps/web/src/design/{theme.ts,useAppearance.ts,cinema.css,gruvbox.css}`, new `telerave.css`, `AppearanceControls.tsx`, `StyleFrame.tsx`; `design/contrast.test.ts`, `scripts/check-theme-tokens.mjs`. Integrate via `main.tsx` and common app shell.

**Interfaces:** `StyleId = "cinema" | "gruvbox" | "telerave"`; existing `ThemeMode = "dark" | "light" | "system"`. `StyleFrame` selects chrome for a typed screen but preserves one stable parent for live content; changing a wrapper type remounts children even if props reuse the same `ReactNode`. Lucide imports scoped to controls, with accessible names on the interactive element.

- [ ] Add `keeps mode when style changes` and `reacts to the OS only in system mode`; verify telerave persistence and preview isolation. Add contrast assertions for both palettes of the third style and a visible keyboard focus check.
- [ ] Run `pnpm --filter @lume/web test src/design/contrast.test.ts` and the new preference target; expect missing style/state cases to fail.
- [ ] Install `lucide-react` in web workspace, add third palette, preserve geometry in layout CSS, define Gruvbox frame/status and TeleRave frame from audited source. Replace common shell/accessibility glyphs first; downstream screen owners replace their own controls. Keep existing JetBrains Mono loading and official Gruvbox colors.
- [ ] Rerun unit tests and `pnpm --filter @lume/web lint`; review style/mode switch at both baseline viewports. Integrator commit: `feat: add independent layout and theme controls`.

### Task 4: Categories and stable directory API

**Depends on Task 2 for shared room/schema files. Files:** `packages/contracts/src/room.ts`, new `room-catalog.ts`; `packages/db/prisma/schema.prisma` and new migrations; `apps/api/src/rooms/{service,prisma-repo,memory}.ts`, `apps/api/src/routes/rooms.ts`, new `rooms/category.ts`; inspect media paths in `apps/realtime/src/socket/handlers.ts` and update the authoritative persistence path rather than forking the classifier.

**Interfaces:** `RoomCategory = "film" | "music" | "vlog" | "other"`; `RoomCategorySelection = "auto" | RoomCategory`; `classifyRoomCategory(metadata: CategoryMetadata): RoomCategory`. `GET /rooms/catalog?filter=all|friends|film|music|vlog&cursor=…` returns `{ rooms: RoomCatalogItem[]; nextCursor: string | null }`; item includes stable `id`, effective `category` and existing room summary fields plus nullable media preview. Preserve `/rooms` response shape. Add optional selection on create and host-only update; absent create selection means `auto`.

- [ ] Test explicit `other` beats music metadata, auto follows current video's changes, unknown source metadata falls back to `other`, queue-only adds leave current category unchanged, host-only setting is enforced. Directory test with >30 mixed rows asserts pre-page filtering, cursor order, no duplicate IDs, exhaust/null cursor, invalid cursor handling and private/blocked exclusion.
- [ ] Run new `pnpm --filter @lume/api test src/test/room-catalog.test.ts`; expect unsupported category/catalog, not database setup errors.
- [ ] Add schema/backfill from stored media, shared handlers, stable keyset pagination ordered by `createdAt` and `id`, and friend filtering using accepted relationships plus active membership. Implement memory/Prisma contract parity. Use equivalent mutation behavior for create, replace, advance and resume.
- [ ] Run `pnpm --filter @lume/contracts build`, rerun API and realtime tests and capture DB migration readback. Integrator commit: `feat: add categorized room directory`.

### Task 5: Live data for resume, season and inbox

**Depends on Task 1 for social/extras files and Tasks 2–4 for shared room paths. Files:** `apps/api/src/routes/{social,extras,rooms}.ts`, `apps/api/src/account/notify.ts`, `apps/web/src/api/client.ts`, new `packages/contracts/src/notifications.ts`; tests in `apps/api/src/test/`. Worker delivery code is not replaced.

**Interfaces:** `GET /notifications` keeps `{ unread, notifications }` and adds ISO `createdAt` plus a validated nullable internal navigation target; `POST /notifications/read-all` returns `{ unread }` for the caller. Resume response exposes nullable known `positionMs`, `durationMs` and `posterUrl`; studio heatmap uses dated sessions, no projection of one day across the year.

- [ ] Test saved position is the server-derived nonzero position, missing state stays unknown, live rejoin doesn't seek others and access loss doesn't clone the room. Test multiple dated activity days and no fake history; inbox marks own entries, rejects modifying another account's state and never emits arbitrary external navigation.
- [ ] Run named `src/test/{resume-progress,studio-season,notification-inbox}.test.ts` targets via `pnpm --filter @lume/api test`; expect regression failures before changes.
- [ ] Persist the authoritative snapshot at teardown before playback state is lost; expose only authorized resume data. Query date-bounded history in batches; extend notification serialization/actions using recipient scope. Keep delivery in existing worker.
- [ ] Run `pnpm --filter @lume/contracts build`, then rerun focused API tests on isolated DB. Integrator commit: `feat: expose real resume season and inbox data`.

### Task 6: Home and catalog UI

**Depends on Tasks 2–5 for live inputs; isolated component work may begin once contracts are frozen. Files:** new `apps/web/src/design/{HomeView,CreateRoomWizard,RoomFeed}.tsx`, `home-view.css`; integrator replaces home branches in `DesignApp.tsx` and obsolete `MobileHome`/dialog wiring in `pages.tsx`. Test in `e2e/room-feed.spec.ts` and update the existing carousel scenario.

**Interfaces:** reuse shared code input, duplicate-free directory query `(filter, cursor)`, shared appearance and resume data. HomeView renders distinct Cinema, Gruvbox and TeleRave placements from one model; category chooser emits `RoomCategorySelection`.

- [ ] Red browser test: CTA contains no textbox, wizard permits back/forward and persists selected category; advancing sentinel loads additional stable IDs once; a late all-filter response cannot affect Friends; failure keeps prior rows and exposes manual retry.
- [ ] Build then run `pnpm test:e2e e2e/room-feed.spec.ts` against isolated services; record UI failures on the old flow.
- [ ] Implement live right-rail widgets, resume with truthful states, code card, wizard, friends actions, and vertical infinite scrolling with fallback. Remove the old arrows instead of keeping an invisible parallel carousel. No private room metadata in rendered activity.
- [ ] Rerun focused Playwright, inspect both viewport captures and review. Integrator commit: `feat: redesign home and public room feed`.

### Task 7: Notifications and profile as independent UI passes

**Depends on Tasks 0, 1, 3 and 5 for live RED. Files:** separate `apps/web/src/design/{NotificationInbox,ProfileView}.tsx` and their own CSS; integration into `DesignApp.tsx`/`pages.tsx` belongs to integrator. Separate `e2e/notification-inbox.spec.ts` and `e2e/profile-appearance.spec.ts`.

**Interfaces:** notification panel/page render identical entry semantics and share read cache; profile owns selected tab and reads the same saved appearance controller and studio dataset as Home.

- [ ] Inbox RED: bell opens an accessible popover ≤360 px, multiline long strings wrap, Esc restores focus, «Все» routes to full screen and mark-read updates both counters. Profile RED: four tabs open named panels, historical cells show actual values on keyboard focus, saved style retains color mode after reload, closed-room presence is absent.
- [ ] After build run `pnpm test:e2e e2e/notification-inbox.spec.ts e2e/profile-appearance.spec.ts`; capture explained failures before implementation.
- [ ] Build two separately owned surfaces: inbox panel/list/time/empty/retry; profile layout, named awards/progress, three boxed KPIs, history and appearance. Use semantic tabs, tooltip text and shared data without reintroducing fake counts.
- [ ] Rerun focused suite, inspect screenshots, review each file set separately. Integrator commits: `feat: add notification inbox popover` and `feat: reorganize profile and appearance`.

### Task 8: Live room composition and controls

**Depends on appearance frame and code; preserve existing realtime model. Files:** `apps/web/src/screens/RoomScreen.tsx`, `apps/web/src/design/{RoomStage,SessionDock,RoomSettingsSheet}.tsx`, `apps/web/src/layout/panels/PlayerPanel.tsx`, `apps/web/src/design/room.css`; extract `RoomHeader`, `RoomVoiceCard` and `RoomQueuePreview` locally. Test alongside `e2e/{honest-data,room-settings,voice-session}.spec.ts`.

**Interfaces:** `RoomStage` consumes one existing room provider; `SessionDock` receives `"chat" | "people" | "queue"` and role-gated actions from the same model. Producers report numeric sync/position only when measured and available.

- [ ] RED browser assertions: one header and one add flow, code copies once, no fabricated empty metadata, no raw ICE, no role controls on stage, viewer cannot open host settings, and host can manage people within permitted actions. Empty queue shows empty state; filled queue has two preview items max; mobile keeps chat reachable with one scroll owner. Switching style/mode, resizing or opening the dock keeps the same `player-mount` and adapter; an intentional media URL refresh must still reload the adapter.
- [ ] Run named Playwright files after build against isolated infrastructure; record intended failures, using existing voice stub for CI and separating actual LiveKit verification.
- [ ] Extract controls without creating a second player/socket; move technical settings and moderation controls out of stage, retain keyboard shortcuts, recovery, chat, active speaker, reconnect and queue semantics. Place the same actions in the three specified layouts and respect Telegram safe area.
- [ ] Rerun focused browser cases and review visual screenshots in both viewports and both color modes. Integrator commit: `feat: simplify live room and session dock`.

### Task 9: Acceptance, review and push

**Files:** `e2e/{visual,visual-baseline,a11y}.spec.ts`, `e2e/baseline/`, and release evidence under `docs/releases/`. Use the runner proven in Task 0.

- [ ] Extend matrix to 3 styles × 2 palettes × 2 viewports for four primary screens, with system media emulation, 360/430 smoke, narrow/error/empty states, keyboard and axe. Validate that capture fixtures do not stand in for live persistence. Run cases against the old baseline first where changed fingerprints should differ.
- [ ] Capture reviewed baselines, read screenshots through `read`, fix layout defects and rerun; don't stage temporary captures. Relieve the initial Vite warning using safe bundle boundaries for secondary routes; no warning suppression.
- [ ] Obtain independent `code-reviewer`, `parity-auditor`, and stack-specific review on the integrated diff. Clear high findings, then run `pnpm lint`, `pnpm typecheck`, `pnpm build`, `pnpm test`, `pnpm test:e2e` with isolated services. Report exact exits, failures, warnings and coverage; separately record external Telegram/LiveKit verification if access is absent.
- [ ] Verify scope and status, commit only owned files in cohesive slices with no secrets or generated dist. Push the named branch without force after green gates. No production migration or deployment.
