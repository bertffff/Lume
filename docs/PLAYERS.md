# Плееры

Экран зала монтирует `PlayerAdapter`. Интерфейс в `@lume/contracts`: `play`, `pause`, `seek`, `getCurrentTime`, `getDuration`, `getBuffered`, `onState`, `destroy`. Время в миллисекундах. Если адаптер знает пропорцию кадра, панель передаёт её в раскладку и панели перекладываются.

Хост жмёт пульт: команда уходит в адаптер и в Redis вместе с текущей позицией медиа. Зритель сверяет свои часы с якорем. Если расхождение больше `SYNC_DRIFT_MS` (1,5 с), зритель делает `seek`. Пока адаптер буферизуется, он шлёт `playback:viewer`, и хост видит имя.

Загрузчики вроде yt-dlp не используются. Очередь worker `media.resolve` отвечает `no_extractor`, пока `FF_EXTRACTORS` не равен `true` или `1`. Даже тогда реестр пуст.

## Площадки

| Площадка | Адаптер | Пуск / пауза / seek | Буфер | Пропорция | Ограничение |
| --- | --- | --- | --- | --- | --- |
| YouTube | IFrame API | да | доля загрузки | нет, остаётся выбранная в раскладке | нужен жест зрителя, если браузер блокирует автозапуск |
| Vimeo | `@vimeo/player` | да | события буфера | нет | то же про автозапуск |
| Twitch | официальный embed | да, у VOD есть seek | нет данных | нет | `parent` = хост страницы. Канал в эфире seek не имеет |
| VK | iframe `video_ext` | локальные часы, команда в iframe не гарантирована | нет | нет | площадка может игнорировать пульт. На панели есть пометка |
| Rutube | iframe `play/embed` | как VK | нет | нет | стабильного API управления нет |
| Прямой файл | `<video>` | да | `buffered` | да, из `videoWidth` | CORS и кодек на стороне файла |
| HLS `.m3u8` | hls.js, на Safari — нативный `src` | да | `buffered` | да | поток должен отдавать CORS |

Заголовок и картинка очереди берутся из oEmbed (YouTube, Vimeo, Rutube), если ответ пришёл за секунду. Иначе подпись — hostname ссылки.

## English

Adapters cover YouTube, Vimeo, Twitch, a best-effort VK/Rutube frame, and HTML5 video including HLS. The Redis playback anchor stays authoritative. Viewers seek when drift exceeds 1.5 seconds. `FF_EXTRACTORS` does not enable yt-dlp; the worker registry is still empty.
