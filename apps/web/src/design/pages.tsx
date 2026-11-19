import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { favouriteLine, linkedLabel, roomPresetById, roomPresets, viewerPermissionKeys, type RoomPresetId } from "@lume/contracts";
import type { ModeId, StyleId } from "./theme.js";
import { heatCells } from "./fixtures.js";

export function SettingsScreen({
  style,
  mode,
  onStyle,
  onMode,
  token,
  apiUrl,
  blocked = [],
  onUnblock,
  globalBans = [],
  onRemoveGlobalBan,
}: {
  style: StyleId;
  mode: ModeId;
  onStyle: (style: StyleId) => void;
  onMode: (mode: ModeId) => void;
  token?: string;
  apiUrl?: string;
  blocked?: Array<{ id: string; displayName: string }>;
  onUnblock?: (id: string) => void;
  globalBans?: Array<{ id: string; userId: string; displayName: string; reason: string | null }>;
  onRemoveGlobalBan?: (userId: string) => void;
}) {
  const [telegramId, setTelegramId] = useState("");
  const [linked, setLinked] = useState("…");
  const [services, setServices] = useState<string[]>([]);
  const [friendsPublic, setFriendsPublic] = useState(true);
  const [historyPublic, setHistoryPublic] = useState(true);
  useEffect(() => {
    if (!apiUrl) return;
    void fetch(`${apiUrl}/video/services`).then((response) => response.json()).then((payload: { services?: string[] }) => setServices(payload.services ?? [])).catch(() => setServices([]));
    if (!token) return;
    void fetch(`${apiUrl}/auth/linked-accounts`, { headers: { authorization: `Bearer ${token}` } })
      .then((response) => response.json())
      .then((payload: { email?: boolean; telegram?: boolean }) => {
        setLinked(linkedLabel({ email: Boolean(payload.email), telegram: Boolean(payload.telegram) }));
      })
      .catch(() => setLinked("нет"));
    void fetch(`${apiUrl}/me`, { headers: { authorization: `Bearer ${token}` } })
      .then((response) => response.json())
      .then((payload: { isFriendsPublic?: boolean; isWatchHistoryPublic?: boolean }) => {
        if (typeof payload.isFriendsPublic === "boolean") setFriendsPublic(payload.isFriendsPublic);
        if (typeof payload.isWatchHistoryPublic === "boolean") setHistoryPublic(payload.isWatchHistoryPublic);
      })
      .catch(() => undefined);
  }, [token, apiUrl]);
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
        <div className="set-row">
          <div><b>Telegram</b><small>{linked}. Отвязка только если есть почта.</small></div>
          <input value={telegramId} onChange={(event) => setTelegramId(event.target.value)} placeholder="id" aria-label="telegram id" />
          <button type="button" onClick={() => { if (!token || !apiUrl) return; void fetch(`${apiUrl}/auth/link-telegram`, { method: "POST", headers: { authorization: `Bearer ${token}`, "content-type": "application/json" }, body: JSON.stringify({ telegramId }) }); }}>Привязать</button>
          <button type="button" onClick={() => { if (!token || !apiUrl) return; void fetch(`${apiUrl}/auth/unlink-telegram`, { method: "POST", headers: { authorization: `Bearer ${token}` } }); }}>Отвязать</button>
        </div>
        <div className="set-row"><div><b>Уведомления</b><small>Сеансы друзей, приглашения, напоминания</small></div></div>
        <div className="set-row">
          <div><b>Приватность</b><small>Друзья и история видны другим, пока вы не скроете их.</small></div>
          <label className="tr-check">
            <input
              data-testid="privacy-friends"
              type="checkbox"
              checked={friendsPublic}
              onChange={(event) => {
                const next = event.target.checked;
                setFriendsPublic(next);
                if (!token || !apiUrl) return;
                void fetch(`${apiUrl}/me`, { method: "PATCH", headers: { authorization: `Bearer ${token}`, "content-type": "application/json" }, body: JSON.stringify({ isFriendsPublic: next }) });
              }}
            />
            Друзья видны
          </label>
          <label className="tr-check">
            <input
              data-testid="privacy-history"
              type="checkbox"
              checked={historyPublic}
              onChange={(event) => {
                const next = event.target.checked;
                setHistoryPublic(next);
                if (!token || !apiUrl) return;
                void fetch(`${apiUrl}/me`, { method: "PATCH", headers: { authorization: `Bearer ${token}`, "content-type": "application/json" }, body: JSON.stringify({ isWatchHistoryPublic: next }) });
              }}
            />
            История видна
          </label>
        </div>
        <div className="set-row">
          <div><b>Заблокированные друзья</b><small>Личная блокировка друга. На вход в комнаты не влияет.</small>{blocked.map((row) => <small key={row.id}>{row.displayName} <button type="button" onClick={() => onUnblock?.(row.id)}>убрать</button></small>)}{blocked.length === 0 ? <small>Пусто</small> : null}</div>
        </div>
        <div className="set-row" data-testid="global-blacklist">
          <div>
            <b>Глобальный чёрный список</b>
            <small>Баны, которые закрывают вход во все комнаты, где вы владелец.</small>
            {globalBans.length === 0 ? <small data-testid="global-blacklist-empty">Пусто</small> : null}
            {globalBans.map((row) => (
              <small key={row.id} data-testid="global-ban-row" data-user-id={row.userId}>
                {row.displayName}{row.reason ? ` · ${row.reason}` : ""}{" "}
                <button type="button" data-testid="global-ban-remove" onClick={() => onRemoveGlobalBan?.(row.userId)}>убрать</button>
              </small>
            ))}
          </div>
        </div>
        <div className="set-row"><div><b>Язык</b><small>Русский</small></div></div>
        <div className="set-row"><div><b>Сервисы извлечения</b><small>{services.length === 0 ? "Cobalt не задан" : services.join(", ")}</small></div></div>
        <div className="set-row"><div><b>HLS</b><small>Манифест переписывается, когда извлечения включены.</small></div></div>
        <div className="set-row"><div><b>Реакции</b><button type="button" onClick={() => { if (!token || !apiUrl) return; void fetch(`${apiUrl}/me`, { method: "PATCH", headers: { authorization: `Bearer ${token}`, "content-type": "application/json" }, body: JSON.stringify({ hideOtherReactions: true }) }); }}>Скрыть чужие</button></div></div>
        <div className="set-row"><div><b>Telegram</b><small>{linked.includes("Telegram") ? "Уведомления бота включены" : "Бот молчит, пока Telegram не привязан"}</small></div></div>
        <div className="set-row"><div><b>Плеер</b><small>Качество 1080p, скорость 1×</small></div></div>
        <div className="set-row">
          <div><b>Удаление аккаунта</b><small>30 дней на восстановление. Подтверждение — DELETE.</small></div>
          <button type="button" onClick={() => { if (!token || !apiUrl) return; void fetch(`${apiUrl}/me/delete`, { method: "POST", headers: { authorization: `Bearer ${token}`, "content-type": "application/json" }, body: JSON.stringify({ confirmation: "DELETE" }) }); }}>Удалить</button>
          <button type="button" onClick={() => { if (!token || !apiUrl) return; void fetch(`${apiUrl}/me/restore`, { method: "POST", headers: { authorization: `Bearer ${token}` } }); }}>Восстановить</button>
        </div>
      </div>
    </div>
  );
}

