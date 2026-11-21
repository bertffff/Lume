import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { Bell, House, KeyRound, Moon, Plus, Search, Sun, UserRound } from "lucide-react";
import { AppShell } from "../shell/AppShell.js";
import { detectSource, formatRoomCode, parseRoomCode, roomPresets, type RoomPresetId } from "@lume/contracts";
import { api, apiUrl, ClientError } from "../api/client.js";
import { useI18n } from "../i18n/context.js";
import type { ClientSession } from "../session.js";
import { copy } from "./copy.js";
import { AuthScreen, EmptyScreen, JoinScreen, MobileHome, OnboardingScreen, PremiumScreen, ProfileScreen, SettingsScreen } from "./pages.js";
import { RoomCodeInput } from "./RoomCodeInput.js";
import { initials, isStyleId, isThemeMode, personHue } from "./theme.js";
import { NotificationInboxPage, NotificationInboxPopover, type NotificationInboxProps } from "./NotificationInbox.js";
import { useNotificationFeed } from "./useNotificationFeed.js";
import { RoomFeed, type RoomFeedLoader, type RoomFeedRoom } from "./RoomFeed.js";
import { AppearanceControls } from "./AppearanceControls.js";
import { CreateRoomWizard, type CreateRoomWizardLabels, type CreateRoomWizardSubmission } from "./CreateRoomWizard.js";
import { RoomAppearanceContext } from "./room-appearance.js";
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

