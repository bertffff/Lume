import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { roomPresetById, roomPresets, type RoomPresetId } from "@lume/contracts";
import { api, apiUrl, ClientError } from "../api/client.js";
import { useI18n } from "../i18n/context.js";
import type { ClientSession } from "../session.js";
import { copy, viewersWord } from "./copy.js";
import { AuthScreen, CodeInput, CreateScreen, EmptyScreen, JoinScreen, MobileHome, NotificationsScreen, OnboardingScreen, PremiumScreen, ProfileScreen, RoomSettingsScreen, SettingsScreen } from "./pages.js";
import { applyAppearance, initials, personHue, readStoredMode, readStoredStyle, type ModeId, type StyleId } from "./theme.js";

type View =
  | "home"
  | "room"
  | "search"
  | "create"
  | "join"
  | "settings"
  | "room-settings"
  | "members"
  | "queue"
  | "profile"
  | "premium"
  | "auth"
  | "onboarding"
  | "notifications"
  | "missing"
  | "offline"
  | "unavailable";

const views = new Set<View>([
  "home", "room", "search", "create", "join", "settings", "room-settings", "members", "queue",
  "profile", "premium", "auth", "onboarding", "notifications", "missing", "offline", "unavailable",
]);

function viewFromPath(path: string): View {
  const name = path.replace(/^\//, "").split("/")[0] ?? "";
  if (name === "room-settings") return "room-settings";
  return views.has(name as View) ? (name as View) : "home";
}

function roomErrorText(code: string): string {
  if (code === "room_full") return "В комнате нет свободных мест.";
  if (code === "not_found") return "Комната с таким кодом не найдена.";
  if (code === "unauthorized") return "Сессия истекла — войдите заново.";
  if (code === "invalid_body") return "Проверьте название комнаты.";
  if (code === "conflict") return "Комната уже занята — попробуйте ещё раз.";
  return "Не удалось выполнить действие. Попробуйте ещё раз.";
}

export function DesignApp({
  session,
  onSession,
  onSignOut: _onSignOut,
  roomId,
  onOpen,
  onLeave,
  room,
}: {
  session: ClientSession | null;
  onSession: (session: ClientSession) => void;
  onSignOut: () => void;
  roomId: string | null;
  onOpen: (roomId: string) => void;
  onLeave: () => void;
  room: ReactNode;
}) {
  const { locale } = useI18n();
  const text = copy(locale);
  const [path, setPath] = useState(() => window.location.pathname);
  const [shot] = useState(() => new URLSearchParams(window.location.search).get("shot"));
  const params = new URLSearchParams(window.location.search);
  const [style, setStyle] = useState<StyleId>(params.get("style") === "gruvbox" ? "gruvbox" : readStoredStyle);
  const [mode, setMode] = useState<ModeId>(params.get("mode") === "light" || params.get("mode") === "system" || params.get("mode") === "dark" ? params.get("mode") as ModeId : readStoredMode);
  const [name, setName] = useState("");
  const [title, setTitle] = useState("");
  const [preset, setPreset] = useState<RoomPresetId | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [rooms, setRooms] = useState<Array<{ id: string; title: string; code: string; memberCount?: number }>>([]);
  const [globalStats, setGlobalStats] = useState({ usersOnline: 0, activeRooms: 0, totalVideos: 0, totalWatchHours: 0 });
  const [statsReady, setStatsReady] = useState(false);
  const [friends, setFriends] = useState<Array<{ id: string; userId: string; displayName: string; roomId?: string | null; roomTitle?: string | null }>>([]);
  const [blocked, setBlocked] = useState<Array<{ id: string; displayName: string }>>([]);
  const [globalBans, setGlobalBans] = useState<Array<{ id: string; userId: string; displayName: string; reason: string | null }>>([]);
  const [notes, setNotes] = useState<Array<{ id: string; kind: string; title: string; body: string }>>([]);
  const [unreadNotes, setUnreadNotes] = useState(0);
  const [heat, setHeat] = useState<Array<{ day: string; score: number }>>([]);
  const [level, setLevel] = useState(1);
  const [resume, setResume] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "friends" | "film" | "music">("all");
  const [narrow, setNarrow] = useState(() => window.innerWidth < 800);
  useEffect(() => {
    const onResize = () => setNarrow(window.innerWidth < 800);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  const [query, setQuery] = useState("");
  const [found, setFound] = useState<Array<{ title: string; url: string }>>([]);
  const [people, setPeople] = useState<Array<{ id: string; displayName: string }>>([]);
  const [ice, setIce] = useState<string | null>(null);
  const [offline, setOffline] = useState(() => !window.navigator.onLine);

  useEffect(() => {
    applyAppearance(style, mode);
  }, [style, mode]);

  useEffect(() => {
    const onPop = () => setPath(window.location.pathname);
    const onOff = () => setOffline(true);
    const onOn = () => setOffline(false);
    window.addEventListener("popstate", onPop);
    window.addEventListener("offline", onOff);
    window.addEventListener("online", onOn);
    return () => {
      window.removeEventListener("popstate", onPop);
      window.removeEventListener("offline", onOff);
      window.removeEventListener("online", onOn);
    };
  }, []);

  const accessToken = session?.accessToken;
  useEffect(() => {
    void api.listRooms(query).then((payload) => setRooms(payload.rooms)).catch(() => setRooms([]));
    if (!accessToken) {
      setIce(null);
      return;
    }
    void fetch(`${apiUrl}/ice-servers`, { headers: { authorization: `Bearer ${accessToken}` } })
      .then((response) => (response.ok ? response.json() : null))
      .then((payload: { iceServers?: Array<{ urls?: string | string[] }> } | null) => {
        const urls = (payload?.iceServers ?? []).flatMap((server) => (Array.isArray(server.urls) ? server.urls : server.urls ? [server.urls] : []));
        setIce(urls.length > 0 ? urls.join(" · ") : null);
      })
      .catch(() => setIce(null));
  }, [query, path, roomId, accessToken]);

  useEffect(() => {
    let stopped = false;
    const load = () => {
      void fetch(`${apiUrl}/stats/global`)
        .then((response) => response.json())
        .then((payload: Partial<typeof globalStats>) => {
          if (!stopped) {
            setGlobalStats({
              usersOnline: Number(payload.usersOnline ?? 0),
              activeRooms: Number(payload.activeRooms ?? 0),
              totalVideos: Number(payload.totalVideos ?? 0),
              totalWatchHours: Number(payload.totalWatchHours ?? 0),
            });
            setStatsReady(true);
          }
        })
        .catch(() => undefined);
    };
    load();
    const timer = window.setInterval(load, 30_000);
    return () => {
      stopped = true;
      window.clearInterval(timer);
    };
  }, [path, roomId]);

  useEffect(() => {
    if (!session) return;
    void api.friends(session.accessToken).then((list) => {
      setFriends(list.friends);
      setBlocked(list.blocked ?? []);
    }).catch(() => undefined);
    void api.notifications(session.accessToken).then((feed) => {
      setNotes(feed.notifications);
      setUnreadNotes(feed.unread);
    }).catch(() => undefined);
    void api.resume(session.accessToken).then((card) => setResume(card.resume?.title ?? null)).catch(() => undefined);
    void fetch(`${apiUrl}/me/studio`, { headers: { authorization: `Bearer ${session.accessToken}` } })
      .then((response) => response.json())
      .then((payload: { level?: number; heatmap?: Array<{ day: string; score: number }> }) => {
        if (typeof payload.level === "number") setLevel(payload.level);
        if (Array.isArray(payload.heatmap)) setHeat(payload.heatmap);
      })
      .catch(() => undefined);
    void fetch(`${apiUrl}/me`, { headers: { authorization: `Bearer ${session.accessToken}` } })
      .then((response) => response.json())
      .then((payload: { uiStyle?: StyleId; uiMode?: ModeId; telegramId?: string | null }) => {
        if (payload.uiStyle === "cinema" || payload.uiStyle === "gruvbox") setStyle(payload.uiStyle);
        if (payload.uiMode === "dark" || payload.uiMode === "light" || payload.uiMode === "system") setMode(payload.uiMode);
      })
      .catch(() => undefined);
  }, [session]);

  useEffect(() => {
    if (!session || !path.startsWith("/settings")) return;
    let stopped = false;
    void fetch(`${apiUrl}/users/${session.user.id}/blacklist`, { headers: { authorization: `Bearer ${session.accessToken}` } })
      .then((response) => response.json())
      .then((payload: { entries?: Array<{ id: string; userId: string; displayName: string; reason: string | null }> }) => {
        if (!stopped) setGlobalBans(payload.entries ?? []);
      })
      .catch(() => {
        if (!stopped) setGlobalBans([]);
      });
    return () => {
      stopped = true;
    };
  }, [path, session]);

  function go(next: string) {
    window.history.pushState({}, "", next);
    setPath(next);
    window.dispatchEvent(new PopStateEvent("popstate"));
  }

  async function signIn(event: FormEvent) {
    event.preventDefault();
    try {
      const result = await api.devLogin(name.trim() || "Гость");
      onSession({ accessToken: result.accessToken, ...(result.refreshToken ? { refreshToken: result.refreshToken } : {}), user: result.user });
    } catch (caught) {
      setError(caught instanceof ClientError ? caught.code : "request_failed");
    }
  }

  async function createRoom(event: FormEvent) {
    event.preventDefault();
    if (!session) {
      setError("Сначала войдите в аккаунт — тогда комнату можно создать.");
      go("/auth");
      return;
    }
    setError(null);
    try {
      const chosen = preset ? roomPresetById(preset) : null;
      const result = await api.createRoom(
        session.accessToken,
        title.trim() || chosen?.title || "Кинозал",
        chosen?.isPublic ?? true,
        preset ?? undefined,
      );
      onOpen(result.room.id);
      go("/");
    } catch (caught) {
      setError(caught instanceof ClientError ? roomErrorText(caught.code) : "Не удалось создать комнату. Попробуйте ещё раз.");
    }
  }

  async function joinRoom(event: FormEvent) {
    event.preventDefault();
    if (!session) {
      setError("Сначала войдите в аккаунт — тогда можно войти по коду.");
      go("/auth");
      return;
    }
    const value = code.trim();
    if (!value) {
      setError("Введите код комнаты из приглашения.");
      return;
    }
    setError(null);
    try {
      const result = await api.joinRoom(session.accessToken, value);
      onOpen(result.room.id);
      go("/");
    } catch (caught) {
      setError(caught instanceof ClientError ? (caught.code === "not_found" ? "Комната с таким кодом не найдена." : "Не удалось войти в комнату.") : "Не удалось войти в комнату.");
    }
  }

  async function saveAppearance(nextStyle: StyleId, nextMode: ModeId) {
    setStyle(nextStyle);
    setMode(nextMode);
    applyAppearance(nextStyle, nextMode);
    if (!session) return;
    await fetch(`${apiUrl}/me`, {
      method: "PATCH",
      headers: { authorization: `Bearer ${session.accessToken}`, "content-type": "application/json" },
      body: JSON.stringify({ uiStyle: nextStyle, uiMode: nextMode }),
    });
  }

  const view: View = shot && views.has(shot as View) ? (shot as View) : offline ? "offline" : roomId ? "room" : viewFromPath(path);
  const chosenPreset = preset ? roomPresetById(preset) : null;
  const reminders = notes.filter((note) => note.kind === "SYSTEM");
  const shownRooms = rooms.filter((roomItem) => {
    const q = query.trim().toLowerCase();
    if (q && !roomItem.title.toLowerCase().includes(q) && !roomItem.code.includes(q)) return false;
    if (filter === "film") return /кино|film/i.test(roomItem.title);
    if (filter === "music") return /звук|music|концерт/i.test(roomItem.title);
    return true;
  });

  return (
    <div className={narrow ? "design-app is-narrow session-hub" : "design-app session-hub"} data-view={view}>
      {view === "room" || view === "auth" ? null : style === "gruvbox" ? <GruvboxBar view={view} onGo={go} text={text} /> : (
        <nav className="nav">
          <button type="button" className="logo" onClick={() => { onLeave(); go("/"); }}><i />lume</button>
          <label className="search-lg">
            <Icon name="search" />
            <input aria-label={text.search} placeholder={text.search} value={query} onChange={(event) => setQuery(event.target.value)} onFocus={() => go("/search")} />
            <span className="kbd">/</span>
          </label>
          <div className="nav-actions">
            <button type="button" className="icon-btn bell" onClick={() => go("/notifications")} aria-label={text.notifications}><Icon name="bell" />{unreadNotes > 0 ? <span className="badge-dot" data-count={unreadNotes} /> : null}</button>
            <button type="button" className="theme-btn" onClick={() => void saveAppearance(style, mode === "dark" ? "light" : "dark")} aria-label={text.mode}><Icon name="sun" /><Icon name="moon" /></button>
            <button type="button" className="me" onClick={() => go("/profile")}>
              <span className="av p-me">{initials(session?.user.displayName ?? "?")}</span>
              <span className="nm p-me">{session?.user.displayName ?? text.signIn}</span>
            </button>
          </div>
        </nav>
      )}
      {view === "room" && roomId ? room : null}
      {(view === "room" || view === "members" || view === "queue" || view === "unavailable") && !roomId ? (
        <RoomPreview unavailable={view === "unavailable"} onGo={go} />
      ) : null}
      {view === "home" && style === "gruvbox" ? (
        <GruvboxHome
          session={session}
          rooms={shownRooms}
          heat={heat}
          resume={resume}
          name={name}
          onName={setName}
          onSignIn={(event) => void signIn(event)}
          onGo={go}
          code={code}
          onCode={setCode}
          onJoin={(event) => { if (!session) { event.preventDefault(); go("/auth"); return; } void joinRoom(event); }}
          onOpen={(item) => { if (!session) { go("/auth"); return; } void api.joinRoom(session.accessToken, item.code).then((result) => onOpen(result.room.id)); }}
        />
      ) : null}
      {view === "home" && narrow && style !== "gruvbox" ? (
        <MobileHome
          session={session}
          rooms={shownRooms}
          name={name}
          onName={setName}
          onSignIn={(event) => void signIn(event)}
          onTelegram={() => void signIn({ preventDefault() {} } as FormEvent)}
          onCreate={() => go(session ? "/create" : "/auth")}
          onOpenRoom={(item) => { if (!session) { go("/auth"); return; } void api.joinRoom(session.accessToken, item.code).then((result) => onOpen(result.room.id)); }}
          code={code}
          onCode={setCode}
          onJoin={(event) => { if (!session) { event.preventDefault(); go("/auth"); return; } void joinRoom(event); }}
        />
      ) : null}
      {(view === "home" || view === "onboarding") && style !== "gruvbox" && !narrow ? (
        <div className="wrap screen-scroll">
          <main>
            <div className="home-hero">
              <div className="greet">
                <h1>{text.evening}{session ? `, ${session.user.displayName}` : ""}</h1>
                <p className="sub">{session ? "Комнаты друзей, ваши сеансы и открытые залы — всё на одном экране" : "Представьтесь, чтобы создать комнату или войти по коду"}</p>
              </div>
            </div>
            <section className="global-stats" data-testid="global-stats" data-ready={statsReady ? "true" : "false"}>
              <div className="stat"><small>Сейчас онлайн</small><b data-testid="stat-users-online" data-value={globalStats.usersOnline}>{globalStats.usersOnline}</b></div>
              <div className="stat"><small>Активные комнаты</small><b data-testid="stat-active-rooms" data-value={globalStats.activeRooms}>{globalStats.activeRooms}</b></div>
              <div className="stat"><small>Видео в истории</small><b data-testid="stat-total-videos" data-value={globalStats.totalVideos}>{globalStats.totalVideos}</b></div>
              <div className="stat"><small>Часов вместе</small><b data-testid="stat-watch-hours" data-value={globalStats.totalWatchHours}>{globalStats.totalWatchHours}</b></div>
            </section>
            {!session ? (
              <div className="acts">
                <form className="tile auth" onSubmit={(event) => void signIn(event)}>
                  <div className="tile-head">
                    <span className="tile-ic"><Icon name="user" /></span>
                    <div><h3>Вход в lume</h3><p>Как вас представить в комнате? Имя увидит только ваша компания.</p></div>
                  </div>
                  <label>
                    Ваше имя
                    <input data-testid="lobby-name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Например, Аня" autoComplete="nickname" />
                  </label>
                  <div className="actions">
                    <button type="submit" className="btn btn-primary" data-testid="lobby-sign-in">Войти</button>
                    <button type="button" className="btn btn-telegram" onClick={() => void signIn({ preventDefault() {} } as FormEvent)}>{text.telegram}</button>
                  </div>
                </form>
                <div className="tile create">
                  <div className="tile-head">
                    <span className="tile-ic"><Icon name="plus" /></span>
                    <div><h3>{text.create}</h3><p>{text.createHint}</p></div>
                  </div>
                  <p>Выберите пресет модерации, позовите друзей и включите первое видео.</p>
                  <div className="actions">
                    <button type="button" className="btn btn-primary" data-testid="home-create-open" onClick={() => go("/auth")}>Открыть мастер</button>
                    <span className="hint">Сначала нужно представиться</span>
                  </div>
                </div>
                <form className="tile join" onSubmit={(event) => { event.preventDefault(); if (!session) { go("/auth"); return; } void joinRoom(event); }}>
                  <div className="tile-head">
                    <span className="tile-ic"><Icon name="key" /></span>
                    <div><h3>{text.join}</h3><p>{text.joinHint}</p></div>
                  </div>
                  <label>
                    Код комнаты
                    <CodeInput value={code} onChange={setCode} slots={8} />
                  </label>
                  <div className="actions">
                    <button type="submit" className="btn btn-social" data-testid="lobby-join">{text.enter}</button>
                  </div>
                </form>
              </div>
            ) : (
              <div className="acts">
                <button type="button" className="tile resume" onClick={() => {
                  if (!session) return;
                  void fetch(`${apiUrl}/rooms/resume-last`, { method: "POST", headers: { authorization: `Bearer ${session.accessToken}` } })
                    .then((response) => response.json())
                    .then((payload: { room?: { id: string } }) => { if (payload.room) onOpen(payload.room.id); });
                }}>
                  <div className="c">
                    <div className="eyebrow">{text.resume}</div>
                    <h2>{resume ?? text.empty}</h2>
                    <div className="sub">{resume ? "Открыть последнюю комнату" : "Начните первый сеанс — он появится здесь"}</div>
                  </div>
                </button>
                <form className="tile create" onSubmit={(event) => void createRoom(event)}>
                  <div className="tile-head">
                    <span className="tile-ic"><Icon name="plus" /></span>
                    <div><h3>{text.create}</h3><p>{text.createHint}</p></div>
                  </div>
                  <input data-testid="lobby-title" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Название комнаты" aria-label="Название комнаты" />
                  <div className="chips" data-testid="lobby-presets">
                    {roomPresets.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        className={preset === item.id ? "pill on" : "pill"}
                        data-testid={`lobby-preset-${item.id}`}
                        onClick={() => {
                          setPreset(item.id);
                          setTitle(item.title);
                        }}
                      >
                        {item.title}
                      </button>
                    ))}
                  </div>
                  {chosenPreset ? (
                    <small data-testid="lobby-preset-summary" data-public={chosenPreset.isPublic ? "true" : "false"} data-max={chosenPreset.maxMembers} data-slow={chosenPreset.slowModeSeconds}>
                      {chosenPreset.hint}
                    </small>
                  ) : null}
                  <div className="actions">
                    <button type="submit" className="btn btn-primary" data-testid="lobby-create">{text.create}</button>
                  </div>
                </form>
                <form className="tile join" onSubmit={(event) => { if (!session) { event.preventDefault(); go("/auth"); return; } void joinRoom(event); }}>
                  <div className="tile-head">
                    <span className="tile-ic"><Icon name="key" /></span>
                    <div><h3>{text.join}</h3><p>{text.joinHint}</p></div>
                  </div>
                  <label>
                    Код комнаты
                    <CodeInput value={code} onChange={setCode} slots={8} />
                  </label>
                  <div className="actions">
                    <button type="submit" className="btn btn-social" data-testid="lobby-join">{text.enter}</button>
                  </div>
                </form>
              </div>
            )}
            <div className="sec">
              <h3>{text.rooms}</h3>
              <div className="chips">
                {(["all", "friends", "film", "music"] as const).map((item) => (
                  <button key={item} type="button" className={filter === item ? "pill on" : "pill"} onClick={() => setFilter(item)}>{text[item]}</button>
                ))}
              </div>
            </div>
            <LiveRoomsCarousel
              rooms={shownRooms}
              onCreate={() => go(session ? "/create" : "/auth")}
              onOpen={(item) => {
                if (!session) {
                  go("/auth");
                  return;
                }
                void api.joinRoom(session.accessToken, item.code).then((result) => onOpen(result.room.id));
              }}
            />
          </main>
          <aside className="side">
            <section className="card">
              <h3>Друзья онлайн <span>{friends.filter((row) => row.roomId).length}</span></h3>
              {session ? <form onSubmit={(event) => { event.preventDefault(); const data = new FormData(event.currentTarget); const q = String(data.get("q") ?? ""); if (!session || !q) return; void fetch(`${apiUrl}/users/search?q=${encodeURIComponent(q)}`, { headers: { authorization: `Bearer ${session.accessToken}` } }).then((response) => response.json()).then((payload: { users?: Array<{ id: string; displayName: string }> }) => setPeople(payload.users ?? [])); }}>
                <input data-testid="friend-search" name="q" placeholder="Найти человека" aria-label="Поиск друзей" />
                <button type="submit" data-testid="friend-search-go">Найти</button>
              </form> : null}
              {people.map((person) => <p key={person.id} className="friend-result" data-testid="friend-result"><span>{person.displayName}</span><span className="mini">Найден</span></p>)}
              {friends.length > 0 ? friends.map((row) => (
                <div className="fr" key={row.id}>
                  <span className={`av lg p-${personHue(row.userId)}`}>{initials(row.displayName)}</span>
                  <div><div className={`n p-${personHue(row.userId)}`}>{row.displayName}</div><small>{row.roomTitle ?? "не в комнате"}</small></div>
                  <button type="button" className="mini" onClick={() => void fetch(`${apiUrl}/friends/${row.id}`, { method: "DELETE", headers: { authorization: `Bearer ${session?.accessToken ?? ""}` } })}>Убрать</button>
                </div>
              )) : <p className="empty-note">{session ? "Пока никого нет в сети. Найдите друга по имени выше." : "Войдите, чтобы видеть друзей и их комнаты."}</p>}
            </section>
            <section className="card">
              <div className="lvl"><div className="mark">{level}</div><div><b>{text.level} {level}</b><small>Опыт растёт за сеансы, чат и голос</small></div></div>
              <div className="actions" style={{ marginTop: 10 }}><button type="button" className="btn btn-ghost" onClick={() => go("/profile")}>Открыть профиль</button></div>
            </section>
            <section className="card">
              <h3>Напоминания <span>{reminders.length}</span></h3>
              {reminders.length > 0 ? reminders.slice(0, 3).map((note) => (
                <div className="ev" key={note.id}><div className="d">lume<b>·</b></div><div><div className="t">{note.title}</div><div className="h">{note.body}</div></div></div>
              )) : <p className="empty-note">Нет напоминаний.</p>}
            </section>
            <section className="card heat-wrap heat-compact" aria-label={text.season}>
              <div className="heat-top"><h3>{text.season}</h3></div>
              {heat.some((cell) => cell.score > 0) ? (
                <div className="heat-grid">{heat.slice(-119).map((cell) => <i key={cell.day} className={cell.score > 3 ? "a3" : cell.score > 0 ? "a1" : ""} />)}</div>
              ) : (
                <p className="empty-note">Проведите первый сеанс — здесь появится карта сезона.</p>
              )}
            </section>
          </aside>
        </div>
      ) : null}
      {view !== "home" && view !== "room" ? (
        <Page title={view} onClose={() => go("/")}>
          {view === "search" ? (
            <form onSubmit={(event) => { event.preventDefault(); void fetch(`${apiUrl}/video/search?q=${encodeURIComponent(query)}`).then((r) => r.json()).then((p: { results?: Array<{ title: string; url: string }> }) => setFound(p.results ?? [])); }}>
              <input className="inbox" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={text.search} />
              <div className="results">{found.map((item) => <button key={item.url} type="button" className="res" onClick={() => go("/")}><b>{item.title || item.url}</b></button>)}</div>
            </form>
          ) : null}
          {view === "create" ? <CreateScreen title={title} onTitle={setTitle} preset={preset} onPreset={setPreset} onSubmit={(event) => void createRoom(event)} onCancel={() => go("/")} /> : null}
          {view === "join" ? <JoinScreen code={code} onCode={setCode} onSubmit={(event) => void joinRoom(event)} onCancel={() => go("/")} /> : null}
          {view === "settings" ? <SettingsScreen style={style} mode={mode} onStyle={(next) => void saveAppearance(next, mode)} onMode={(next) => void saveAppearance(style, next)} token={session?.accessToken} apiUrl={apiUrl} blocked={blocked} onUnblock={(id) => { setBlocked((rows) => rows.filter((row) => row.id !== id)); if (!session) return; void fetch(`${apiUrl}/friends/${id}`, { method: "DELETE", headers: { authorization: `Bearer ${session.accessToken}` } }); }} globalBans={globalBans} onRemoveGlobalBan={(bannedUserId) => { if (!session) return; const previous = globalBans; setGlobalBans((rows) => rows.filter((row) => row.userId !== bannedUserId)); void fetch(`${apiUrl}/users/${session.user.id}/blacklist/remove`, { method: "POST", headers: { authorization: `Bearer ${session.accessToken}`, "content-type": "application/json" }, body: JSON.stringify({ bannedUserId }) }).then((response) => { if (!response.ok) setGlobalBans(previous); }).catch(() => setGlobalBans(previous)); }} /> : null}
          {view === "profile" ? (session ? <ProfileScreen token={session.accessToken} apiUrl={apiUrl} userId={session.user.id} displayName={session.user.displayName} /> : <EmptyScreen title="Профиль" body="Войдите, чтобы увидеть свои достижения, историю, друзей и статистику." action={<button type="button" className="btn btn-primary" onClick={() => go("/auth")}>Войти</button>} />) : null}
          {view === "premium" ? <PremiumScreen /> : null}
          {view === "notifications" ? <NotificationsScreen items={notes} /> : null}
          {view === "onboarding" ? <OnboardingScreen onDone={() => { window.localStorage.setItem("lume-onboarded", "1"); go("/"); }} /> : null}
          {view === "auth" ? (
            <AuthScreen name={name} onName={setName} onTelegram={() => void signIn({ preventDefault() {} } as FormEvent)} onEmail={(event) => { event.preventDefault(); void fetch(`${apiUrl}/auth/magic-link`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: name }) }); }} onRegister={(event) => {
              event.preventDefault();
              const data = new FormData(event.currentTarget);
              void fetch(`${apiUrl}/auth/register`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: name, password: String(data.get("password") ?? ""), displayName: String(data.get("displayName") ?? name) }) })
                .then((response) => response.json())
                .then((payload: { accessToken?: string; refreshToken?: string; user?: { id: string; displayName: string } }) => {
                  if (payload.accessToken && payload.user) {
                    onSession({
                      accessToken: payload.accessToken,
                      ...(payload.refreshToken ? { refreshToken: payload.refreshToken } : {}),
                      user: { id: payload.user.id, displayName: payload.user.displayName, telegramId: null, username: null, locale: "ru", themeId: "ember" },
                    });
                  }
                });
            }} />
          ) : null}
          {view === "missing" ? <EmptyScreen title="Комната не найдена" body="Такого кода нет или сеанс уже закончился. Проверьте приглашение или создайте свою." action={<><button type="button" className="btn btn-outline" onClick={() => go("/")}>На главную</button><button type="button" className="btn btn-primary" onClick={() => go("/create")}>Создать комнату</button></>} /> : null}
          {view === "offline" ? <EmptyScreen title="Нет соединения" body="Похоже, вы офлайн. Проверьте сеть — комната дождётся, когда вы вернётесь." action={<button type="button" className="btn btn-primary" onClick={() => window.location.reload()}>Повторить</button>} /> : null}
          {view === "members" ? null : null}
          {view === "room-settings" ? (
            <RoomSettingsScreen token={session?.accessToken} apiUrl={apiUrl} roomId={roomId} />
          ) : null}
          {view === "queue" ? null : null}
        </Page>
      ) : null}
      {narrow && view !== "room" ? (
        <nav className="tabbar" aria-label="Основная навигация">
          <button type="button" className={view === "home" ? "on" : ""} onClick={() => go("/")}><span className="tab-ic">⌂</span>Главная</button>
          <button type="button" className={view === "search" ? "on" : ""} onClick={() => go("/search")}><span className="tab-ic">⌕</span>Поиск</button>
          <button type="button" className={view === "notifications" ? "on" : ""} onClick={() => go("/notifications")}><span className="tab-ic">◔</span>События</button>
          <button type="button" className={view === "profile" ? "on" : ""} onClick={() => go("/profile")}><span className="tab-ic">☺</span>Я</button>
        </nav>
      ) : null}
      {style === "gruvbox" ? (
        <footer className="status">
          <span className="sl-mode">{view.toUpperCase()}</span>
          <span className="sl-file">lume/{view}</span>
          <span className="sl-mid">{error ?? ice ?? ""}</span>
          <span className="sl-keys"><b>:</b>{view}</span>
        </footer>
      ) : null}
      {error ? <p className="tr-note">{error}</p> : null}
    </div>
  );
}

