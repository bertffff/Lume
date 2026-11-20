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

Темы не зашиты в раскладку. `apps/web/src/design/theme.ts` пишет `data-style` (`cinema` / `gruvbox`), `data-theme` (`dark` / `light`) и `data-mode` (`dark` / `light` / `system`), а `cinema.css` / `gruvbox.css` объявляют только CSS-переменные и базовые стили темы. Геометрия и адаптивные контейнеры живут в `layout.css` / `room.css`: фиксированных `1440×900`, `520px` и `420px` больше нет, используются `100%`, `min(…, 100vw)` и `100dvh`. Шрифты подключаются через `@fontsource/*`, внешних Google Fonts `@import` нет.

> **Статус:** описанные ниже `resolveFlow`, `playerRatio` и ручки пока не подключены к живому `RoomStage`. Это целевой контракт следующего UI-среза; фактический экран сейчас использует адаптивные CSS-брейкпоинты и пресеты высоты.


## English

The room is a versioned layout document: player ratio, three side weights, collapsed flags, and the video aspect. Wide landscape video keeps panels on the side. Portrait video moves them underneath. Narrow viewports stack and scroll. Resize handles edit the document. Themes are CSS variables driven by `data-style` / `data-theme`; fonts are bundled through `@fontsource`.
