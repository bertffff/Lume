# Раскладка зала

`RoomLayout` версии 1 — документ, который позже ляжет в JSON колонки `Room.layout`.

```ts
{
  version: 1,
  preset: "theater" | "stack" | "custom",
  playerRatio: 0.35..0.8,
  sideWeights: { chat, voice, queue },
  collapsed: { chat, voice, queue },
  videoAspect: number // ширина / высота
}
```

`preset` запоминает намерение человека. `theater` — стартовый зал. `custom` ставится, когда двигают ручки или сворачивают панель. Смена пропорции кадра preset не трогает.

## Как выбирается поток

Функция `resolveFlow` в `apps/web`:

| Условие | Поток |
| --- | --- |
| ширина колонки < 860 | `stack` — экран, потом чат, голос, очередь, страница скроллится |
| `videoAspect < 1` и экран широкий | `below` — экран сверху, три панели в ряд |
| иначе | `side` — экран слева, панели столбиком справа |

Порог 860 и граница «портрет / альбом» — часть контракта поведения оболочки. Их меняют вместе с тестом `layout.test.ts`.

Ручки есть в `side` и `below`. В `stack` их нет: ширины не хватает, чтобы делить её осмысленно. Клавиатура на ручке: стрелки сдвигают долю, Shift — крупнее.

Доля плеера считается от прямоугольника зала в момент нажатия, а не от предыдущего шага, чтобы жест не накапливал ошибку. Между двумя боковыми панелями доля берётся от их суммы на момент нажатия, третья панель не двигается. Свёрнутая панель становится рейкой 48px и выпадает из дележки.

## Кадр

Внутри ячейки плеера сцена вписывается функцией `containSize`: при том же `videoAspect` картинка не обрезается и не вылезает из рамки. Смена 16:9 → 9:16 одновременно меняет сцену и, на широком окне, перекладывает панели сверху вниз.

Темы не зашиты в раскладку. `apps/web/src/design/theme.ts` пишет `data-style` (`cinema` / `gruvbox`), `data-theme` (`dark` / `light`) и `data-mode` (`dark` / `light` / `system`). `cinema.css` / `gruvbox.css` содержат только токены и цветовые правила; вся геометрия, контролы и адаптивные контейнеры живут в `surfaces.css`, `layout.css` и `room.css`. `pnpm lint` в `@lume/web` запускает `scripts/check-theme-tokens.mjs` и падает, если в теме появится `padding`, `width`, `display`, `gap` и подобное. Контраст текста и иконок проверяет `design/contrast.test.ts` (WCAG AA, 4.5:1) для cinema/gruvbox × dark/light. Шрифты подключаются через `@fontsource/*`, внешних Google Fonts `@import` нет.

> **Статус:** `resolveFlow`, `playerRatio` и ручки подключены к живому `RoomStage`. Поток считается по измеренной ширине `.body` через `ResizeObserver`, а не по `window.innerWidth`: `< 860` — `stack`, портретный кадр на широком экране — `below`, иначе `side`. Ручка двигает долю плеера в диапазоне `0.35–0.8`, работает мышью, касанием и стрелками (Shift — крупнее), сохраняется в `RoomLayout` и localStorage. Дублирующего брейкпоинта `800px` в JS больше нет.


## English

The room is a versioned layout document: player ratio, three side weights, collapsed flags, and the video aspect. `RoomStage` measures its own container with `ResizeObserver` and calls `resolveFlow`: below 860 it stacks, portrait aspect on a wide screen moves panels underneath, otherwise panels sit on the side. The resize handle works with pointer and arrow keys and clamps the player ratio to 0.35–0.8. Theme files hold tokens and colours only; geometry lives in `surfaces.css`, `layout.css` and `room.css`, and a lint guard rejects geometry in theme files. Contrast is asserted at 4.5:1 for both styles and themes. Fonts are bundled through `@fontsource`.

## Visual baselines and E2E isolation

`e2e/visual-baseline.spec.ts` compares `home`, `room`, `create`, `join` and `onboarding` across cinema/gruvbox, dark/light and desktop/mobile against committed PNGs in `e2e/baseline/` (2% pixel tolerance). Regenerate deliberately with `UPDATE_BASELINES=1 pnpm test:e2e`. `?shot=` is a deterministic design-preview mode: rooms and global stats there are fixed fixtures, so screenshots never depend on data created by other specs. Without `?shot=` the app keeps using live data.

`e2e/helpers/identity.ts` gives every test its own display name, so parallel specs no longer share a dev user. Specs that touch global aggregates or the friend graph run with `test.describe.configure({ mode: "serial" })`. `pretest:e2e` runs `e2e/check-build.mjs` and fails when `src` is newer than the built bundle, preventing screenshots against a stale build.

## Primitives, shell and accessibility

`apps/web/src/ui/` is the one control layer: Button, Input/Textarea/Select, Toggle, Badge, Card, Modal/Sheet, ConfirmDialog, Toasts, Skeleton, EmptyState and ErrorState. The modal traps Tab, closes on Esc/backdrop, restores focus and locks body scroll; primitives are covered by jsdom tests through Testing Library. `AppShell` frames both the admin screen and the design app and provides a skip link.

`i18n/hardcoded.test.ts` fails the suite if a Cyrillic string literal appears outside the dictionaries (plus the `copy.ts` design vocabulary and deterministic `shot-fixtures.ts`). `t(key, params)` interpolates `{name}` values for counts, durations and session labels. Error codes are mapped to message keys instead of branching on Russian sentences.

Telegram: `themeParamsToCssVars` writes both the design tokens (`--bg`, `--s1`, `--text`, `--accent`, `--accent-ink`) and the legacy `--lume-*` names; `App` applies them on start and on `themeChanged`. Sub-screens bind `BackButton` back to home, and the Mini App uses `100dvh`, `env(safe-area-inset-*)` and one scroll container.

`e2e/a11y.spec.ts` runs axe-core (WCAG 2 A/AA) on home, create, join and auth and fails on serious/critical findings. The Telegram button was darkened to `#0E6E9C` to clear 4.5:1 with white text.
