import type { FormEvent, ReactNode } from "react";
import type { ModeId, StyleId } from "./theme.js";
import { heatCells } from "./fixtures.js";

export function SettingsScreen({
  style,
  mode,
  onStyle,
  onMode,
}: {
  style: StyleId;
  mode: ModeId;
  onStyle: (style: StyleId) => void;
  onMode: (mode: ModeId) => void;
}) {
  const system = mode === "system";
  return (
    <div className="settings-wrap">
      <aside>
        <div className="slink on">Оформление</div>
        <div className="slink">Аккаунт</div>
        <div className="slink">Уведомления</div>
        <div className="slink">Приватность</div>
        <div className="slink">Язык</div>
        <div className="slink">Плеер</div>
        <div className="slink">Голос</div>
      </aside>
      <div className="panel">
        <h2>Оформление</h2>
        <p className="lead">Стиль и тема. Основной стиль — Кинозал, Gruvbox подключается отдельно.</p>
        <div className="style-cards">
          <button type="button" className={style === "cinema" ? "style-card on" : "style-card"} onClick={() => onStyle("cinema")}>
            <span className="preview cinema" />
            <b>Кинозал</b>
            <small>Мягкие карточки, янтарь</small>
          </button>
          <button type="button" className={style === "gruvbox" ? "style-card on" : "style-card"} onClick={() => onStyle("gruvbox")}>
            <span className="preview gruv" />
            <b>Gruvbox</b>
            <small>Панели, моноширинный</small>
          </button>
        </div>
        <div className="set-row">
          <div><b>Стиль интерфейса</b><small>Кинозал — основной. Gruvbox — отдельный переключаемый стиль.</small></div>
          <div className="seg" style={{ width: 260 }}>
            <button type="button" className={style === "cinema" ? "on" : ""} onClick={() => onStyle("cinema")}>Кинозал</button>
            <button type="button" className={style === "gruvbox" ? "on" : ""} onClick={() => onStyle("gruvbox")}>Gruvbox</button>
          </div>
        </div>
        <div className="set-row">
          <div><b>Тема</b><small>Тёмная для вечера, светлая для дня.</small></div>
          <div className="seg" style={{ width: 220 }}>
            <button type="button" className={!system && mode === "dark" ? "on" : ""} onClick={() => onMode("dark")}>Тёмная</button>
            <button type="button" className={!system && mode === "light" ? "on" : ""} onClick={() => onMode("light")}>Светлая</button>
          </div>
        </div>
        <div className="set-row">
          <div><b>Как в системе</b><small>Следовать светлой или тёмной теме устройства</small></div>
          <div className="seg" style={{ width: 140 }}>
            <button type="button" className={system ? "" : "on"} onClick={() => onMode("dark")}>Выкл</button>
            <button type="button" className={system ? "on" : ""} onClick={() => onMode("system")}>Вкл</button>
          </div>
        </div>
        <div className="set-row"><div><b>Аккаунт</b><small>Имя, почта, Telegram</small></div></div>
        <div className="set-row"><div><b>Уведомления</b><small>Сеансы друзей, приглашения, напоминания</small></div></div>
        <div className="set-row"><div><b>Приватность</b><small>Кто видит профиль и статус</small></div></div>
        <div className="set-row"><div><b>Язык</b><small>Русский</small></div></div>
        <div className="set-row"><div><b>Плеер</b><small>Качество 1080p, скорость 1×</small></div></div>
        <div className="set-row"><div><b>Голос</b><small>Микрофон по умолчанию</small></div></div>
      </div>
    </div>
  );
}

