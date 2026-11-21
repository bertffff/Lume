import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { AppShell } from "../shell/AppShell.js";
import { roomPresetById, roomPresets, type RoomPresetId } from "@lume/contracts";
import { api, apiUrl, ClientError } from "../api/client.js";
import { useI18n } from "../i18n/context.js";
import type { ClientSession } from "../session.js";
import { copy, viewersWord } from "./copy.js";
import { AuthScreen, CodeInput, CreateScreen, EmptyScreen, JoinScreen, MobileHome, NotificationsScreen, OnboardingScreen, PremiumScreen, ProfileScreen, SettingsScreen } from "./pages.js";
import { initials, personHue, type ModeId, type StyleId } from "./theme.js";
import type { MessageKey } from "../i18n/ru.js";
import { useAppearance } from "./useAppearance.js";
import { bindBackButton } from "../telegram/adapter.js";
import { readTelegramWebApp } from "../telegram/types.js";
import { useGlobalStats } from "./useGlobalStats.js";

type View =
  | "home"
  | "room"
  | "search"
  | "create"
  | "join"
  | "settings"
  | "profile"
  | "premium"
  | "auth"
  | "onboarding"
  | "notifications"
  | "missing"
  | "offline"
  | "unavailable";

import { shotRooms } from "./shot-fixtures.js";
import { roomFilters } from "./copy.js";

const views = new Set<View>([
  "home", "room", "search", "create", "join", "settings",
  "profile", "premium", "auth", "onboarding", "notifications", "missing", "offline", "unavailable",
]);

