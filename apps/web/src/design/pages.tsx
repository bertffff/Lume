import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { favouriteLine, linkedLabel, roomPresetById, roomPresets, viewerPermissionKeys, type RoomPresetId } from "@lume/contracts";
import { permissionLabel } from "./copy.js";
import { initials, personHue } from "./theme.js";

export function CodeInput({
  value,
  onChange,
  slots = 8,
  testId = "lobby-code",
  label = "Код комнаты",
  autoFocus = false,
}: {
  value: string;
  onChange: (value: string) => void;
  slots?: number;
  testId?: string;
  label?: string;
  autoFocus?: boolean;
}) {
  const count = Math.max(slots, Math.min(12, value.length));
  return (
    <div className="code-input">
      <div className="code-cells" aria-hidden="true">
        {Array.from({ length: count }, (_, index) => (
          <span key={index} className={value[index] ? "filled" : ""}>{value[index] ?? ""}</span>
        ))}
      </div>
      <input
        data-testid={testId}
        className="code-native"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        maxLength={12}
        autoComplete="off"
        autoCapitalize="none"
        spellCheck={false}
        aria-label={label}
        autoFocus={autoFocus}
      />
    </div>
  );
}

import type { ModeId, StyleId } from "./theme.js";

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
  const [linked, setLinked] = useState("не привязан");
  const [services, setServices] = useState<string[]>([]);
  const [friendsPublic, setFriendsPublic] = useState(true);
  const [historyPublic, setHistoryPublic] = useState(true);
  const [hideOther, setHideOther] = useState(false);
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
      .then((payload: { isFriendsPublic?: boolean; isWatchHistoryPublic?: boolean; hideOtherReactions?: boolean }) => {
        if (typeof payload.isFriendsPublic === "boolean") setFriendsPublic(payload.isFriendsPublic);
        if (typeof payload.isWatchHistoryPublic === "boolean") setHistoryPublic(payload.isWatchHistoryPublic);
        if (typeof payload.hideOtherReactions === "boolean") setHideOther(payload.hideOtherReactions);
      })
      .catch(() => undefined);
  }, [token, apiUrl]);
  const system = mode === "system";
  return (
    <div className="settings-wrap">
      <aside>
        {([
          ["Оформление", "settings-appearance"],
          ["Аккаунт", "settings-account"],
          ["Уведомления", "settings-notifications"],
          ["Приватность", "settings-privacy"],
          ["Язык", "settings-language"],
          ["Плеер", "settings-player"],
          ["Голос", "settings-voice"],
        ] as const).map(([label, id], index) => (
          <button
            key={id}
            type="button"
            className={index === 0 ? "slink on" : "slink"}
            onClick={() => document.getElementById(id)?.scrollIntoView({ block: "start", behavior: "smooth" })}
          >
            {label}
          </button>
        ))}
      </aside>
      <div className="panel" id="settings-appearance">
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
          <div className="seg">
            <button type="button" className={style === "cinema" ? "on" : ""} onClick={() => onStyle("cinema")}>Кинозал</button>
            <button type="button" className={style === "gruvbox" ? "on" : ""} onClick={() => onStyle("gruvbox")}>Gruvbox</button>
          </div>
        </div>
        <div className="set-row">
          <div><b>Тема</b><small>Тёмная для вечера, светлая для дня.</small></div>
          <div className="seg">
            <button type="button" className={!system && mode === "dark" ? "on" : ""} onClick={() => onMode("dark")}>Тёмная</button>
            <button type="button" className={!system && mode === "light" ? "on" : ""} onClick={() => onMode("light")}>Светлая</button>
          </div>
        </div>
        <div className="set-row">
          <div><b>Как в системе</b><small>Следовать светлой или тёмной теме устройства</small></div>
          <div className="seg">
            <button type="button" className={system ? "" : "on"} onClick={() => onMode("dark")}>Выкл</button>
            <button type="button" className={system ? "on" : ""} onClick={() => onMode("system")}>Вкл</button>
          </div>
        </div>
        <div className="set-row" id="settings-account">
          <div><b>Telegram</b><small>{linked}. Отвязка только если есть почта.</small></div>
          <div className="inline-actions">
            <input value={telegramId} onChange={(event) => setTelegramId(event.target.value)} placeholder="Telegram ID" aria-label="Telegram ID" />
            <button type="button" onClick={() => { if (!token || !apiUrl) return; void fetch(`${apiUrl}/auth/link-telegram`, { method: "POST", headers: { authorization: `Bearer ${token}`, "content-type": "application/json" }, body: JSON.stringify({ telegramId }) }); }}>Привязать</button>
            <button type="button" onClick={() => { if (!token || !apiUrl) return; void fetch(`${apiUrl}/auth/unlink-telegram`, { method: "POST", headers: { authorization: `Bearer ${token}` } }); }}>Отвязать</button>
          </div>
        </div>
        <div className="set-row" id="settings-notifications"><div><b>Уведомления</b><small>Сеансы друзей, приглашения, напоминания</small></div></div>
        <div className="set-row" id="settings-privacy">
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
                void fetch(`${apiUrl}/me`, { method: "PATCH", headers: { authorization: `Bearer ${token}`, "content-type": "application/json" }, body: JSON.stringify({ isFriendsPublic: next }) }).catch(() => setFriendsPublic(!next));
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
                void fetch(`${apiUrl}/me`, { method: "PATCH", headers: { authorization: `Bearer ${token}`, "content-type": "application/json" }, body: JSON.stringify({ isWatchHistoryPublic: next }) }).catch(() => setHistoryPublic(!next));
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
        <div className="set-row" id="settings-language"><div><b>Язык</b><small>Русский</small></div></div>
        <div className="set-row"><div><b>Сервисы извлечения</b><small>{services.length === 0 ? "Cobalt не задан" : services.join(", ")}</small></div></div>
        <div className="set-row" id="settings-voice"><div><b>Голос</b><small>Голосовые комнаты работают через LiveKit, если сервер настроен.</small></div></div>
        <div className="set-row"><div><b>HLS</b><small>Манифест переписывается, когда извлечения включены.</small></div></div>
        <div className="set-row"><div><b>Реакции</b><button type="button" onClick={() => { if (!token || !apiUrl) return; const next = !hideOther; setHideOther(next); void fetch(`${apiUrl}/me`, { method: "PATCH", headers: { authorization: `Bearer ${token}`, "content-type": "application/json" }, body: JSON.stringify({ hideOtherReactions: next }) }).catch(() => setHideOther(!next)); }}>{hideOther ? "Показать чужие" : "Скрыть чужие"}</button></div></div>
        <div className="set-row"><div><b>Telegram</b><small>{linked.includes("Telegram") ? "Уведомления бота включены" : "Бот молчит, пока Telegram не привязан"}</small></div></div>
        <div className="set-row" id="settings-player"><div><b>Плеер</b><small>Качество и скорость подбираются по источнику.</small></div></div>
        <div className="set-row">
          <div><b>Удаление аккаунта</b><small>30 дней на восстановление. Подтверждение — DELETE.</small></div>
          <button type="button" onClick={() => { if (!token || !apiUrl) return; if (!window.confirm("Удалить аккаунт? Его можно восстановить в течение 30 дней.")) return; void fetch(`${apiUrl}/me/delete`, { method: "POST", headers: { authorization: `Bearer ${token}`, "content-type": "application/json" }, body: JSON.stringify({ confirmation: "DELETE" }) }).catch(() => undefined); }}>Удалить</button>
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
  const [friends, setFriends] = useState<Array<{ id: string; userId: string; displayName: string; roomId?: string | null; roomTitle?: string | null }>>([]);
  const [incoming, setIncoming] = useState<Array<{ id: string; userId: string; displayName: string }>>([]);
  const [notes, setNotes] = useState<Array<{ id: string; title: string; body: string }>>([]);
  const [bio, setBio] = useState("");
  const [heat, setHeat] = useState<Array<{ day: string; score: number }>>([]);
  const [boards, setBoards] = useState<{ messages: LeaderboardRow[]; reactions: LeaderboardRow[]; voice: LeaderboardRow[] }>({ messages: [], reactions: [], voice: [] });
  const [searchQuery, setSearchQuery] = useState("");
  const [found, setFound] = useState<Array<{ id: string; displayName: string }>>([]);
  const [publicProfile, setPublicProfile] = useState<PublicProfile | null>(null);
  const [friendsVersion, setFriendsVersion] = useState(0);
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
      .then((payload: { platforms?: Array<{ source: string; count: number }>; topFriends?: Array<{ partnerId: string; seconds: number }>; heatmap?: Array<{ day: string; score: number }> }) => {
        setPlatforms(payload.platforms ?? []);
        setFriendsWatch(payload.topFriends ?? []);
        setHeat(Array.isArray(payload.heatmap) ? payload.heatmap : []);
      })
      .catch(() => undefined);
    void fetch(`${apiUrl}/friends`, { headers: { authorization: `Bearer ${token}` } })
      .then((response) => response.json())
      .then((payload: { friends?: typeof friends; incoming?: typeof incoming }) => {
        setFriends(payload.friends ?? []);
        setIncoming(payload.incoming ?? []);
      })
      .catch(() => {
        setFriends([]);
        setIncoming([]);
      });
    void fetch(`${apiUrl}/notifications`, { headers: { authorization: `Bearer ${token}` } })
      .then((response) => response.json())
      .then((payload: { notifications?: Array<{ id: string; title: string; body: string }> }) => setNotes(payload.notifications ?? []))
      .catch(() => setNotes([]));
    void fetch(`${apiUrl}/me`, { headers: { authorization: `Bearer ${token}` } })
      .then((response) => response.json())
      .then((payload: { bio?: string | null }) => setBio(payload.bio ?? ""))
      .catch(() => setBio(""));
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
  }, [token, apiUrl, userId, friendsVersion]);
  const earnedCount = achievements.filter((item) => item.earned).length;

  async function searchPeople(event: FormEvent) {
    event.preventDefault();
    if (!token || !apiUrl) return;
    const query = searchQuery.trim();
    if (!query) {
      setFound([]);
      return;
    }
    const response = await fetch(`${apiUrl}/users/search?q=${encodeURIComponent(query)}`, { headers: { authorization: `Bearer ${token}` } });
    if (!response.ok) {
      setFound([]);
      return;
    }
    const payload = (await response.json()) as { users?: Array<{ id: string; displayName: string }> };
    setFound(payload.users ?? []);
  }

  async function openPublicProfile(personId: string) {
    if (!token || !apiUrl) return;
    const response = await fetch(`${apiUrl}/users/profile/${personId}`, { headers: { authorization: `Bearer ${token}` } });
    if (!response.ok) {
      setPublicProfile(null);
      return;
    }
    setPublicProfile((await response.json()) as PublicProfile);
  }

  function addFriend(personId: string) {
    if (!token || !apiUrl) return;
    void fetch(`${apiUrl}/friends/request`, {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({ userId: personId }),
    });
  }

  function answerFriend(id: string, action: "accept" | "decline") {
    if (!token || !apiUrl) return;
    void fetch(`${apiUrl}/friends/${id}/${action}`, { method: "POST", headers: { authorization: `Bearer ${token}` } })
      .then(() => setFriendsVersion((value) => value + 1));
  }

  function inviteFriend(roomId: string, friendId: string) {
    if (!token || !apiUrl) return;
    void fetch(`${apiUrl}/rooms/${roomId}/invite`, {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({ userId: friendId }),
    });
  }

  return (
    <div className="profile-wrap">
      <aside className="side-p">
        <div className="card" style={{ textAlign: "center" }}>
          <span className="av p-me ring" style={{ width: 80, height: 80, fontSize: 26, margin: "0 auto 10px" }}>{initials(displayName ?? "Вы")}</span>
          <b className="nm p-me" style={{ display: "block", font: "600 18px/22px var(--font-display)" }}>{displayName ?? "Вы"}</b>
          <div style={{ color: "var(--text-2)", fontSize: 13, marginTop: 4 }}>
            <span data-testid="profile-level">Уровень {level}</span> · <span data-testid="profile-xp">{totalXp} XP</span>
          </div>
          <p style={{ color: "var(--text-2)", fontSize: 13, marginTop: 6 }} data-testid="profile-next-level">до следующего уровня {Math.max(0, nextLevelXp - totalXp)} XP</p>
          {bio ? <p style={{ color: "var(--text-2)", fontSize: 12, marginTop: 6 }}>{bio}</p> : null}
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
          {friends.length > 0 ? friends.slice(0, 5).map((friend) => (
            <div className="fr" key={friend.id}>
              <span className={`av lg p-${personHue(friend.userId)}`}>{initials(friend.displayName)}</span>
              <div><div className={`n p-${personHue(friend.userId)}`}>{friend.displayName}</div><div className="s">{friend.roomTitle ? `в «${friend.roomTitle}»` : "в lume"}</div></div>
            </div>
          )) : <p className="empty-note">Пока никого нет — найдите друзей по имени.</p>}
        </div>
        {incoming.length > 0 ? (
          <div className="card">
            <h3>Заявки в друзья</h3>
            {incoming.map((row) => (
              <div className="fr" key={row.id}>
                <span className={`av lg p-${personHue(row.userId)}`}>{initials(row.displayName)}</span>
                <div><div className={`n p-${personHue(row.userId)}`}>{row.displayName}</div><div className="s">хочет дружить</div></div>
                <span className="fr-actions">
                  <button type="button" className="mini" onClick={() => answerFriend(row.id, "accept")}>Принять</button>
                  <button type="button" className="mini" onClick={() => answerFriend(row.id, "decline")}>Отклонить</button>
                </span>
              </div>
            ))}
          </div>
        ) : null}
      </aside>
      <main>
        <div className="grid3">
          <div className="stat"><small>Уровень</small><b>{level}</b></div>
          <div className="stat"><small>Опыт</small><b>{totalXp} XP</b></div>
          <div className="stat"><small>Достижения</small><b>{earnedCount} из {totalAchievements}</b></div>
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
          {heat.some((cell) => cell.score > 0) ? (
            <>
              <div className="stats">{heat.filter((cell) => cell.score > 0).length} дней с сеансами · {heat.reduce((total, cell) => total + cell.score, 0)} сеансов</div>
              <div className="heat-grid">{heat.slice(-119).map((cell) => <i key={cell.day} className={cell.score > 3 ? "a3" : cell.score > 0 ? "a1" : ""} />)}</div>
            </>
          ) : <p className="empty-note">Проведите первый сеанс — здесь появится карта сезона.</p>}
        </div>
        <div className="card">
          <div className="heat-top"><h3>Люди</h3></div>
          <form className="friend-search-row" onSubmit={(event) => void searchPeople(event)}>
            <input data-testid="friend-search" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Найти человека по имени" aria-label="Поиск людей" />
            <button type="submit" className="btn btn-outline">Искать</button>
          </form>
          {found.length > 0 ? (
            <div className="people-results">
              {found.map((person) => (
                <div className="fr" key={person.id} data-testid="friend-result">
                  <span className={`av lg p-${personHue(person.id)}`}>{initials(person.displayName)}</span>
                  <div><div className={`n p-${personHue(person.id)}`}>{person.displayName}</div><div className="s">найден в lume</div></div>
                  <span className="fr-actions">
                    <button type="button" className="mini" data-testid="people-open-profile" onClick={() => void openPublicProfile(person.id)}>Профиль</button>
                    <button type="button" className="mini go" onClick={() => addFriend(person.id)}>В друзья</button>
                  </span>
                </div>
              ))}
            </div>
          ) : null}
          {publicProfile ? (
            <section className="card public-profile" data-testid="public-profile">
              <h3 data-testid="public-profile-name">{publicProfile.displayName}</h3>
              <p data-testid="public-profile-level">Уровень {publicProfile.level}{publicProfile.username && !publicProfile.username.includes(":") ? ` · ${publicProfile.username}` : ""}</p>
              {publicProfile.bio ? <p>{publicProfile.bio}</p> : null}
              <div data-testid="public-profile-history">
                <b>История просмотров</b>
                {publicProfile.watchHistory === null ? <p>Скрыто</p> : publicProfile.watchHistory.length === 0 ? <p>Пока пусто</p> : (
                  <ul>
                    {publicProfile.watchHistory.map((item) => (
                      <li key={item.url} data-testid="public-profile-history-item" data-url={item.url}>{item.title || item.url} · {item.watchCount}</li>
                    ))}
                  </ul>
                )}
              </div>
              <div data-testid="public-profile-friends">
                <b>Друзья</b>
                {publicProfile.friends === null ? <p>Скрыто</p> : publicProfile.friends.length === 0 ? <p>Пока пусто</p> : (
                  <ul>{publicProfile.friends.map((friend) => <li key={friend.id}>{friend.displayName}</li>)}</ul>
                )}
              </div>
            </section>
          ) : null}
          {friends.length > 0 ? (
            <div className="people-results">
              {friends.map((friend) => (
                <div className="fr" key={friend.id}>
                  <span className={`av lg p-${personHue(friend.userId)}`}>{initials(friend.displayName)}</span>
                  <div><div className={`n p-${personHue(friend.userId)}`}>{friend.displayName}</div><div className="s">{friend.roomTitle ? `в «${friend.roomTitle}»` : "в lume"}</div></div>
                  {friend.roomId ? <button type="button" className="mini" onClick={() => inviteFriend(friend.roomId!, friend.userId)}>Позвать</button> : null}
                </div>
              ))}
            </div>
          ) : null}
        </div>
        <div data-testid="leaderboards">
          <h3>Таблица</h3>
          {(["messages", "reactions", "voice"] as const).map((board) => (
            <div key={board} data-testid={`profile-leaderboard-${board}`}>
              <b>{board === "messages" ? "Сообщения" : board === "reactions" ? "Реакции" : "Голос"}</b>
              {boards[board].length === 0 ? <p>Пока пусто</p> : boards[board].map((row) => (
                <p key={row.userId} data-testid={`leaderboard-${board}-row`} data-user-id={row.userId} data-value={row.value}>{row.displayName} · {row.value}</p>
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
        <h3>Недавние видео</h3>
        {history.length > 0 ? (
          <div className="rooms">
            {history.slice(0, 3).map((item) => (
              <div key={item.url} className="rc"><div className="th" /><div className="bd"><b>{item.title || item.url}</b><div className="meta"><span className="viewers">просмотрено {item.watchCount} раз</span></div></div></div>
            ))}
          </div>
        ) : <p className="empty-note">Пока нет недавних комнат.</p>}
        <h3>Уведомления</h3>
        {notes.length === 0 ? <p className="empty-note">Нет уведомлений.</p> : notes.slice(0, 5).map((note) => (
          <p key={note.id} className="profile-note"><b>{note.title}</b> · {note.body}</p>
        ))}
      </main>
    </div>
  );
}

interface LeaderboardRow {
  userId: string;
  displayName: string;
  value: number;
}

interface PublicProfile {
  id: string;
  displayName: string;
  username: string | null;
  bio: string | null;
  level: number;
  watchHistory: Array<{ url: string; title: string | null; watchCount: number }> | null;
  friends: Array<{ id: string; displayName: string }> | null;
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

export function PremiumScreen() {
  return (
    <div className="wrap shop-wrap">
      <h1>Витрина Blink</h1>
      <p className="lead">Косметика для профиля и комнаты. Приложение полностью удобно и без неё — это только украшения.</p>
      <div className="empty">
        <h2>Витрина пока пуста</h2>
        <p>Товары появятся здесь, когда запустится магазин. Сейчас доступны только бесплатные возможности.</p>
      </div>
    </div>
  );
}

export function NotificationsScreen({ items }: { items: Array<{ id: string; kind: string; title: string; body: string }> }) {
  return (
    <div className="notifications-page">
      <aside className="npanel">
        <div className="mh"><h2>Уведомления</h2><span className="sp" /><span>{items.length}</span></div>
        {items.length === 0 ? <p className="empty-note">Нет уведомлений.</p> : items.map((item) => (
          <div className="nitem" key={item.id} data-kind={item.kind}><div><div className="t">{item.title}</div><div className="s">{item.body}</div></div></div>
        ))}
      </aside>
    </div>
  );
}

export function CreateScreen({ title, onTitle, preset, onPreset, onSubmit, onCancel, busy = false }: {
  title: string;
  onTitle: (value: string) => void;
  preset: RoomPresetId | null;
  onPreset: (value: RoomPresetId) => void;
  onSubmit: (event: FormEvent) => void;
  onCancel?: () => void;
  busy?: boolean;
}) {
  const chosen = preset ? roomPresetById(preset) : null;
  return (
    <div className="overlay docked" role="dialog" aria-modal="true" aria-label="Создание комнаты">
      <form className="modal lg" onSubmit={onSubmit}>
        <div className="mh">
          <div>
            <h2>Создать комнату</h2>
            <small style={{ color: "var(--text-2)", fontSize: 12 }}>Шаг 1 из 2 · название и правила</small>
          </div>
          <span className="sp" />
          <button type="button" aria-label="Закрыть" onClick={onCancel}>×</button>
        </div>
        <div className="mb">
          <div className="steps"><span className="on" /><span className="on" /><span /></div>
          <label className="field">Название
            <input data-testid="lobby-title" value={title} onChange={(event) => onTitle(event.target.value)} placeholder="Ночной кинозал" autoFocus />
          </label>
          <div>
            <div className="choice-label">Пресет модерации</div>
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
          </div>
          <div>
            <div className="choice-label">Кто может войти</div>
            <div className="choices">
              <div className={chosen && !chosen.isPublic ? "choice on" : "choice"}><b>По коду</b><p>Кто знает код комнаты</p></div>
              <div className={chosen?.isPublic ? "choice on" : "choice"}><b>Публичная</b><p>Видна в открытых комнатах</p></div>
            </div>
          </div>
          {chosen ? (
            <p className="lead" data-testid="create-preset-summary" data-max={chosen.maxMembers} data-public={chosen.isPublic ? "true" : "false"} data-slow={chosen.slowModeSeconds}>
              {chosen.hint} Лимит {chosen.maxMembers}.
            </p>
          ) : null}
          <div>
            <div className="choice-label">Права зрителей по умолчанию</div>
            <div className="choices" data-testid="create-preset-rights">
              {viewerPermissionKeys.map((key) => (
                <div key={key} className={chosen?.defaults[key] ? "choice on" : "choice"}>
                  <b>{permissionLabel(key)}</b>
                  <p>{chosen ? (chosen.defaults[key] ? "Разрешено" : "Запрещено") : "Из пресета"}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="mf">
          <button type="button" className="btn btn-ghost" onClick={onCancel}>Назад</button>
          <button className="btn btn-primary" type="submit" data-testid="lobby-create" disabled={busy}>{busy ? "Создаём…" : "Создать комнату"}</button>
        </div>
      </form>
    </div>
  );
}

export function JoinScreen({ code, onCode, onSubmit, onCancel }: { code: string; onCode: (value: string) => void; onSubmit: (event: FormEvent) => void; onCancel?: () => void }) {
  return (
    <div className="overlay docked" role="dialog" aria-modal="true" aria-label="Вход по коду">
      <form className="modal" onSubmit={onSubmit}>
        <div className="mh">
          <div>
            <h2>Войти по коду</h2>
            <small style={{ color: "var(--text-2)", fontSize: 12 }}>Код из приглашения</small>
          </div>
          <span className="sp" />
          <button type="button" aria-label="Закрыть" onClick={onCancel}>×</button>
        </div>
        <div className="mb">
          <label className="field">Код комнаты
            <CodeInput value={code} onChange={onCode} slots={8} autoFocus />
          </label>
          <p className="lead">Код не чувствителен к регистру. Если код не подходит — попросите новое приглашение у ведущего.</p>
        </div>
        <div className="mf">
          <button type="button" className="btn btn-ghost" onClick={onCancel}>Отмена</button>
          <button className="btn btn-primary" type="submit" data-testid="lobby-join">Войти</button>
        </div>
      </form>
    </div>
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

export function RoomSettingsScreen({ token, apiUrl, roomId }: { token?: string; apiUrl?: string; roomId?: string | null }) {
  const [settings, setSettings] = useState<{
    title: string;
    description: string;
    isPublic: boolean;
    maxMembers: number;
    hideReactions: boolean;
    defaults: Record<string, boolean> | null;
  } | null>(null);
  const [incidents, setIncidents] = useState<Array<{ id: string; detail: string }>>([]);
  useEffect(() => {
    if (!token || !apiUrl || !roomId) return;
    let stopped = false;
    void fetch(`${apiUrl}/rooms/${roomId}/sync-incidents`, { headers: { authorization: `Bearer ${token}` } })
      .then((response) => response.json())
      .then((payload: { incidents?: Array<{ id: string; detail: string }> }) => {
        if (!stopped) setIncidents(payload.incidents ?? []);
      })
      .catch(() => {
        if (!stopped) setIncidents([]);
      });
    void fetch(`${apiUrl}/rooms/${roomId}/settings`, { headers: { authorization: `Bearer ${token}` } })
      .then((response) => response.json())
      .then((payload: typeof settings) => {
        if (!stopped) setSettings(payload);
      })
      .catch(() => undefined);
    return () => {
      stopped = true;
    };
  }, [token, apiUrl, roomId]);
  if (!token || !roomId) {
    return (
      <div className="settings-wrap">
        <div className="panel">
          <h2>Настройки комнаты</h2>
          <p className="empty-note">Откройте комнату, чтобы увидеть её настройки.</p>
        </div>
      </div>
    );
  }
  return (
    <div className="settings-wrap">
      <aside><div className="slink on">Модерация</div><div className="slink">Права</div></aside>
      <div className="panel">
        <h2>Настройки комнаты</h2>
        <p className="lead">Текущие значения из базы. Изменять их можно в самой комнате.</p>
        {settings ? (
          <>
            <div className="set-row"><div><b>{settings.title}</b><small>{settings.isPublic ? "Публичная комната" : "Вход по коду"}</small></div></div>
            <div className="set-row"><div><b>Лимит участников</b><small>{settings.maxMembers}</small></div></div>
            <div className="set-row"><div><b>Чужие реакции</b><small>{settings.hideReactions ? "Скрыты" : "Показаны"}</small></div></div>
            {viewerPermissionKeys.map((key) => (
              <div className="set-row" key={key}><div><b>{permissionLabel(key)}</b><small>{settings.defaults?.[key] ? "Разрешено зрителям" : "Запрещено зрителям"}</small></div></div>
            ))}
          </>
        ) : <p className="empty-note">Загрузка настроек…</p>}
        <h3>Сбои синхронизации</h3>
        {incidents.length === 0 ? <p>Пока пусто. Храним последние 10.</p> : incidents.map((item) => <p key={item.id}>{item.detail || item.id}</p>)}
      </div>
    </div>
  );
}

export function EmptyScreen({ title, body, action }: { title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="page-body"><div className="empty"><h2>{title}</h2>{body ? <p>{body}</p> : null}{action}</div></div>
  );
}

export function MobileHome({
  session,
  rooms = [],
  name,
  onName,
  onSignIn,
  onTelegram,
  onCreate,
  onOpenRoom,
  code,
  onCode,
  onJoin,
}: {
  session: { user: { displayName: string } } | null;
  rooms?: Array<{ id: string; title: string; code: string; memberCount?: number }>;
  name: string;
  onName: (value: string) => void;
  onSignIn: (event: FormEvent) => void;
  onTelegram: () => void;
  onCreate: () => void;
  onOpenRoom: (room: { id: string; title: string; code: string; memberCount?: number }) => void;
  code: string;
  onCode: (value: string) => void;
  onJoin: (event: FormEvent) => void;
}) {
  return (
    <div className="pad mobile-home">
      <div className="greet"><h1>Добрый вечер{session ? `, ${session.user.displayName}` : ""}</h1><div className="sub">{session ? "Открытые комнаты и быстрый вход" : "Представьтесь, чтобы создать комнату"}</div></div>
      {!session ? (
        <form className="tile auth" onSubmit={onSignIn}>
          <div className="tile-head"><span className="tile-ic">☺</span><div><h3>Вход в lume</h3><p>Имя увидит только ваша компания.</p></div></div>
          <label>Ваше имя<input data-testid="lobby-name" value={name} onChange={(event) => onName(event.target.value)} placeholder="Например, Аня" autoComplete="nickname" /></label>
          <div className="actions">
            <button type="submit" className="btn btn-primary" data-testid="lobby-sign-in">Войти</button>
            <button type="button" className="btn btn-telegram" onClick={onTelegram}>Войти через Telegram</button>
          </div>
        </form>
      ) : null}
      <div className="acts">
        <button type="button" className="tile create promo" onClick={onCreate}>
          <span className="promo-plus" aria-hidden="true">+</span>
          <h3>Создать комнату</h3>
          <p>Ссылка, друзья — и смотрим</p>
        </button>
        <form className="tile join" onSubmit={onJoin}>
          <div className="tile-head"><span className="tile-ic">#</span><div><h3>Войти по коду</h3><p>Код комнаты из приглашения</p></div></div>
          <label>Код комнаты<CodeInput value={code} onChange={onCode} slots={8} /></label>
          <div className="actions"><button type="submit" className="btn btn-social" data-testid="lobby-join">Войти</button></div>
        </form>
      </div>
      <div className="sec"><h3>Открытые комнаты</h3></div>
      <div className="rooms">
        {rooms.length > 0 ? rooms.map((room) => (
          <button key={room.id} type="button" className="rc" onClick={() => onOpenRoom(room)}>
            <div className="th" />
            <div className="bd"><b>{room.title}</b><div className="meta"><span className="viewers">{room.memberCount ?? 0} в комнате</span><span className="code">{room.code}</span></div></div>
          </button>
        )) : <p className="empty-note">Открытых комнат пока нет. Создайте свою.</p>}
      </div>
    </div>
  );
}