export function ProfileScreen() {
  return (
    <div className="profile-wrap">
      <aside className="side-p">
        <div className="card" style={{ textAlign: "center" }}>
          <span className="av p-me ring" style={{ width: 80, height: 80, fontSize: 26, margin: "0 auto 10px" }}>АВ</span>
          <b className="nm p-me" style={{ display: "block", font: "600 18px/22px var(--font-display)" }}>Альберт Вопилов</b>
          <div style={{ color: "var(--text-2)", fontSize: 13, marginTop: 4 }}>уровень 7 · 14 друзей</div>
          <p style={{ color: "var(--text-2)", fontSize: 13, marginTop: 10 }}>«Смотрю кино, как будто в одном зале.»</p>
        </div>
        <div className="card">
          <h3>Достижения</h3>
          <div className="ach"><span className="got">🎞</span><span className="got">☾</span><span className="got">☺</span><span>♛</span></div>
          <div className="dim">3 из 10 открыто · 3 слота для значков</div>
        </div>
        <div className="card">
          <h3>Друзья</h3>
          <div className="fr"><span className="av lg p-lisa">ЛМ</span><div><div className="n p-lisa">Лиза</div><div className="s">ведёт кинозал</div></div></div>
          <div className="fr"><span className="av lg p-artem">АТ</span><div><div className="n p-artem">Артём</div><div className="s">в зале</div></div></div>
        </div>
      </aside>
      <main>
        <div className="tabs2"><button type="button" className="tab on">Обзор</button><button type="button" className="tab">История</button><button type="button" className="tab">Друзья</button><button type="button" className="tab">Достижения</button></div>
        <div className="grid3">
          <div className="stat"><small>Сеансов в этом году</small><b>142</b></div>
          <div className="stat"><small>Стрик</small><b>14 дней</b></div>
          <div className="stat"><small>Вечеров вместе</small><b>38</b></div>
        </div>
        <div className="card heat-wrap">
          <div className="heat-top"><h3>Ваш сезон</h3></div>
          <div className="stats"><b>14 дней</b> подряд · 142 сеанса</div>
          <div className="heat-grid">{heatCells.map((name, index) => <i key={index} className={name} />)}</div>
        </div>
        <h3>Недавние комнаты</h3>
        <div className="rooms">
          <div className="rc"><div className="th" style={{ backgroundImage: "url(/dev-seed/desert.jpg)" }} /><div className="bd"><b>Ночной кинозал</b><small>Пустая дорога</small></div></div>
          <div className="rc"><div className="th" style={{ backgroundImage: "url(/dev-seed/concert.jpg)" }} /><div className="bd"><b>Пятничный звук</b><small>Концерт на крыше</small></div></div>
        </div>
      </main>
    </div>
  );
}

export function AuthScreen({ onTelegram, name, onName, onEmail }: {
  onTelegram: () => void;
  name: string;
  onName: (value: string) => void;
  onEmail: (event: FormEvent) => void;
}) {
  return (
    <div className="auth-wrap">
      <div className="brand">
        <div className="logo"><i className="spot" />lume</div>
        <h1>Смотрим вместе, как будто в одном зале</h1>
        <p>Синхронный просмотр с друзьями. Войдите через Telegram — и сразу в комнату.</p>
      </div>
      <form className="auth-card" onSubmit={onEmail}>
        <div className="tabs2"><button type="button" className="tab on">Вход</button><button type="button" className="tab">Регистрация</button></div>
        <button type="button" className="tg-btn" onClick={onTelegram}>Войти через Telegram</button>
        <div className="or">или почта</div>
        <label className="field">Почта<input data-testid="lobby-name" value={name} onChange={(event) => onName(event.target.value)} placeholder="albert@example.com" /></label>
        <label className="field">Пароль<input type="password" defaultValue="password" /></label>
        <button className="btn btn-primary" type="submit" data-testid="lobby-sign-in">Войти</button>
      </form>
    </div>
  );
}

const skus = [
  ["Кольцо «Янтарь»", "Рамка аватара в цвете кинозала", "Бесплатно в сезоне", "Надеть", "btn-primary"],
  ["Цвет имени", "Бирюза вашего профиля в чате", "уже ваше", "Снять", "btn-outline"],
  ["Набор реакций «Зал»", "Три дополнительных быстрых эмодзи", "150 ☆", "Открыть", "btn-outline"],
  ["Заставка комнаты", "Свой постер на паузе", "300 ☆", "Открыть", "btn-outline"],
  ["Значок сезона", "Рядом с именем в комнате", "200 ☆", "Открыть", "btn-outline"],
  ["Голосовой эффект", "Мягкая подсветка, когда говорите", "—", "Скоро", "btn-ghost"],
] as const;

export function PremiumScreen() {
  return (
    <div className="wrap shop-wrap">
      <h1>Витрина Blink</h1>
      <p className="lead">Косметика для профиля и комнаты. Приложение полностью удобно и без неё — это только украшения.</p>
      <div className="shop">
        {skus.map(([title, body, price, action, kind]) => (
          <article key={title} className="sku">
            <div className="prev" />
            <b>{title}</b>
            <span>{body}</span>
            <span className="price">{price}</span>
            <button type="button" className={`btn ${kind}`}>{action}</button>
          </article>
        ))}
      </div>
    </div>
  );
}