function viewFromPath(path: string): View {
  const name = path.replace(/^\//, "").split("/")[0] ?? "";
  return views.has(name as View) ? (name as View) : "home";
}

function signInErrorKey(code: string): MessageKey {
  if (code === "unauthorized") return "auth.error.unauthorized";
  if (code === "jwt_unconfigured") return "auth.error.jwt";
  if (code === "rate_limited") return "auth.error.rateLimited";
  if (code === "invalid_body") return "auth.error.invalidBody";
  return "auth.error.generic";
}

function roomErrorKey(code: string): MessageKey {
  if (code === "room_full") return "room.error.full";
  if (code === "not_found") return "room.error.notFound";
  if (code === "unauthorized") return "room.error.expired";
  if (code === "invalid_body") return "room.error.invalidBody";
  if (code === "conflict") return "room.error.conflict";
  return "room.error.generic";
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
  const { locale, t } = useI18n();
  const text = copy(locale);
  const [path, setPath] = useState(() => window.location.pathname);
  const [shot] = useState(() => new URLSearchParams(window.location.search).get("shot"));
  const webApp = useMemo(() => readTelegramWebApp(), []);
  const { style, mode, setStyle, setMode, saveAppearance } = useAppearance(session);
  const [name, setName] = useState("");
  const [title, setTitle] = useState("");
  const [preset, setPreset] = useState<RoomPresetId | null>(null);
  const [code, setCode] = useState(() => {
    const match = window.location.pathname.match(/^\/join\/([^/]+)/);
    return match?.[1] ? decodeURIComponent(match[1]) : "";
  });
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const creatingRef = useRef(false);
  const [rooms, setRooms] = useState<Array<{ id: string; title: string; code: string; memberCount?: number }>>([]);
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
  const { globalStats, statsReady } = useGlobalStats(shot, path, roomId);

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
    if (shot) {
      setRooms(shotRooms);
      return;
    }
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
  }, [query, path, roomId, accessToken, shot]);

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
  }, [session, setMode, setStyle]);

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
      const result = await api.devLogin(name.trim() || t("auth.guest"));
      onSession({ accessToken: result.accessToken, ...(result.refreshToken ? { refreshToken: result.refreshToken } : {}), user: result.user });
    } catch (caught) {
      setError(caught instanceof ClientError ? t(signInErrorKey(caught.code)) : t("auth.error.generic"));
    }
  }

  async function createRoom(event: FormEvent) {
    event.preventDefault();
    if (creatingRef.current) return;
    if (!session) {
      setError(t("auth.signInFirst"));
      go("/auth");
      return;
    }
    creatingRef.current = true;
    setCreating(true);
    setError(null);
    try {
      const chosen = preset ? roomPresetById(preset) : null;
      const result = await api.createRoom(
        session.accessToken,
        title.trim() || chosen?.title || t("room.defaultTitle"),
        chosen?.isPublic ?? true,
        preset ?? undefined,
      );
      onOpen(result.room.id);
      go("/");
    } catch (caught) {
      setError(caught instanceof ClientError ? t(roomErrorKey(caught.code)) : t("room.createFailed"));
    } finally {
      creatingRef.current = false;
      setCreating(false);
    }
  }

  async function joinRoom(event: FormEvent) {
    event.preventDefault();
    if (!session) {
      setError(t("auth.joinFirst"));
      go("/auth");
      return;
    }
    const value = code.trim();
    if (!value) {
      setError(t("room.joinCodeNeeded"));
      return;
    }
    setError(null);
    try {
      const result = await api.joinRoom(session.accessToken, value);
      onOpen(result.room.id);
      go("/");
    } catch (caught) {
      setError(caught instanceof ClientError ? (caught.code === "not_found" ? t("room.error.notFound") : t("room.joinFailed")) : t("room.joinFailed"));
    }
  }

  const view: View = shot && views.has(shot as View) ? (shot as View) : offline ? "offline" : roomId ? "room" : viewFromPath(path);
  useEffect(() => {
    if (!webApp) return;
    if (view === "home" || view === "room" || view === "auth") {
      webApp.BackButton?.hide();
      return;
    }
    return bindBackButton(webApp, () => go("/"));
  }, [webApp, view]);
  const chosenPreset = preset ? roomPresetById(preset) : null;
  const reminders = notes.filter((note) => note.kind === "SYSTEM");
  useEffect(() => {
    if (view !== "create" && view !== "join" && view !== "onboarding") return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") go("/");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });
  const shownRooms = rooms.filter((roomItem) => {
    const q = query.trim().toLowerCase();
    if (q && !roomItem.title.toLowerCase().includes(q) && !roomItem.code.includes(q)) return false;
    if (filter === "film") return roomFilters.film.test(roomItem.title);
    if (filter === "music") return roomFilters.music.test(roomItem.title);
    return true;
  });

  return (
    <AppShell className={narrow ? "is-narrow session-hub" : "session-hub"} view={view}>
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
      {(view === "room" || view === "unavailable") && !roomId ? (
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
                <p className="sub">{session ? t("home.subtitleSigned") : t("home.subtitleGuest")}</p>
              </div>
            </div>
            <section className="global-stats" data-testid="global-stats" data-ready={statsReady ? "true" : "false"}>
              <div className="stat"><small>{t("stats.online")}</small><b data-testid="stat-users-online" data-value={globalStats.usersOnline}>{globalStats.usersOnline}</b></div>
              <div className="stat"><small>{t("stats.activeRooms")}</small><b data-testid="stat-active-rooms" data-value={globalStats.activeRooms}>{globalStats.activeRooms}</b></div>
              <div className="stat"><small>{t("stats.videos")}</small><b data-testid="stat-total-videos" data-value={globalStats.totalVideos}>{globalStats.totalVideos}</b></div>
              <div className="stat"><small>{t("stats.hours")}</small><b data-testid="stat-watch-hours" data-value={globalStats.totalWatchHours}>{globalStats.totalWatchHours}</b></div>
            </section>
            {!session ? (
              <div className="acts">
                <form className="tile auth" onSubmit={(event) => void signIn(event)}>
                  <div className="tile-head">
                    <span className="tile-ic"><Icon name="user" /></span>
                    <div><h3>{t("home.authTitle")}</h3><p>{t("home.authBody")}</p></div>
                  </div>
                  <label>
                    {t("home.nameLabel")}
                    <input data-testid="lobby-name" value={name} onChange={(event) => setName(event.target.value)} placeholder={t("home.namePlaceholder")} autoComplete="nickname" />
                  </label>
                  <div className="actions">
                    <button type="submit" className="btn btn-primary" data-testid="lobby-sign-in">{t("auth.login")}</button>
                    <button type="button" className="btn btn-telegram" onClick={() => void signIn({ preventDefault() {} } as FormEvent)}>{text.telegram}</button>
                  </div>
                </form>
                <div className="tile create">
                  <div className="tile-head">
                    <span className="tile-ic"><Icon name="plus" /></span>
                    <div><h3>{text.create}</h3><p>{text.createHint}</p></div>
                  </div>
                  <p>{t("home.createBody")}</p>
                  <div className="actions">
                    <button type="button" className="btn btn-primary" data-testid="home-create-open" onClick={() => go("/auth")}>{t("gruvbox.newAction")}</button>
                    <span className="hint">{t("home.signInFirst")}</span>
                  </div>
                </div>
                <form className="tile join" onSubmit={(event) => { event.preventDefault(); if (!session) { go("/auth"); return; } void joinRoom(event); }}>
                  <div className="tile-head">
                    <span className="tile-ic"><Icon name="key" /></span>
                    <div><h3>{text.join}</h3><p>{text.joinHint}</p></div>
                  </div>
                  <label>
                    {t("join.codeLabel")}
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
                    <div className="sub">{resume ? t("room.resumeHint") : t("room.resumeEmptyHint")}</div>
                  </div>
                </button>
                <form className="tile create" onSubmit={(event) => void createRoom(event)}>
                  <div className="tile-head">
                    <span className="tile-ic"><Icon name="plus" /></span>
                    <div><h3>{text.create}</h3><p>{text.createHint}</p></div>
                  </div>
                  <input data-testid="lobby-title" value={title} onChange={(event) => setTitle(event.target.value)} placeholder={t("home.roomNamePlaceholder")} aria-label={t("home.roomNamePlaceholder")} />
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
                    <button type="submit" className="btn btn-primary" data-testid="lobby-create" disabled={creating}>{creating ? t("create.creating") : text.create}</button>
                  </div>
                </form>
                <form className="tile join" onSubmit={(event) => { if (!session) { event.preventDefault(); go("/auth"); return; } void joinRoom(event); }}>
                  <div className="tile-head">
                    <span className="tile-ic"><Icon name="key" /></span>
                    <div><h3>{text.join}</h3><p>{text.joinHint}</p></div>
                  </div>
                  <label>
                    {t("join.codeLabel")}
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
              <h3>{t("home.friendsOnline")} <span>{friends.filter((row) => row.roomId).length}</span></h3>
              {session ? <form onSubmit={(event) => { event.preventDefault(); const data = new FormData(event.currentTarget); const q = String(data.get("q") ?? ""); if (!session || !q) return; void fetch(`${apiUrl}/users/search?q=${encodeURIComponent(q)}`, { headers: { authorization: `Bearer ${session.accessToken}` } }).then((response) => response.json()).then((payload: { users?: Array<{ id: string; displayName: string }> }) => setPeople(payload.users ?? [])).catch(() => setPeople([])); }}>
                <input data-testid="friend-search" name="q" placeholder={t("home.friendSearch")} aria-label={t("profile.searchPeopleAria")} />
                <button type="submit" data-testid="friend-search-go">{t("home.find")}</button>
              </form> : null}
              {people.map((person) => <p key={person.id} className="friend-result" data-testid="friend-result"><span>{person.displayName}</span><span className="mini">{t("home.found")}</span></p>)}
              {friends.length > 0 ? friends.map((row) => (
                <div className="fr" key={row.id}>
                  <span className={`av lg p-${personHue(row.userId)}`}>{initials(row.displayName)}</span>
                  <div><div className={`n p-${personHue(row.userId)}`}>{row.displayName}</div><small>{row.roomTitle ?? t("home.notInRoom")}</small></div>
                  <button type="button" className="mini" onClick={() => void fetch(`${apiUrl}/friends/${row.id}`, { method: "DELETE", headers: { authorization: `Bearer ${session?.accessToken ?? ""}` } }).catch(() => undefined)}>{t("home.remove")}</button>
                </div>
              )) : <p className="empty-note">{session ? t("home.noFriendsOnline") : t("home.signInForFriends")}</p>}
            </section>
            <section className="card">
              <div className="lvl"><div className="mark">{level}</div><div><b>{text.level} {level}</b><small>{t("home.xpHint")}</small></div></div>
              <div className="actions" style={{ marginTop: 10 }}><button type="button" className="btn btn-ghost" onClick={() => go("/profile")}>{t("home.openProfile")}</button></div>
            </section>
            <section className="card">
              <h3>{t("home.reminders")} <span>{reminders.length}</span></h3>
              {reminders.length > 0 ? reminders.slice(0, 3).map((note) => (
                <div className="ev" key={note.id}><div className="d">lume<b>·</b></div><div><div className="t">{note.title}</div><div className="h">{note.body}</div></div></div>
              )) : <p className="empty-note">{t("home.noReminders")}</p>}
            </section>
            <section className="card heat-wrap heat-compact" aria-label={text.season}>
              <div className="heat-top"><h3>{text.season}</h3></div>
              {heat.some((cell) => cell.score > 0) ? (
                <div className="heat-grid">{heat.slice(-119).map((cell) => <i key={cell.day} className={cell.score > 3 ? "a3" : cell.score > 0 ? "a1" : ""} />)}</div>
              ) : (
                <p className="empty-note">{t("gruvbox.seasonEmpty")}</p>
              )}
            </section>
          </aside>
        </div>
      ) : null}
      {view !== "home" && view !== "room" ? (
        <Page title={view} onClose={() => go("/")}>
          {view === "search" ? (
            <form onSubmit={(event) => { event.preventDefault(); void fetch(`${apiUrl}/video/search?q=${encodeURIComponent(query)}`).then((r) => r.json()).then((p: { results?: Array<{ title: string; url: string }> }) => setFound(p.results ?? [])).catch(() => setFound([])); }}>
              <input className="inbox" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={text.search} />
              <div className="results">{found.map((item) => <button key={item.url} type="button" className="res" onClick={() => window.open(item.url, "_blank", "noopener")}><b>{item.title || item.url}</b><small>{item.url}</small></button>)}</div>
            </form>
          ) : null}
          {view === "create" ? <CreateScreen title={title} onTitle={setTitle} preset={preset} onPreset={setPreset} onSubmit={(event) => void createRoom(event)} onCancel={() => go("/")} busy={creating} /> : null}
          {view === "join" ? <JoinScreen code={code} onCode={setCode} onSubmit={(event) => void joinRoom(event)} onCancel={() => go("/")} /> : null}
          {view === "settings" ? <SettingsScreen style={style} mode={mode} onStyle={(next) => void saveAppearance(next, mode)} onMode={(next) => void saveAppearance(style, next)} token={session?.accessToken} apiUrl={apiUrl} blocked={blocked} onUnblock={(id) => { setBlocked((rows) => rows.filter((row) => row.id !== id)); if (!session) return; void fetch(`${apiUrl}/friends/${id}`, { method: "DELETE", headers: { authorization: `Bearer ${session.accessToken}` } }).catch(() => undefined); }} globalBans={globalBans} onRemoveGlobalBan={(bannedUserId) => { if (!session) return; const previous = globalBans; setGlobalBans((rows) => rows.filter((row) => row.userId !== bannedUserId)); void fetch(`${apiUrl}/users/${session.user.id}/blacklist/remove`, { method: "POST", headers: { authorization: `Bearer ${session.accessToken}`, "content-type": "application/json" }, body: JSON.stringify({ bannedUserId }) }).then((response) => { if (!response.ok) setGlobalBans(previous); }).catch(() => setGlobalBans(previous)); }} /> : null}
          {view === "profile" ? (session ? <ProfileScreen token={session.accessToken} apiUrl={apiUrl} userId={session.user.id} displayName={session.user.displayName} /> : <EmptyScreen title={t("profile.signInTitle")} body={t("profile.signInBody")} action={<button type="button" className="btn btn-primary" onClick={() => go("/auth")}>{t("auth.login")}</button>} />) : null}
          {view === "premium" ? <PremiumScreen /> : null}
          {view === "notifications" ? <NotificationsScreen items={notes} /> : null}
          {view === "onboarding" ? <OnboardingScreen onDone={() => { window.localStorage.setItem("lume-onboarded", "1"); go("/"); }} /> : null}
          {view === "auth" ? (
            <AuthScreen name={name} onName={setName} onTelegram={() => void signIn({ preventDefault() {} } as FormEvent)} onEmail={(event) => { event.preventDefault(); void fetch(`${apiUrl}/auth/magic-link`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: name }) }).then(() => setNotice(t("auth.magicSent"))).catch(() => setError(t("auth.magicFailed"))); }} onRegister={(event) => {
              event.preventDefault();
              const data = new FormData(event.currentTarget);
              void fetch(`${apiUrl}/auth/register`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: name, password: String(data.get("password") ?? ""), displayName: String(data.get("displayName") ?? name) }) })
                .then((response) => response.json())
                .catch(() => setError(t("auth.registerFailed")))
                .then((payload: { accessToken?: string; refreshToken?: string; user?: { id: string; displayName: string } } | undefined) => {
                  if (payload?.accessToken && payload.user) {
                    onSession({
                      accessToken: payload.accessToken,
                      ...(payload.refreshToken ? { refreshToken: payload.refreshToken } : {}),
                      user: { id: payload.user.id, displayName: payload.user.displayName, telegramId: null, username: null, locale: "ru", themeId: "ember" },
                    });
                  }
                });
            }} />
          ) : null}
          {view === "missing" ? <EmptyScreen title={t("empty.notFoundTitle")} body={t("empty.notFoundBody")} action={<><button type="button" className="btn btn-outline" onClick={() => go("/")}>{t("empty.home")}</button><button type="button" className="btn btn-primary" onClick={() => go("/create")}>{t("create.submit")}</button></>} /> : null}
          {view === "offline" ? <EmptyScreen title={t("empty.offlineTitle")} body={t("empty.offlineBody")} action={<button type="button" className="btn btn-primary" onClick={() => window.location.reload()}>{t("common.retry")}</button>} /> : null}
        </Page>
      ) : null}
      {narrow && view !== "room" ? (
        <nav className="tabbar" aria-label={t("nav.main")}>
          <button type="button" className={view === "home" ? "on" : ""} onClick={() => go("/")}><span className="tab-ic">⌂</span>{t("nav.home")}</button>
          <button type="button" className={view === "search" ? "on" : ""} onClick={() => go("/search")}><span className="tab-ic">⌕</span>{t("nav.search")}</button>
          <button type="button" className={view === "notifications" ? "on" : ""} onClick={() => go("/notifications")}><span className="tab-ic">◔</span>{t("nav.events")}</button>
          <button type="button" className={view === "profile" ? "on" : ""} onClick={() => go("/profile")}><span className="tab-ic">☺</span>{t("nav.me")}</button>
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
      {error ? <p className="app-note">{error}</p> : null}
      {notice ? <p className="app-note">{notice}</p> : null}
    </AppShell>
  );
}

