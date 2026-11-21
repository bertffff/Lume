# UI reference pass — Lume E v3 / G v2

Date: 2026-11-21.

## What changed

- **Home (cinema):** greeting, story ring row, compact live counters, three-up action deck with the amber create tile, poster room cards, and a right rail with friends, level, reminders and the season heatmap. Layout follows the reference at 1440×900 and 390×844.
- **Home (gruvbox):** panes are no longer clipped: labels sit inside the pane, the mosaic fills the viewport in three rows, sessions list has thumbnails and live counters, the feature pane shows the resume title, and billboard and friends panes use the tiled grammar.
- **Search:** a centered tool panel with source tabs (all/YouTube/VK/Rutube/direct), a result grid with poster cards, and a direct-link row.
- **Room:** narrower mobile header (layout presets and sync actions stop wrapping), a compact bottom session rail above the mobile sheet, a single voice fallback banner, and real speed/fullscreen controls that appear on stage hover.
- **Mobile home:** story row, poster room cards and the same action deck ordering as desktop.

## Evidence

- Rendered and inspected at 1440×900 and 390×844 for cinema dark, gruvbox dark and mobile.
- `e2e/visual-baseline.spec.ts` baselines refreshed for home, room, create, join and onboarding across both styles, themes and viewports.
- `pnpm lint`, `pnpm typecheck`, `pnpm build`, `pnpm test`, `pnpm test:e2e` — green (64 passed, 17 skipped).

## Notes

- Posters are deterministic CSS art rather than stock photography, so the UI stays offline-safe and tests never depend on network images.
- No external MCP was configured in this workspace; the pass used the local design-direction/interface skills, Playwright screenshots and axe-core.