export function ProfileScreen({ token, apiUrl, userId, displayName }: { token?: string; apiUrl?: string; userId?: string; displayName?: string } = {}) {
  const [favourites, setFavourites] = useState<Array<{ url: string; title: string | null; watchCount: number }>>([]);
  const [history, setHistory] = useState<Array<{ url: string; title: string | null; watchCount: number; lastWatchedAt: string }>>([]);
  const [achievements, setAchievements] = useState<Array<{ key: string; title: string; icon: string; earned: boolean }>>([]);
  const [level, setLevel] = useState(1);
  const [totalXp, setTotalXp] = useState(0);
  const [nextLevelXp, setNextLevelXp] = useState(0);
  const [totalAchievements, setTotalAchievements] = useState(0);
  const [engagement, setEngagement] = useState<{
    watchSeconds: number;
    voiceSeconds: number;
    messages: number;
    reactions: number;
    totalSeconds: number;
    activity: number;
  } | null>(null);
  const [platforms, setPlatforms] = useState<Array<{ source: string; count: number }>>([]);
  const [friendsWatch, setFriendsWatch] = useState<Array<{ partnerId: string; seconds: number }>>([]);
  const [boards, setBoards] = useState<{ messages: LeaderboardRow[]; reactions: LeaderboardRow[]; voice: LeaderboardRow[] }>({ messages: [], reactions: [], voice: [] });
  useEffect(() => {
    if (!token || !apiUrl) return;
    void fetch(`${apiUrl}/stats/leaderboard`, { headers: { authorization: `Bearer ${token}` } })
      .then((response) => response.json())
      .then((payload: { messages?: LeaderboardRow[]; reactions?: LeaderboardRow[]; voice?: LeaderboardRow[] }) => setBoards({
        messages: payload.messages ?? [],
        reactions: payload.reactions ?? [],
        voice: payload.voice ?? [],
      }))
      .catch(() => setBoards({ messages: [], reactions: [], voice: [] }));
    void fetch(`${apiUrl}/me/studio`, { headers: { authorization: `Bearer ${token}` } })
      .then((response) => response.json())
      .then((payload: { platforms?: Array<{ source: string; count: number }>; topFriends?: Array<{ partnerId: string; seconds: number }> }) => {
        setPlatforms(payload.platforms ?? []);
        setFriendsWatch(payload.topFriends ?? []);
      })
      .catch(() => undefined);
    void fetch(`${apiUrl}/me/favourites`, { headers: { authorization: `Bearer ${token}` } })
      .then((response) => response.json())
      .then((payload: { items?: Array<{ url: string; title: string | null; watchCount: number }> }) => setFavourites(payload.items ?? []))
      .catch(() => setFavourites([]));
    void fetch(`${apiUrl}/me/achievements`, { headers: { authorization: `Bearer ${token}` } })
      .then((response) => response.json())
      .then((payload: {
        all?: Array<{ key: string; title: string; icon: string; earned: boolean }>;
        level?: number;
        totalXp?: number;
        nextLevelXp?: number;
        total?: number;
      }) => {
        if (Array.isArray(payload.all)) setAchievements(payload.all);
        if (typeof payload.level === "number") setLevel(payload.level);
        if (typeof payload.totalXp === "number") setTotalXp(payload.totalXp);
        if (typeof payload.nextLevelXp === "number") setNextLevelXp(payload.nextLevelXp);
        if (typeof payload.total === "number") setTotalAchievements(payload.total);
      })
      .catch(() => undefined);
    if (!userId) return;
    void fetch(`${apiUrl}/users/${userId}/watch-history`, { headers: { authorization: `Bearer ${token}` } })
      .then((response) => response.json())
      .then((payload: { items?: Array<{ url: string; title: string | null; watchCount: number; lastWatchedAt: string }> }) => setHistory(payload.items ?? []))
      .catch(() => setHistory([]));
    void fetch(`${apiUrl}/users/${userId}/engagement`, { headers: { authorization: `Bearer ${token}` } })
      .then((response) => (response.ok ? response.json() : null))
      .then((payload: typeof engagement) => setEngagement(payload))
      .catch(() => setEngagement(null));
  }, [token, apiUrl, userId]);
  const earnedCount = achievements.filter((item) => item.earned).length;
  return (
    <div className="profile-wrap">
      <aside className="side-p">
        <div className="card" style={{ textAlign: "center" }}>
          <span className="av p-me ring" style={{ width: 80, height: 80, fontSize: 26, margin: "0 auto 10px" }}>{(displayName ?? "Вы").slice(0, 2).toUpperCase()}</span>
          <b className="nm p-me" style={{ display: "block", font: "600 18px/22px var(--font-display)" }}>{displayName ?? "Вы"}</b>
          <div style={{ color: "var(--text-2)", fontSize: 13, marginTop: 4 }}>
            <span data-testid="profile-level">Уровень {level}</span> · <span data-testid="profile-xp">{totalXp} XP</span>
          </div>
          <p style={{ color: "var(--text-2)", fontSize: 13, marginTop: 6 }} data-testid="profile-next-level">до следующего уровня {Math.max(0, nextLevelXp - totalXp)} XP</p>
        </div>
        <div className="card">
          <h3>Достижения</h3>
          <div className="ach" data-testid="profile-achievements">
            {achievements.map((item) => (
              <span key={item.key} className={item.earned ? "got" : ""} title={item.title} data-testid="profile-achievement" data-key={item.key} data-earned={String(item.earned)}>
                {item.icon}
              </span>
            ))}
          </div>
          <div className="dim" data-testid="profile-achievements-count">{earnedCount} из {totalAchievements} открыто · 3 слота для значков</div>
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
        <div className="card" data-testid="profile-engagement">
          <div className="heat-top"><h3>Вовлечённость</h3></div>
          <div className="grid3">
            <div className="stat">
              <small>Секунды просмотра</small>
              <b data-testid="engagement-watch" data-seconds={engagement?.watchSeconds ?? 0}>{formatSeconds(engagement?.watchSeconds ?? 0)}</b>
            </div>
            <div className="stat">
              <small>Секунды голоса</small>
              <b data-testid="engagement-voice" data-seconds={engagement?.voiceSeconds ?? 0}>{formatSeconds(engagement?.voiceSeconds ?? 0)}</b>
            </div>
            <div className="stat">
              <small>Сообщения</small>
              <b data-testid="engagement-messages" data-count={engagement?.messages ?? 0}>{engagement?.messages ?? 0}</b>
            </div>
            <div className="stat">
              <small>Реакции</small>
              <b data-testid="engagement-reactions" data-count={engagement?.reactions ?? 0}>{engagement?.reactions ?? 0}</b>
            </div>
          </div>
          <div className="stats" data-testid="engagement-total" data-seconds={engagement?.totalSeconds ?? 0}>
            Всего {formatSeconds(engagement?.totalSeconds ?? 0)} · {engagement?.activity ?? 0} действий
          </div>
        </div>
        <div className="card heat-wrap">
          <div className="heat-top"><h3>Ваш сезон</h3></div>
          <div className="stats"><b>14 дней</b> подряд · 142 сеанса</div>
          <div className="heat-grid">{heatCells.map((name, index) => <i key={index} className={name} />)}</div>
        </div>
        <h3>Таблица</h3>
        <div data-testid="profile-leaderboards">
          {(["messages", "reactions", "voice"] as const).map((board) => (
            <div key={board} data-testid={`profile-leaderboard-${board}`}>
              <b>{board === "messages" ? "Сообщения" : board === "reactions" ? "Реакции" : "Голос"}</b>
              {boards[board].length === 0 ? <p>Пока пусто</p> : boards[board].map((row) => (
                <p key={row.userId} data-testid={`profile-leaderboard-${board}-row`} data-user-id={row.userId} data-value={row.value}>{row.displayName} · {row.value}</p>
              ))}
            </div>
          ))}
        </div>
        <h3>История просмотров</h3>
        <ul data-testid="profile-history">
          {history.length === 0 ? <li>Пока пусто</li> : history.map((item) => (
            <li key={item.url} data-testid="profile-history-item" data-url={item.url} data-watch-count={item.watchCount}>
              {item.title || item.url} · {item.watchCount} · {new Date(item.lastWatchedAt).toLocaleDateString("ru-RU")}
            </li>
          ))}
        </ul>
        <h3>Платформы</h3>
        {platforms.length === 0 ? <p>Пока пусто</p> : platforms.map((item) => <p key={item.source}>{item.source} · {item.count}</p>)}
        <h3>Сеансы с друзьями</h3>
        {friendsWatch.length === 0 ? <p>Пока пусто</p> : friendsWatch.map((item) => <p key={item.partnerId}>{item.partnerId} · {item.seconds} с</p>)}
        <h3>Избранное</h3>
        <div data-testid="profile-favourites">
          {favourites.length === 0 ? <p>Пока пусто</p> : favourites.map((item) => (
            <p key={item.url} data-testid="profile-favourite" data-url={item.url} data-watch-count={item.watchCount}>
              {favouriteLine(item.title, item.watchCount)}
            </p>
          ))}
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

interface LeaderboardRow {
  userId: string;
  displayName: string;
  value: number;
}

function formatSeconds(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(safe / 60);
  const rest = safe % 60;
  return minutes > 0 ? `${minutes} мин ${rest} с` : `${rest} с`;
}

export function AuthScreen({ onTelegram, name, onName, onEmail, onRegister }: {
  onTelegram: () => void;
  name: string;
  onName: (value: string) => void;
  onEmail: (event: FormEvent) => void;
  onRegister: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const [tab, setTab] = useState<"login" | "register">("login");
  const [password, setPassword] = useState("");
  return (
    <div className="auth-wrap">
      <div className="brand">
        <div className="logo"><i className="spot" />lume</div>
        <h1>Смотрим вместе, как будто в одном зале</h1>
        <p>Синхронный просмотр с друзьями. Войдите через Telegram — и сразу в комнату.</p>
      </div>
      <form className="auth-card" onSubmit={tab === "register" ? onRegister : onEmail}>
        <div className="tabs2">
          <button type="button" className={tab === "login" ? "tab on" : "tab"} onClick={() => setTab("login")}>Вход</button>
          <button type="button" className={tab === "register" ? "tab on" : "tab"} onClick={() => setTab("register")}>Регистрация</button>
        </div>
        <button type="button" className="tg-btn" onClick={onTelegram}>Войти через Telegram</button>
        <div className="or">или почта</div>
        <label className="field">Почта<input data-testid="lobby-name" value={name} onChange={(event) => onName(event.target.value)} placeholder="albert@example.com" /></label>
        <label className="field">Пароль<input name="password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} /></label>
        {tab === "register" ? <label className="field">Имя<input name="displayName" defaultValue={name.split("@")[0] || "Гость"} /></label> : null}
        <button className="btn btn-primary" type="submit" data-testid="lobby-sign-in">{tab === "register" ? "Создать аккаунт" : "Войти"}</button>
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

export function CreateScreen({ title, onTitle, preset, onPreset, onSubmit }: {
  title: string;
  onTitle: (value: string) => void;
  preset: RoomPresetId | null;
  onPreset: (value: RoomPresetId) => void;
  onSubmit: (event: FormEvent) => void;
}) {
  const chosen = preset ? roomPresetById(preset) : null;
  return (
    <div className="overlay docked"><form className="modal lg" onSubmit={onSubmit}>
      <div className="mh"><h2>Создать комнату</h2><span className="sp" /></div>
      <div className="mb">
        <div className="steps"><span className="on" /><span className="on" /><span /></div>
        <label className="field">Название<input data-testid="lobby-title" value={title || "Ночной кинозал"} onChange={(event) => onTitle(event.target.value)} /></label>
        <label className="choice-label">Пресет модерации</label>
        <div className="chips" data-testid="create-presets">
          {roomPresets.map((item) => (
            <button
              key={item.id}
              type="button"
              className={preset === item.id ? "pill on" : "pill"}
              data-testid={`create-preset-${item.id}`}
              onClick={() => {
                onPreset(item.id);
                onTitle(item.title);
              }}
            >
              {item.title}
            </button>
          ))}
        </div>
        <label className="choice-label">Кто может войти</label>
        <div className="choices">
          <div className={chosen && !chosen.isPublic ? "choice on" : "choice"}><b>По коду</b><p>Кто знает код комнаты</p></div>
          <div className={chosen?.isPublic ? "choice on" : "choice"}><b>Публичная</b><p>Видна в открытых комнатах</p></div>
        </div>
        {chosen ? (
          <p className="lead" data-testid="create-preset-summary" data-max={chosen.maxMembers} data-public={chosen.isPublic ? "true" : "false"} data-slow={chosen.slowModeSeconds}>
            {chosen.hint} Лимит {chosen.maxMembers}.
          </p>
        ) : null}
        <label className="choice-label">Права зрителей по умолчанию</label>
        <div className="choices" data-testid="create-preset-rights">
          {viewerPermissionKeys.map((key) => (
            <div key={key} className={chosen?.defaults[key] ? "choice on" : "choice"}>
              <b>{key}</b>
              <p>{chosen ? (chosen.defaults[key] ? "Разрешено" : "Запрещено") : "Из пресета"}</p>
            </div>
          ))}
        </div>
      </div>
      <div className="mf"><button type="button" className="btn btn-ghost">Назад</button><button className="btn btn-primary" type="submit" data-testid="lobby-create">Создать комнату</button></div>
    </form></div>
  );
}

export function JoinScreen({ code, onCode, onSubmit }: { code: string; onCode: (value: string) => void; onSubmit: (event: FormEvent) => void }) {
  return (
    <div className="overlay docked"><form className="modal" onSubmit={onSubmit}>
      <div className="mh"><h2>Войти по коду</h2></div>
      <div className="mb">
        <p>Введите код комнаты — шесть знаков, как в приглашении.</p>
        <div className="codein"><i>7</i><i>K</i><i>Q</i><span className="dash">–</span><i>2</i><i className="blank">_</i></div>
        <input className="inbox mono" data-testid="lobby-code" value={code} onChange={(event) => onCode(event.target.value)} aria-label="code" />
      </div>
      <div className="mf"><button type="button" className="btn btn-ghost">Отмена</button><button className="btn btn-social" type="submit" data-testid="lobby-join">Войти</button></div>
    </form></div>
  );
}

export function OnboardingScreen({ onDone }: { onDone: () => void }) {
  return (
    <div className="overlay docked"><div className="modal">
      <div className="mh"><h2>Добро пожаловать в lume</h2><span>1 / 3</span></div>
      <div className="mb">
        <div className="steps"><span className="on" /><span /><span /></div>
        <h3>Создай или найди комнату</h3>
        <p>Создай свою, зайди к друзьям или введи код приглашения. Это займёт секунды.</p>
      </div>
      <div className="mf"><button type="button" className="btn btn-ghost" onClick={onDone}>Пропустить</button><button type="button" className="btn btn-primary" onClick={onDone}>Дальше</button></div>
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

export function RoomSettingsScreen({ onSave, token, apiUrl, roomId }: { onSave: (event: FormEvent) => void; token?: string; apiUrl?: string; roomId?: string | null }) {
  const [incidents, setIncidents] = useState<Array<{ id: string; detail: string }>>([]);
  useEffect(() => {
    if (!token || !apiUrl || !roomId) return;
    void fetch(`${apiUrl}/rooms/${roomId}/sync-incidents`, { headers: { authorization: `Bearer ${token}` } })
      .then((response) => response.json())
      .then((payload: { incidents?: Array<{ id: string; detail: string }> }) => setIncidents(payload.incidents ?? []))
      .catch(() => setIncidents([]));
  }, [token, apiUrl, roomId]);
  return (
    <form className="settings-wrap" onSubmit={onSave}>
      <aside><div className="slink on">Модерация</div><div className="slink">Права</div></aside>
      <div className="panel">
        <h2>Настройки комнаты</h2>
        <p className="lead">Права зрителей, медленный режим и чёрный список.</p>
        <div className="set-row"><div><b>Чат</b><small>Зрители могут писать</small></div><div className="seg"><button type="button" className="on">Вкл</button><button type="button">Выкл</button></div></div>
        <div className="set-row"><div><b>Голос</b><small>Зрители могут говорить</small></div><div className="seg"><button type="button" className="on">Вкл</button><button type="button">Выкл</button></div></div>
        <div className="set-row"><div><b>Медленный режим</b><small>Одно сообщение в 10 секунд</small></div></div>
        {viewerPermissionKeys.map((key) => (
          <div className="set-row" key={key}><div><b>{key}</b></div><div className="seg"><button type="button" className="on">Вкл</button><button type="button">Выкл</button></div></div>
        ))}
        <button className="btn btn-primary" type="submit">Сохранить</button>
        <h3>Сбои синхронизации</h3>
        {incidents.length === 0 ? <p>Пока пусто. Храним последние 10.</p> : incidents.map((item) => <p key={item.id}>{item.detail || item.id}</p>)}
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