function RoomPreview({ unavailable = false, onGo }: { unavailable?: boolean; onGo: (path: string) => void }) {
  return (
    <div className="wrap screen-scroll">
      <main>
        <EmptyScreen
          title={unavailable ? "Видео недоступно" : "Комната не выбрана"}
          body={unavailable
            ? "Источник не отвечает. Откройте комнату заново или замените ссылку в очереди."
            : "Откройте комнату из списка или войдите по коду — здесь появятся её сцена, чат и очередь."}
          action={<button type="button" className="btn btn-primary" onClick={() => onGo("/")}>На главную</button>}
        />
      </main>
    </div>
  );
}

function Page({ title, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return <div className="screen-fill" data-page={title}>{children}</div>;
}

function Icon({ name }: { name: "search" | "bell" | "sun" | "moon" | "plus" | "key" | "user" }) {
  const path = {
    search: "M11 11l4 4M7.5 11a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7z",
    bell: "M12 20a2 2 0 0 0 2-2H10a2 2 0 0 0 2 2zm6-5V10a6 6 0 1 0-12 0v5l-2 2h16z",
    sun: "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zm0-4v2m0 12v2M4 12H2m20 0h-2M5 5l1.5 1.5M17.5 17.5 19 19M19 5l-1.5 1.5M6.5 17.5 5 19",
    moon: "M16 14.5A6.5 6.5 0 0 1 9.5 4 6.5 6.5 0 1 0 16 14.5z",
    plus: "M12 5v14M5 12h14",
    key: "M14 8a4 4 0 1 0-3.2 6.4L8 17v2H6v2H4v-2.8l6.1-6.1A4 4 0 0 0 14 8z",
    user: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm-7 8a7 7 0 0 1 14 0",
  }[name];
  return (
    <svg className={`icon icon-${name}`} viewBox="0 0 24 24" aria-hidden="true">
      <path d={path} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function LiveRoomsCarousel({
  rooms,
  onCreate,
  onOpen,
}: {
  rooms: Array<{ id: string; title: string; code: string; memberCount?: number }>;
  onCreate: () => void;
  onOpen: (room: { id: string; title: string; code: string; memberCount?: number }) => void;
}) {
  const track = useRef<HTMLDivElement>(null);
  const scroll = (direction: -1 | 1) => {
    track.current?.scrollBy({ left: direction * 320, behavior: "smooth" });
  };
  if (rooms.length === 0) {
    return (
      <div className="livestream-empty">
        <div>Открытых комнат пока нет. Создайте свою — друзья подтянутся.</div>
        <button type="button" className="btn btn-outline" onClick={onCreate}>Создать комнату</button>
      </div>
    );
  }
  return (
    <div className="live-carousel" data-testid="live-carousel">
      <div className="carousel-track" ref={track}>
        {rooms.map((item) => (
          <button
            key={item.id}
            type="button"
            className="rc"
            data-testid="carousel-room"
            data-code={item.code}
            onClick={() => onOpen(item)}
          >
            <div className="th">
              <span className="tag"><i className="d" />{item.memberCount && item.memberCount > 0 ? `${item.memberCount} ${viewersWord(item.memberCount)}` : "открыта"}</span>
            </div>
            <div className="bd">
              <b>{item.title}</b>
              <div className="meta">
                <span className="viewers"><i />{(item.memberCount ?? 0) > 0 ? `${item.memberCount} в комнате` : "ждёт гостей"}</span>
                <span className="code">{item.code}</span>
              </div>
            </div>
          </button>
        ))}
      </div>
      {rooms.length > 1 ? (
        <div className="carousel-nav">
          <button type="button" data-testid="carousel-prev" onClick={() => scroll(-1)} aria-label="Предыдущие комнаты">‹</button>
          <button type="button" data-testid="carousel-next" onClick={() => scroll(1)} aria-label="Следующие комнаты">›</button>
        </div>
      ) : null}
    </div>
  );
}

function GruvboxHome({
  session,
  rooms,
  heat,
  resume,
  name,
  onName,
  onSignIn,
  onGo,
  code,
  onCode,
  onJoin,
  onOpen,
}: {
  session: ClientSession | null;
  rooms: Array<{ id: string; title: string; code: string; memberCount?: number }>;
  heat: Array<{ day: string; score: number }>;
  resume: string | null;
  name: string;
  onName: (value: string) => void;
  onSignIn: (event: FormEvent) => void;
  onGo: (path: string) => void;
  code: string;
  onCode: (value: string) => void;
  onJoin: (event: FormEvent) => void;
  onOpen: (room: { id: string; title: string; code: string; memberCount?: number }) => void;
}) {
  const rows = rooms.slice(0, 7);
  return (
    <div className="g-home wrap">
      <section className="pane">
        <div className="pt">#сессии <span className="dim">{rows.length}</span></div>
        {rows.length === 0 ? <p className="lead">Открытых комнат пока нет.</p> : rows.map((item, index) => (
          <button key={item.id} type="button" className={index === 0 ? "srow on" : "srow"} onClick={() => onOpen(item)}>
            <span>{index === 0 ? ">" : " "}</span>
            <b>{item.title}</b>
            <span>{item.memberCount ?? "--"}</span>
            <span>{item.memberCount ? "live" : item.code}</span>
          </button>
        ))}
      </section>
      <section className="pane">
        <div className="pt">~продолжить</div>
        <h2>{resume ?? "Пока нечего продолжать"}</h2>
        <p>Ваши последние комнаты появятся здесь.</p>
        <button type="button" className="go" onClick={() => onGo("/profile")}>Профиль</button>
      </section>
      <section className="pane">
        <div className="pt">:new</div>
        <h3>создать комнату</h3>
        <p>Название, пресет модерации и приглашение друзьям.</p>
        <button type="button" className="go" onClick={() => onGo(session ? "/create" : "/auth")}>Открыть мастер</button>
      </section>
      <section className="pane">
        <div className="pt">:join</div>
        <h3>войти по коду</h3>
        <form onSubmit={onJoin}>
          <input data-testid="lobby-code" className="mono" value={code} onChange={(event) => onCode(event.target.value)} placeholder="a7psyqm9" maxLength={12} aria-label="Код комнаты" />
          <button type="submit" className="go" data-testid="lobby-join">Войти</button>
        </form>
      </section>
      {!session ? (
        <section className="pane">
          <div className="pt">:login</div>
          <form onSubmit={onSignIn}>
            <label>Как вас представить<input data-testid="lobby-name" value={name} onChange={(event) => onName(event.target.value)} placeholder="Имя" /></label>
            <button type="submit" className="go" data-testid="lobby-sign-in">Войти</button>
          </form>
        </section>
      ) : (
        <section className="pane">
          <div className="pt">#сезон</div>
          {heat.length > 0 ? <div className="heat-grid">{heat.slice(-49).map((cell) => <i key={cell.day} className={cell.score > 3 ? "a3" : cell.score > 0 ? "a1" : ""} />)}</div> : <p className="lead">Проведите первый сеанс — здесь появится карта сезона.</p>}
        </section>
      )}
      <section className="pane">
        <div className="pt">#афиша</div>
        <p>{rows[0] ? `${rows[0].title} · ${rows[0].memberCount ?? 0}` : "Пока пусто"}</p>
        <p className="dim">Открытые комнаты обновляются каждые 30 секунд.</p>
      </section>
    </div>
  );
}

function GruvboxBar({ view, onGo, text }: { view: View; onGo: (path: string) => void; text: ReturnType<typeof copy> }) {
  const tabs: Array<[View | "home", string]> = [["home", "home"], ["search", "search"], ["room", "room"], ["profile", "profile"]];
  return (
    <div className="tabline">
      <span className="brand"><i className="dot" />LUME</span>
      <div className="bufs">
        {tabs.map(([id, label], index) => (
          <button key={id} type="button" className={view === id || (id === "home" && view === "home") ? "buf on" : "buf"} onClick={() => onGo(id === "home" ? "/" : `/${id}`)}>
            <span className="nr">{index + 1}</span>{label}
          </button>
        ))}
      </div>
      <label className="search-lg"><input aria-label={text.search} placeholder={text.search} onFocus={() => onGo("/search")} /></label>
    </div>
  );
}
