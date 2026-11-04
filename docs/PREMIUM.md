# Premium

Бесплатный TeleRave уже можно использовать по прямому назначению. Покупка не открывает комнату, чат или обычный голос. Она меняет то, как человек выглядит в зале.

Это ближе к косметике Blink, чем к подписке «без оплаты нельзя смотреть».

## Что продаётся

| Вид | Пример sku | Эффект |
| --- | --- | --- |
| `theme` | `theme.aurora` | палитра и радиусы |
| `flair` | `flair.spark` | значок рядом с именем |
| `decoration` | `decoration.frame.gold` | рамка панели или аватара |
| `nameplate` | `nameplate.neon` | табличка |

Тема «Уголь» (`ember`) бесплатная. «Аврора» (`aurora`) помечена `premium: true`. В оболочке её можно переключить как образец: аккаунта ещё нет, лента только показывает метку. Гейт, которым API будет закрывать тему, уже в `@lume/contracts`: `themeAccess`.

Право в базе — `Entitlement`: `sku`, `kind`, `source` (`grant`, `promo`, `admin`, `stars`, `web`), `active`, `expiresAt`. Платежей нет. Когда они появятся, первым будет Telegram Stars, следом веб-касса. Оба источника уже есть в enum, записей от кассы код не создаёт.

Пока нет тяжёлых прав, у бесплатной комнаты мягкие границы, они же в `@lume/contracts`:

- не больше **25** активных участников (`FREE_ROOM_MEMBER_CAP`); лишнему вход отвечает `room_full`;
- через **4 часа** после создания зала интерфейс показывает напоминание (`SESSION_SOFT_WARN_MS`). Сеанс не обрывается и никого не удаляет.

## Что не продаётся этим срезом

`capabilityAllowed` пускает всё, кроме явного списка:

- `ai.moderation`
- `history.extended`
- `voice.priority`

Без активной записи `kind=capability` и sku из списка функция возвращает `false`. Записи такой никто не выдаёт. Модель нужна, чтобы случайно не отдать тяжёлую функцию «всем бесплатно» в момент, когда она появится.

Просроченное право не считается активным. `expiresAt = null` значит без срока.

## English

Free TeleRave is the whole session. Payment, later, is Telegram Stars first and web checkout second. The entitlement enum already has `stars` and `web`, and nothing writes them yet. A free room holds 25 members. After four hours the UI warns and keeps going. Aurora is the sample premium theme. Heavy capabilities stay denied.