import { posterClasses, shotHeat, shotPeople, shotRooms } from "./shot-fixtures.js";

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
  if (code === "rate_limited") return "auth.error.rateLimited";
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
  joiningInvite,
  onJoinNeedsAuth,
  onOpen,
  onLeave,
  room,
}: {
  session: ClientSession | null;
  onSession: (session: ClientSession) => void;
  onSignOut: () => void;
  roomId: string | null;
  joiningInvite: boolean;
  onJoinNeedsAuth: (code: string) => void;
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
  const [code, setCode] = useState("");
  const [codeInvalid, setCodeInvalid] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [rooms, setRooms] = useState<Array<{ id: string; title: string; code: string; memberCount?: number }>>([]);
  const [friendFeed, setFriendFeed] = useState<{ ownerId: string; items: Awaited<ReturnType<typeof api.friends>>["friends"] }>();
  const friends = friendFeed && friendFeed.ownerId === session?.user.id ? friendFeed.items : [];
  const [blocked, setBlocked] = useState<Array<{ id: string; displayName: string }>>([]);
  const [globalBans, setGlobalBans] = useState<Array<{ id: string; userId: string; displayName: string; reason: string | null }>>([]);
  const notifications = useNotificationFeed(session?.accessToken);
  const notes = notifications.feed?.notifications ?? [];
  const [heat, setHeat] = useState<Array<{ day: string; score: number }>>([]);
  const [level, setLevel] = useState(1);
  const [resumeFeed, setResumeFeed] = useState<{ ownerId: string; card: Awaited<ReturnType<typeof api.resume>>["resume"] }>();
  const resume = resumeFeed && resumeFeed.ownerId === session?.user.id ? resumeFeed.card : null;
  const [resuming, setResuming] = useState(false);
  const [invitee, setInvitee] = useState<string | null>(null);
  const [friendCatalog, setFriendCatalog] = useState(0);
  const [searchTab, setSearchTab] = useState<"all" | "youtube" | "vk" | "rutube" | "direct">("all");
  const [narrow, setNarrow] = useState(() => window.innerWidth < 800);
  useEffect(() => {
    const onResize = () => setNarrow(window.innerWidth < 800);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  const [query, setQuery] = useState("");
  const [found, setFound] = useState<Array<{ title: string; url: string }>>([]);
  const [people, setPeople] = useState<Array<{ id: string; displayName: string }>>([]);
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

  useEffect(() => {
    if (shot) {
      setRooms(shotRooms);
      return;
    }
    void api.listRooms(query).then((payload) => setRooms(payload.rooms)).catch(() => setRooms([]));
  }, [query, path, roomId, shot]);

  useEffect(() => {
    if (!session) return;
    let current = true;
    void api.friends(session.accessToken).then((list) => {
      if (!current) return;
      setFriendFeed({ ownerId: session.user.id, items: list.friends });
      setBlocked(list.blocked ?? []);
    }).catch(() => undefined);
    void api.resume(session.accessToken).then((card) => {
      if (current) setResumeFeed({ ownerId: session.user.id, card: card.resume });
    }).catch(() => { if (current) setResumeFeed(undefined); });
    void fetch(`${apiUrl}/me/studio`, { headers: { authorization: `Bearer ${session.accessToken}` } })
      .then((response) => response.json())
      .then((payload: { level?: number; heatmap?: Array<{ day: string; score: number }> }) => {
        if (typeof payload.level === "number") setLevel(payload.level);
        if (Array.isArray(payload.heatmap)) setHeat(payload.heatmap);
      })
      .catch(() => undefined);
    void fetch(`${apiUrl}/me`, { headers: { authorization: `Bearer ${session.accessToken}` } })
      .then((response) => response.json())
      .then((payload: { uiStyle?: unknown; uiMode?: unknown }) => {
        if (isStyleId(payload.uiStyle)) setStyle(payload.uiStyle);
        if (isThemeMode(payload.uiMode)) setMode(payload.uiMode);
      })
      .catch(() => undefined);
    return () => { current = false; };
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
    setInvitee(null);
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

  async function createRoom({ initialVideoUrl, ...setup }: CreateRoomWizardSubmission) {
    if (!session) {
      go("/auth");
      return { error: t("auth.signInFirst") };
    }
    setError(null);
    try {
      const result = await api.createRoom(session.accessToken, setup);
      if (initialVideoUrl) {
        try { await api.addRoomVideo(session.accessToken, result.room.id, initialVideoUrl); }
        catch { setNotice(t("create.videoNotAdded")); }
      }
      if (invitee) {
        try { await api.inviteFriend(session.accessToken, result.room.id, invitee); }
        catch { setNotice(t("home.inviteFailed")); }
        setInvitee(null);
      }
      onOpen(result.room.id);
      go("/");
    } catch (caught) {
      return { error: caught instanceof ClientError ? t(roomErrorKey(caught.code)) : t("room.createFailed") };
    }
  }

  function updateCode(value: string) {
    setCode(value);
    setCodeInvalid(false);
  }

  async function openResume() {
    if (!session || !resume || resuming) return;
    setResuming(true);
    try { onOpen((await api.resumeRoom(session.accessToken)).room.id); }
    catch { setError(t("resume.openFailed")); }
    finally { setResuming(false); }
  }

  async function joinRoom(event: FormEvent) {
    event.preventDefault();
    const value = parseRoomCode(code);
    if (!value) {
      setCodeInvalid(true);
      return;
    }
    if (!session) {
      updateCode("");
      onJoinNeedsAuth(value);
      return;
    }
    setError(null);
    try {
      const result = await api.joinRoom(session.accessToken, value);
      updateCode("");
      onOpen(result.room.id);
      go("/");
    } catch (caught) {
      setError(caught instanceof ClientError ? (caught.code === "not_found" ? t("room.error.notFound") : t("room.joinFailed")) : t("room.joinFailed"));
    }
  }

  const view: View = shot && views.has(shot as View) ? (shot as View) : offline ? "offline" : roomId ? "room" : joiningInvite ? "join" : viewFromPath(path);
  useEffect(() => {
    if (!webApp) return;
    if (view === "home" || view === "room" || view === "auth") {
      webApp.BackButton?.hide();
      return;
    }
    return bindBackButton(webApp, () => go("/"));
  }, [webApp, view]);
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
    if (q && !roomItem.title.toLowerCase().includes(q) && !roomItem.code.includes(q) && !formatRoomCode(roomItem.code).toLowerCase().includes(q)) return false;
    return true;
  });

  const formatter = new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" });
  const inbox: NotificationInboxProps = {
    unreadCount: notifications.feed?.unread ?? null,
    status: notifications.phase,
    markingAllRead: notifications.marking === null,
    mutationError: notifications.failedMutation ? t("inbox.markError") : null,
    icon: <Icon name="bell" />,
    items: notes.map((row) => {
      const date = new Date(row.createdAt);
      return {
        ...row,
        markingRead: notifications.marking === row.id,
        timestamp: Number.isFinite(date.getTime()) ? { dateTime: row.createdAt, label: formatter.format(date) } : null,
        ...(row.target === "/profile" ? { action: { label: t("inbox.openProfile"), onSelect: () => go("/profile") } } : {}),
      };
    }),
    labels: {
      title: text.notifications, unreadCount: (count) => t("inbox.count", { count }), read: t("inbox.read"),
      unread: t("inbox.unread"), markRead: t("inbox.mark"), markAllRead: t("inbox.markAll"), empty: t("inbox.empty"),
      loading: t("inbox.loading"), error: t("inbox.error"), retry: t("common.retry"),
    },
    onMarkRead: (id) => void notifications.mark(id),
    onMarkAllRead: () => void notifications.mark(null),
    onRetry: () => void notifications.reload(),
  };
  const navActions = <>
    <NotificationInboxPopover {...inbox} viewAllLabel={t("feed.all")} onOpenAll={() => go("/notifications")} />
    <button type="button" className="theme-btn" onClick={() => void saveAppearance(style, document.documentElement.dataset.theme === "dark" ? "light" : "dark")} aria-label={text.mode}><Icon name="sun" /><Icon name="moon" /></button>
  </>;
  const loadCatalog: RoomFeedLoader = async (selectedFilter, cursor, signal) => {
    if (shot) {
      const categories = ["film", "music", "vlog"] as const;
      const preview = shotRooms.map<RoomFeedRoom>((item, index) => ({ ...item, category: categories[index % categories.length] ?? "other", isFull: false }));
      return { rooms: preview.filter((item) => selectedFilter === "all" || selectedFilter === item.category), nextCursor: null };
    }
    return api.roomCatalog(selectedFilter, cursor, signal, session?.accessToken);
  };
  const openCatalogRoom = (item: Pick<RoomFeedRoom, "code">) => {
    if (!session) { go("/auth"); return; }
    void api.joinRoom(session.accessToken, item.code)
      .then((result) => onOpen(result.room.id))
      .catch((caught: unknown) => setError(caught instanceof ClientError ? t(roomErrorKey(caught.code)) : t("room.createFailed")));
  };
  const openFriendRoom = (target: string) => {
    const visibleRoom = rooms.find((item) => item.id === target);
    if (visibleRoom) { openCatalogRoom(visibleRoom); return; }
    setFriendCatalog((current) => current + 1);
    requestAnimationFrame(() => document.getElementById("public-rooms")?.scrollIntoView({ block: "start" }));
  };
  const inviteToNewRoom = (userId: string) => { go("/create"); setInvitee(userId); };
  const catalog = <RoomFeed id="public-rooms" key={`${session?.user.id ?? "guest"}:${friendCatalog}`} initialFilter={friendCatalog ? "friends" : "all"}
    style={style} signedIn={Boolean(session)} loadPage={loadCatalog} onOpenRoom={openCatalogRoom} onSignIn={() => go("/auth")} />;
  const resumeContent = <div className="c">
    <div className="eyebrow">{text.resume}</div>
    <h2>{resume?.title ?? text.empty}</h2>
    <div className="sub">{resume ? t("room.resumeHint") : t("room.resumeEmptyHint")}</div>
    {resume?.positionMs != null && resume.durationMs != null && resume.durationMs > 0 ? (
      <progress aria-label={t("resume.progress")} max={resume.durationMs} value={Math.min(resume.positionMs, resume.durationMs)} />
    ) : null}
  </div>;
  const resumeTile = resume ? <button type="button" className="tile resume" disabled={resuming} onClick={() => void openResume()}
    style={resume.posterUrl ? { backgroundImage: `linear-gradient(0deg, var(--bg), transparent), url(${JSON.stringify(resume.posterUrl)})` } : undefined}>
    {resumeContent}
  </button> : <section className="tile resume">{resumeContent}</section>;
  const homeVisible = view === "home" || view === "create";
  const wizardLabels: CreateRoomWizardLabels = {
    steps: { video: t("create.stepVideo"), access: t("create.stepAccess"), rights: t("create.stepRights") },
    presetOptions: Object.fromEntries(roomPresets.map((item) => [item.id, { name: item.title, hint: item.hint }])) as Record<RoomPresetId, { name: string; hint: string }>,
    videoUrl: t("create.initialVideo"), category: t("create.category"),
    categories: { auto: t("create.categoryAuto"), film: t("feed.film"), music: t("feed.music"), vlog: t("feed.vlog"), other: t("feed.other") },
    invalidTitle: t("create.invalidTitle"), invalidVideoUrl: t("create.invalidVideo"),
  };

  return (
    <AppShell className={narrow ? "is-narrow session-hub" : "session-hub"} view={view} style={style} header={
      view === "room" || view === "auth" ? null : style === "gruvbox" ? <GruvboxBar view={view} onGo={go} text={text} actions={navActions} /> : (
        <nav className="nav">
          <button type="button" className="logo" onClick={() => { onLeave(); go("/"); }}><i />lume</button>
          <label className="search-lg">
            <Icon name="search" />
            <input aria-label={text.search} placeholder={text.search} value={query} onChange={(event) => setQuery(event.target.value)} onFocus={() => go("/search")} />
            <span className="kbd">/</span>
          </label>
          <div className="nav-actions">
            {navActions}
            <button type="button" className="me" onClick={() => go("/profile")}>
              <span className="av p-me">{initials(session?.user.displayName ?? "?")}</span>
              <span className="nm p-me">{session?.user.displayName ?? text.signIn}</span>
            </button>
          </div>
        </nav>
      )}>
      {view === "room" && roomId ? (
        <RoomAppearanceContext.Provider value={{ style, mode, onStyle: (next) => void saveAppearance(next, mode), onMode: (next) => void saveAppearance(style, next) }}>
          {room}
        </RoomAppearanceContext.Provider>
      ) : null}
      {(view === "room" || view === "unavailable") && !roomId ? (
        <RoomPreview unavailable={view === "unavailable"} onGo={go} />
      ) : null}
      {homeVisible && style === "gruvbox" ? (
        <GruvboxHome
          session={session}
          rooms={shownRooms}
          heat={shot ? shotHeat : heat}
          resume={resume?.title ?? (shot ? shotRooms[0]?.title ?? null : null)}
          onResume={resume ? () => void openResume() : undefined}
          catalog={catalog}
          friends={friends}
          onJoinFriend={openFriendRoom}
          onInviteFriend={inviteToNewRoom}
          isShot={Boolean(shot)}
          name={name}
          onName={setName}
          onSignIn={(event) => void signIn(event)}
          onGo={go}
          code={code}
          codeInvalid={codeInvalid}
          onCode={updateCode}
          onJoin={(event) => void joinRoom(event)}
          onOpen={(item) => { if (!session) { go("/auth"); return; } void api.joinRoom(session.accessToken, item.code).then((result) => onOpen(result.room.id)); }}
        />
      ) : null}
      {homeVisible && narrow && style !== "gruvbox" ? (
        <MobileHome
          catalog={catalog}
          continueTile={session ? resumeTile : null}
          storyPeople={shot ? shotPeople : friends.map((person) => ({ id: person.userId, name: person.displayName }))}
          session={session}
          name={name}
          onName={setName}
          onSignIn={(event) => void signIn(event)}
          onTelegram={() => void signIn({ preventDefault() {} } as FormEvent)}
          onCreate={() => go(session ? "/create" : "/auth")}
          onProfile={() => go("/profile")}
          code={code}
          codeInvalid={codeInvalid}
          onCode={updateCode}
          onJoin={(event) => void joinRoom(event)}
        />
      ) : null}
      {(homeVisible || view === "onboarding") && style !== "gruvbox" && !narrow ? (
        <div className={style === "telerave" ? "wrap screen-scroll legacy-home" : "wrap screen-scroll"}>
          <main>
            <div className="home-hero">
              <div className="greet">
                <h1>{text.evening}{session ? `, ${session.user.displayName}` : ""}</h1>
                <p className="sub">{session ? t("home.subtitleSigned") : t("home.subtitleGuest")}</p>
              </div>
            </div>
            <div className="stories" aria-label={t("home.stories")}>
              <button type="button" className="st new" onClick={() => go(session ? "/create" : "/auth")}>
                <span className="ring"><span className="face"><Plus size={18} aria-hidden="true" /></span></span>
                <span className="nm">{t("home.storyMine")}</span>
              </button>
              {(shot
                ? shotPeople
                : friends.slice(0, 4).map((row) => ({ id: row.userId, name: row.displayName }))
              ).map((person) => (
                <button key={person.id} type="button" className="st" onClick={() => go("/profile")}>
                  <span className="ring"><span className={`face av p-${personHue(person.id)}`}>{initials(person.name)}</span></span>
                  <span className="nm">{person.name.split(" ")[0]}</span>
                </button>
              ))}
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
                <form className="tile join" onSubmit={(event) => void joinRoom(event)}>
                  <div className="tile-head">
                    <span className="tile-ic"><Icon name="key" /></span>
                    <div><h3>{text.join}</h3><p>{text.joinHint}</p></div>
                  </div>
                  <RoomCodeInput value={code} onChange={updateCode} invalid={codeInvalid} />
                  <div className="actions">
                    <button type="submit" className="btn btn-social" data-testid="lobby-join">{text.enter}</button>
                  </div>
                </form>
              </div>
            ) : (
              <div className="acts">
                {resumeTile}
                <button type="button" className="tile create promo" data-testid="home-create-open" onClick={() => go("/create")}>
                  <span className="promo-plus"><Icon name="plus" /></span>
                  <h3>{text.create}</h3><p>{text.createHint}</p>
                </button>
                <form className="tile join" onSubmit={(event) => void joinRoom(event)}>
                  <div className="tile-head">
                    <span className="tile-ic"><Icon name="key" /></span>
                    <div><h3>{text.join}</h3><p>{text.joinHint}</p></div>
                  </div>
                  <RoomCodeInput value={code} onChange={updateCode} invalid={codeInvalid} />
                  <div className="actions">
                    <button type="submit" className="btn btn-social" data-testid="lobby-join">{text.enter}</button>
                  </div>
                </form>
              </div>
            )}
            {catalog}
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
                  <div className="fr-actions">
                    {row.roomId ? (
                      <button type="button" className="mini go" onClick={() => { if (row.roomId) openFriendRoom(row.roomId); }}>{t("home.enterRoom")}</button>
                    ) : (
                      <button type="button" className="mini" onClick={() => inviteToNewRoom(row.userId)}>{t("room.invite")}</button>
                    )}
                    <button type="button" className="mini ghost" aria-label={t("home.remove")} onClick={() => void fetch(`${apiUrl}/friends/${row.id}`, { method: "DELETE", headers: { authorization: `Bearer ${session?.accessToken ?? ""}` } }).catch(() => undefined)}>×</button>
                  </div>
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
            <div className="search-page">
              <div className="search-panel">
                <header className="search-head">
                  <h2>{t("search.title")}</h2>
                  <form
                    onSubmit={(event) => {
                      event.preventDefault();
                      void fetch(`${apiUrl}/video/search?q=${encodeURIComponent(query)}`)
                        .then((response) => response.json())
                        .then((payload: { results?: Array<{ title: string; url: string }> }) => setFound(payload.results ?? []))
                        .catch(() => setFound([]));
                    }}
                  >
                    <input className="inbox" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t("search.placeholder")} aria-label={t("search.placeholder")} autoFocus />
                    <button type="submit" className="btn btn-primary">{t("profile.search")}</button>
                  </form>
                </header>
                <div className="search-tabs" role="tablist" aria-label={t("search.sources")}>
                  {(["all", "youtube", "vk", "rutube", "direct"] as const).map((tab) => (
                    <button key={tab} type="button" role="tab" aria-selected={searchTab === tab} className={searchTab === tab ? "pill on" : "pill"} onClick={() => setSearchTab(tab)}>
                      {t(`search.source.${tab}`)}
                    </button>
                  ))}
                </div>
                {found.length === 0 ? (
                  <p className="empty-note">{t("search.empty")}</p>
                ) : (
                  <div className="search-grid">
                    {found
                      .filter((item) => searchTab === "all" || (detectSource(item.url)?.id ?? "direct") === searchTab)
                      .map((item, index) => (
                        <article key={item.url} className="search-card">
                          <div className={`th ${posterClasses[index % posterClasses.length]}`} />
                          <div className="bd">
                            <b>{item.title || item.url}</b>
                            <small>{detectSource(item.url)?.id ?? t("search.source.direct")}</small>
                            <div className="actions">
                              <button type="button" className="btn btn-primary" onClick={() => window.open(item.url, "_blank", "noopener")}>{t("search.play")}</button>
                              <button type="button" className="btn btn-outline" onClick={() => void navigator.clipboard?.writeText(item.url)}>{t("search.copy")}</button>
                            </div>
                          </div>
                        </article>
                      ))}
                  </div>
                )}
                <form
                  className="search-direct"
                  onSubmit={(event) => {
                    event.preventDefault();
                    const url = String(new FormData(event.currentTarget).get("url") ?? "").trim();
                    if (!url) return;
                    window.open(url, "_blank", "noopener");
                  }}
                >
                  <input name="url" placeholder={t("search.directPlaceholder")} aria-label={t("search.directPlaceholder")} />
                  <button type="submit" className="btn btn-outline">{t("search.open")}</button>
                </form>
              </div>
            </div>
          ) : null}
           {view === "create" ? <CreateRoomWizard open labels={wizardLabels} onSubmit={createRoom} onClose={() => { setInvitee(null); go("/"); }} /> : null}
          {view === "join" ? (joiningInvite && !shot
            ? <EmptyScreen title={t("join.connecting")} />
            : <JoinScreen code={code} codeInvalid={codeInvalid} onCode={updateCode} onSubmit={(event) => void joinRoom(event)} onCancel={() => go("/")} />) : null}
          {view === "settings" ? <SettingsScreen style={style} mode={mode} onStyle={(next) => void saveAppearance(next, mode)} onMode={(next) => void saveAppearance(style, next)} token={session?.accessToken} apiUrl={apiUrl} blocked={blocked} onUnblock={(id) => { setBlocked((rows) => rows.filter((row) => row.id !== id)); if (!session) return; void fetch(`${apiUrl}/friends/${id}`, { method: "DELETE", headers: { authorization: `Bearer ${session.accessToken}` } }).catch(() => undefined); }} globalBans={globalBans} onRemoveGlobalBan={(bannedUserId) => { if (!session) return; const previous = globalBans; setGlobalBans((rows) => rows.filter((row) => row.userId !== bannedUserId)); void fetch(`${apiUrl}/users/${session.user.id}/blacklist/remove`, { method: "POST", headers: { authorization: `Bearer ${session.accessToken}`, "content-type": "application/json" }, body: JSON.stringify({ bannedUserId }) }).then((response) => { if (!response.ok) setGlobalBans(previous); }).catch(() => setGlobalBans(previous)); }} /> : null}
           {view === "profile" ? (session ? <ProfileScreen token={session.accessToken} apiUrl={apiUrl} userId={session.user.id} displayName={session.user.displayName} appearance={<AppearanceControls style={style} mode={mode} onStyle={(next) => void saveAppearance(next, mode)} onMode={(next) => void saveAppearance(style, next)} />} /> : <EmptyScreen title={t("profile.signInTitle")} body={t("profile.signInBody")} action={<button type="button" className="btn btn-primary" onClick={() => go("/auth")}>{t("auth.login")}</button>} />) : null}
          {view === "premium" ? <PremiumScreen /> : null}
          {view === "notifications" ? <NotificationInboxPage {...inbox} /> : null}
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
          {view === "missing" ? <EmptyScreen title={t("empty.notFoundTitle")} body={t("empty.notFoundBody")} action={<><button type="button" className="btn btn-outline" onClick={() => go("/")}>{t("empty.home")}</button><button type="button" className="btn btn-primary" onClick={() => { updateCode(""); go("/join"); }}>{t("empty.tryRoomCode")}</button></>} /> : null}
          {view === "offline" ? <EmptyScreen title={t("empty.offlineTitle")} body={t("empty.offlineBody")} action={<button type="button" className="btn btn-primary" onClick={() => window.location.reload()}>{t("common.retry")}</button>} /> : null}
        </Page>
      ) : null}
      {narrow && view !== "room" ? (
        <nav className="tabbar" aria-label={t("nav.main")}>
          <button type="button" className={view === "home" ? "on" : ""} onClick={() => go("/")}><House className="tab-ic" size={18} aria-hidden="true" />{t("nav.home")}</button>
          <button type="button" className={view === "search" ? "on" : ""} onClick={() => go("/search")}><Search className="tab-ic" size={18} aria-hidden="true" />{t("nav.search")}</button>
          <button type="button" className={view === "notifications" ? "on" : ""} onClick={() => go("/notifications")}><Bell className="tab-ic" size={18} aria-hidden="true" />{t("nav.events")}</button>
          <button type="button" className={view === "profile" ? "on" : ""} onClick={() => go("/profile")}><UserRound className="tab-ic" size={18} aria-hidden="true" />{t("nav.me")}</button>
        </nav>
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

const icons = { search: Search, bell: Bell, sun: Sun, moon: Moon, plus: Plus, key: KeyRound, user: UserRound } as const;

function Icon({ name }: { name: keyof typeof icons }) {
  const Glyph = icons[name];
  return <Glyph className={`icon icon-${name}`} aria-hidden="true" strokeWidth={1.8} />;
}

function GruvboxHome({
  session,
  rooms,
  heat,
  resume,
  onResume,
  isShot,
  name,
  onName,
  onSignIn,
  onGo,
  code,
  codeInvalid,
  onCode,
  onJoin,
  onOpen,
  catalog,
  friends,
  onJoinFriend,
  onInviteFriend,
}: {
  session: ClientSession | null;
  rooms: Array<{ id: string; title: string; code: string; memberCount?: number }>;
  heat: Array<{ day: string; score: number }>;
  resume: string | null;
  onResume?: () => void;
  isShot: boolean;
  name: string;
  onName: (value: string) => void;
  onSignIn: (event: FormEvent) => void;
  onGo: (path: string) => void;
  code: string;
  codeInvalid: boolean;
  onCode: (value: string) => void;
  onJoin: (event: FormEvent) => void;
  onOpen: (room: { id: string; title: string; code: string; memberCount?: number }) => void;
  catalog: ReactNode;
  friends: Array<{ id: string; userId: string; displayName: string; roomId?: string | null; roomTitle?: string | null }>;
  onJoinFriend: (roomId: string) => void;
  onInviteFriend: (friendId: string) => void;
}) {
  const { t } = useI18n();
  const rows = rooms.slice(0, 7);
  return (
    <div className="g-home wrap">
      <section className="pane">
        <div className="pt">{t("sessions.title")} <span className="dim">{rows.length}</span></div>
        {rows.length === 0 ? <p className="lead">{t("home.noRooms")}</p> : rows.map((item, index) => (
          <button key={item.id} type="button" className={index === 0 ? "srow on" : "srow"} onClick={() => onOpen(item)}>
            <span className={`g-th ${posterClasses[index % posterClasses.length]}`} aria-hidden="true" />
            <b>{item.title}</b>
            <span className="mono">{item.memberCount ?? 0} live</span>
            <span className="mono dim">{formatRoomCode(item.code)}</span>
          </button>
        ))}
      </section>
      <section className="pane">
        <div className="pt">{t("gruvbox.resume")}</div>
        <h2>{resume ?? t("resume.empty")}</h2>
        <p className="dim">{isShot ? t("gruvbox.resumeMeta") : t("gruvbox.resumeHint")}</p>
        {isShot ? <p className="dim">{t("gruvbox.resumeMetaTwo")}</p> : null}
        {onResume ? <button type="button" className="go" onClick={onResume}>{t("gruvbox.enterRoom")}</button> : null}
      </section>
      <section className="pane">
        <div className="pt">{t("gruvbox.new")}</div>
        <h3>{t("gruvbox.newTitle")}</h3>
        <p>{t("gruvbox.newBody")}</p>
        <button type="button" className="go" data-testid="home-create-open" onClick={() => onGo(session ? "/create" : "/auth")}>{t("gruvbox.newAction")}</button>
      </section>
      <section className="pane">
        <div className="pt">{t("gruvbox.join")}</div>
        <h3>{t("gruvbox.joinTitle")}</h3>
        <form onSubmit={onJoin}>
          <RoomCodeInput value={code} onChange={onCode} invalid={codeInvalid} />
          <button type="submit" className="go" data-testid="lobby-join">{t("auth.login")}</button>
        </form>
      </section>
      <section className="pane">
        <div className="pt">{t("gruvbox.season")}</div>
        {isShot ? <p className="dim">{t("gruvbox.seasonMeta")}</p> : null}
        {heat.length > 0 ? <div className="heat-grid">{heat.slice(-49).map((cell) => <i key={cell.day} className={cell.score > 3 ? "a3" : cell.score > 0 ? "a1" : ""} />)}</div> : <p className="lead">{t("gruvbox.seasonEmpty")}</p>}
      </section>
      {!session ? (
        <section className="pane">
          <div className="pt">{t("gruvbox.login")}</div>
          <form onSubmit={onSignIn}>
            <label>{t("gruvbox.nameLabel")}<input data-testid="lobby-name" value={name} onChange={(event) => onName(event.target.value)} placeholder={t("name.placeholder")} /></label>
            <button type="submit" className="go" data-testid="lobby-sign-in">{t("auth.login")}</button>
          </form>
        </section>
      ) : null}
      <section className="pane">
        {catalog}
        <p className="dim">{t("gruvbox.billHint")}</p>
      </section>
      <section className="pane">
        <div className="pt">{t("gruvbox.friends")}</div>
        {isShot ? shotPeople.map((person) => (
          <div key={person.id} className="g-friend">
            <span className={`av p-${personHue(person.id)}`}>{initials(person.name)}</span>
            <b>{person.name}</b>
            <span className="dim">{t("gruvbox.inRoom")}</span>
          </div>
        )) : friends.length ? friends.map((person) => (
          <div key={person.id} className="g-friend">
            <span className={`av p-${personHue(person.userId)}`}>{initials(person.displayName)}</span>
            <b>{person.displayName}</b><span className="dim">{person.roomTitle ?? t("home.notInRoom")}</span>
            {person.roomId ? <button type="button" className="go" onClick={() => { if (person.roomId) onJoinFriend(person.roomId); }}>{t("gruvbox.enter")}</button>
              : <button type="button" className="go" onClick={() => onInviteFriend(person.userId)}>{t("room.invite")}</button>}
          </div>
        )) : <p className="lead">{t("profile.noFriends")}</p>}
      </section>
    </div>
  );
}

function GruvboxBar({ view, onGo, text, actions }: { view: View; onGo: (path: string) => void; text: ReturnType<typeof copy>; actions: ReactNode }) {
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
      <div className="nav-actions">{actions}</div>
    </div>
  );
}