export function NotificationsScreen() {
  const items = [
    ["p-lisa", "ЛМ", "Лиза начала сеанс", "«Ночной кинозал» · Пустая дорога", "2 мин назад"],
    ["p-dasha", "ДС", "Напоминание в 22:00", "«Лес, который помнит» в комнате Даши", "сегодня"],
    ["p-sonya", "СН", "Соня приглашает", "Сериальный вторник · вт, 20:30", "вчера"],
    ["p-me", "АВ", "Достижение «Ночной экран»", "Вы посмотрели 10 сеансов после полуночи", "3 дня назад"],
  ];
  return (
    <aside className="npanel">
      <div className="mh"><h2>Уведомления</h2><span className="sp" /><span>все</span></div>
      {items.map(([hue, initials, title, body, ago]) => (
        <div className="nitem" key={title}><span className={`av ${hue}`}>{initials}</span><div><div className="t">{title}</div><div className="s">{body}</div><div className="ago">{ago}</div></div></div>
      ))}
    </aside>
  );
}

export function CreateScreen({ title, onTitle, onSubmit }: { title: string; onTitle: (value: string) => void; onSubmit: (event: FormEvent) => void }) {
  return (
    <div className="overlay"><form className="modal lg" onSubmit={onSubmit}>
      <div className="mh"><h2>Создать комнату</h2><span className="sp" /></div>
      <div className="mb">
        <div className="steps"><span className="on" /><span className="on" /><span /></div>
        <label className="field">Название<input data-testid="lobby-title" value={title} onChange={(event) => onTitle(event.target.value)} /></label>
        <div className="choices">
          <div className="choice"><b>Друзья</b><p>По ссылке, только из списка друзей</p></div>
          <div className="choice on"><b>По коду</b><p>Кто знает код</p></div>
          <div className="choice"><b>Публичная</b><p>Видна в открытых комнатах</p></div>
        </div>
        <div className="choices">
          <div className="choice on"><b>Очередь</b><p>Могут добавлять видео</p></div>
          <div className="choice on"><b>Чат</b><p>Писать и ставить реакции</p></div>
          <div className="choice"><b>Пульт</b><p>Пауза и перемотка</p></div>
        </div>
      </div>
      <div className="mf"><button type="button" className="btn btn-ghost">Назад</button><button className="btn btn-primary" type="submit" data-testid="lobby-create">Создать комнату</button></div>
    </form></div>
  );
}

export function JoinScreen({ code, onCode, onSubmit }: { code: string; onCode: (value: string) => void; onSubmit: (event: FormEvent) => void }) {
  const cells = (code || "7KQ-2M").replace("-", "").padEnd(6, " ").slice(0, 6).split("");
  return (
    <div className="overlay"><form className="modal" onSubmit={onSubmit}>
      <div className="mh"><h2>Войти по коду</h2></div>
      <div className="mb">
        <div className="codein">{cells.slice(0, 3).map((cell, index) => <i key={index}>{cell}</i>)}<span className="dash">–</span>{cells.slice(3).map((cell, index) => <i key={index} className={cell === " " ? "blank" : ""}>{cell.trim() || "·"}</i>)}</div>
        <input className="inbox mono" data-testid="lobby-code" value={code} onChange={(event) => onCode(event.target.value)} aria-label="code" />
      </div>
      <div className="mf"><button className="btn btn-social" type="submit" data-testid="lobby-join">Войти</button></div>
    </form></div>
  );
}

export function OnboardingScreen({ onDone }: { onDone: () => void }) {
  return (
    <div className="overlay"><div className="modal">
      <div className="mh"><h2>Добро пожаловать в lume</h2><span>1 / 3</span></div>
      <div className="mb"><p>Выберите стиль, пригласите друга и включите голос, когда будете готовы.</p></div>
      <div className="mf"><button type="button" className="btn btn-primary" onClick={onDone}>Дальше</button></div>
    </div></div>
  );
}

export function MembersScreen() {
  return (
    <div className="settings-wrap">
      <aside><div className="slink on">В зале</div><div className="slink">Голос</div></aside>
      <div className="panel">
        <h2>Люди</h2>
        <div className="fr"><span className="av lg p-lisa speak">ЛМ</span><div><div className="n p-lisa">Лиза</div><div className="s">говорит</div></div></div>
        <div className="fr"><span className="av lg p-artem">АТ</span><div><div className="n p-artem">Артём</div><div className="s">в голосе</div></div></div>
        <div className="fr"><span className="av lg p-mark">МК</span><div><div className="n p-mark">Марк</div><div className="s">микрофон выключен</div></div></div>
      </div>
    </div>
  );
}