function RoomPreview({ unavailable = false, onGo }: { unavailable?: boolean; onGo: (path: string) => void }) {
  const { t } = useI18n();
  return (
    <div className="wrap screen-scroll">
      <main>
        <EmptyScreen
          title={unavailable ? t("room.previewUnavailable") : t("room.previewNone")}
          body={unavailable
            ? t("room.previewUnavailableBody")
            : t("room.previewNoneBody")}
          action={<button type="button" className="btn btn-primary" onClick={() => onGo("/")}>{t("empty.home")}</button>}
        />
      </main>
    </div>
  );
}

function Page({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const { t } = useI18n();
  return (
    <div className="screen-fill" data-page={title}>
      <div className="page-head">
        <button type="button" className="page-back" onClick={onClose} aria-label={t("page.back")}>{t("page.backShort")}</button>
      </div>
      {children}
    </div>
  );
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
  const { t } = useI18n();
  const track = useRef<HTMLDivElement>(null);
  const scroll = (direction: -1 | 1) => {
    track.current?.scrollBy({ left: direction * 320, behavior: "smooth" });
  };
  if (rooms.length === 0) {
    return (
      <div className="livestream-empty">
        <div>{t("home.noRoomsFriends")}</div>
        <button type="button" className="btn btn-outline" onClick={onCreate}>{t("create.submit")}</button>
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
              <span className="tag"><i className="d" />{item.memberCount && item.memberCount > 0 ? `${item.memberCount} ${viewersWord(item.memberCount)}` : t("room.openTag")}</span>
            </div>
            <div className="bd">
              <b>{item.title}</b>
              <div className="meta">
                <span className="viewers"><i />{(item.memberCount ?? 0) > 0 ? t("mobile.memberCount", { count: item.memberCount ?? 0 }) : t("room.waitingGuests")}</span>
                <span className="code">{item.code}</span>
              </div>
            </div>
          </button>
        ))}
      </div>
      {rooms.length > 1 ? (
        <div className="carousel-nav">
          <button type="button" data-testid="carousel-prev" onClick={() => scroll(-1)} aria-label={t("carousel.prev")}>‹</button>
          <button type="button" data-testid="carousel-next" onClick={() => scroll(1)} aria-label={t("carousel.next")}>›</button>
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
  const { t } = useI18n();
  const rows = rooms.slice(0, 7);
  return (
    <div className="g-home wrap">
      <section className="pane">
        <div className="pt">{t("sessions.title")} <span className="dim">{rows.length}</span></div>
        {rows.length === 0 ? <p className="lead">{t("home.noRooms")}</p> : rows.map((item, index) => (
          <button key={item.id} type="button" className={index === 0 ? "srow on" : "srow"} onClick={() => onOpen(item)}>
            <span>{index === 0 ? ">" : " "}</span>
            <b>{item.title}</b>
            <span>{item.memberCount ?? "--"}</span>
            <span>{item.memberCount ? "live" : item.code}</span>
          </button>
        ))}
      </section>
      <section className="pane">
        <div className="pt">{t("gruvbox.resume")}</div>
        <h2>{resume ?? t("resume.empty")}</h2>
        <p>{t("gruvbox.resumeHint")}</p>
        <button type="button" className="go" onClick={() => onGo("/profile")}>{t("profile.signInTitle")}</button>
      </section>
      <section className="pane">
        <div className="pt">{t("gruvbox.new")}</div>
        <h3>{t("gruvbox.newTitle")}</h3>
        <p>{t("gruvbox.newBody")}</p>
        <button type="button" className="go" onClick={() => onGo(session ? "/create" : "/auth")}>{t("gruvbox.newAction")}</button>
      </section>
      <section className="pane">
        <div className="pt">{t("gruvbox.join")}</div>
        <h3>{t("gruvbox.joinTitle")}</h3>
        <form onSubmit={onJoin}>
          <input data-testid="lobby-code" className="mono" value={code} onChange={(event) => onCode(event.target.value)} placeholder={t("code.placeholder")} maxLength={12} aria-label={t("join.codePlaceholder")} />
          <button type="submit" className="go" data-testid="lobby-join">{t("auth.login")}</button>
        </form>
      </section>
      {!session ? (
        <section className="pane">
          <div className="pt">{t("gruvbox.login")}</div>
          <form onSubmit={onSignIn}>
            <label>{t("gruvbox.nameLabel")}<input data-testid="lobby-name" value={name} onChange={(event) => onName(event.target.value)} placeholder={t("name.placeholder")} /></label>
            <button type="submit" className="go" data-testid="lobby-sign-in">{t("auth.login")}</button>
          </form>
        </section>
      ) : (
        <section className="pane">
          <div className="pt">{t("gruvbox.season")}</div>
          {heat.length > 0 ? <div className="heat-grid">{heat.slice(-49).map((cell) => <i key={cell.day} className={cell.score > 3 ? "a3" : cell.score > 0 ? "a1" : ""} />)}</div> : <p className="lead">{t("gruvbox.seasonEmpty")}</p>}
        </section>
      )}
      <section className="pane">
        <div className="pt">{t("gruvbox.bill")}</div>
        <p>{rows[0] ? `${rows[0].title} · ${rows[0].memberCount ?? 0}` : t("sessions.empty")}</p>
        <p className="dim">{t("gruvbox.billHint")}</p>
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