export function RoomSettingsScreen({ onSave }: { onSave: (event: FormEvent) => void }) {
  return (
    <form className="settings-wrap" onSubmit={onSave}>
      <aside><div className="slink on">Модерация</div><div className="slink">Права</div></aside>
      <div className="panel">
        <h2>Настройки комнаты</h2>
        <p className="lead">Права зрителей, медленный режим и чёрный список.</p>
        <div className="set-row"><div><b>Чат</b><small>Зрители могут писать</small></div><div className="seg"><button type="button" className="on">Вкл</button><button type="button">Выкл</button></div></div>
        <div className="set-row"><div><b>Голос</b><small>Зрители могут говорить</small></div><div className="seg"><button type="button" className="on">Вкл</button><button type="button">Выкл</button></div></div>
        <div className="set-row"><div><b>Медленный режим</b><small>Одно сообщение в 10 секунд</small></div></div>
        <button className="btn btn-primary" type="submit">Сохранить</button>
      </div>
    </form>
  );
}

export function QueueScreen() {
  return (
    <div className="settings-wrap">
      <div className="panel">
        <h2>Очередь</h2>
        <div className="qrow"><span className="nr">01</span><span className="th" style={{ backgroundImage: "url(/dev-seed/rain.jpg)" }} /><div><b>Город после дождя</b><small>1:48:02</small></div></div>
        <div className="qrow"><span className="nr">02</span><span className="th" style={{ backgroundImage: "url(/dev-seed/forest.jpg)" }} /><div><b>Лес, который помнит</b><small>52:10</small></div></div>
        <div className="qrow add"><span className="nr">--</span><span className="th">+</span><div><b>Добавить ссылку</b><small>YouTube, VK, Rutube</small></div></div>
      </div>
    </div>
  );
}

export function EmptyScreen({ title, body, action }: { title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="page-body"><div className="empty"><h2>{title}</h2>{body ? <p>{body}</p> : null}{action}</div></div>
  );
}

export function MobileHome() {
  return (
    <div className="pad mobile-home">
      <div className="greet"><h1>Добрый вечер</h1><div className="sub">Трое друзей сейчас смотрят</div></div>
      <div className="stories">
        <div className="st new"><div className="ring">+</div>Своя</div>
        <div className="st p-lisa"><div className="ring"><div className="face" style={{ backgroundImage: "url(/dev-seed/desert.jpg)" }} /></div>Лиза</div>
        <div className="st p-sonya"><div className="ring"><div className="face" style={{ backgroundImage: "url(/dev-seed/concert.jpg)" }} /></div>Соня</div>
        <div className="st p-dasha"><div className="ring"><div className="face" style={{ backgroundImage: "url(/dev-seed/forest.jpg)" }} /></div>Даша</div>
        <div className="st p-nick"><div className="ring"><div className="face" style={{ backgroundImage: "url(/dev-seed/rain.jpg)" }} /></div>Ник</div>
      </div>
      <div className="acts">
        <div className="tile resume"><div className="c"><div className="eyebrow">Продолжить</div><h2>Пустая дорога</h2><div className="sub">Ночной кинозал · 01:12:44</div><div className="pb"><i /></div></div></div>
        <div className="tile create"><div className="ic">+</div><h3>Создать комнату</h3><p>Ссылка, друзья — и смотрим</p></div>
        <div className="tile join"><div className="ic">#</div><h3>Войти по коду</h3>
          <div className="codein"><i>7</i><i>K</i><i>Q</i><span className="dash">–</span><i className="blank">2</i><i className="blank">M</i></div>
          <button type="button" className="go">Войти</button>
        </div>
      </div>
      <div className="sec"><h3>Открытые комнаты</h3></div>
      <div className="rooms">
        <div className="rc"><div className="th" style={{ backgroundImage: "url(/dev-seed/concert.jpg)" }} /><div><b>Пятничный звук</b><small>38 смотрят · Соня</small></div></div>
        <div className="rc"><div className="th" style={{ backgroundImage: "url(/dev-seed/rain.jpg)" }} /><div><b>Нуар по средам</b><small>12 смотрят · Ник</small></div></div>
      </div>
    </div>
  );
}
