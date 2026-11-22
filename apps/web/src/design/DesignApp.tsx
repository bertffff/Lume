import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { AppShell } from "../shell/AppShell.js";
import { AppHeader } from "../shell/AppHeader.js";
import { BottomNav } from "../shell/BottomNav.js";
import { HomeScreen } from "../screens/home/HomeScreen.js";
import type { HomeFriend, HomeProps, HomeResume } from "../screens/home/types.js";
import { dayPartOf } from "../screens/home/greeting.js";
import { pickSplash, splashes } from "../i18n/splashes.js";
import { formatRoomCode, parseRoomCode, roomPresets, type RoomPresetId } from "@lume/contracts";
import { api, apiUrl, ClientError } from "../api/client.js";
import { useI18n } from "../i18n/context.js";
import type { ClientSession } from "../session.js";
import { copy } from "./copy.js";
import { SearchScreen } from "../screens/search/SearchScreen.js";
import { AuthScreen } from "../screens/entry/AuthScreen.js";
import { EmptyScreen } from "../screens/entry/EmptyScreen.js";
import { JoinScreen } from "../screens/entry/JoinScreen.js";
import { OnboardingScreen } from "../screens/entry/OnboardingScreen.js";
import { PremiumScreen } from "../screens/entry/PremiumScreen.js";
import { SettingsScreen } from "../screens/settings/SettingsScreen.js";
import { ProfileScreen } from "../screens/profile/ProfileScreen.js";
import { isStyleId, isThemeMode } from "./theme.js";
import { NotificationInboxPage, NotificationInboxPopover, type NotificationInboxProps } from "../screens/notifications/NotificationInbox.js";
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

export type View =
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

import { shotHeat, shotPeople, shotRooms } from "./shot-fixtures.js";

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

import { Icon, Page, RoomPreview } from "./chrome.js";
import { GruvboxBar } from "./GruvboxHome.js";
import { GruvboxHome } from "../screens/gruvbox/GruvboxHome.js";

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
  // One greeting and one splash per visit: re-renders must not reshuffle them.
  const [visitHour] = useState(() => new Date().getHours());
  const [visitSplash] = useState(() => pickSplash(locale, dayPartOf(new Date().getHours()), (session?.user.displayName ?? "").split(/\s+/)[0] ?? ""));
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
  const [narrow, setNarrow] = useState(() => window.innerWidth < 800);
  useEffect(() => {
    const onResize = () => setNarrow(window.innerWidth < 800);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  const [query, setQuery] = useState("");
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
      if (view === "auth" && !window.sessionStorage.getItem("lume-pending-room")) go("/");
    } catch (caught) {
      setError(caught instanceof ClientError ? t(signInErrorKey(caught.code)) : t("auth.error.generic"));
    }
  }

  async function emailSignIn(event: FormEvent, password: string) {
    event.preventDefault();
    const email = name.trim();
    if (!email.includes("@")) {
      await signIn(event);
      return;
    }
    if (!password) {
      try {
        const response = await fetch(`${apiUrl}/auth/magic-link`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email }) });
        if (!response.ok) throw new Error("magic_link_failed");
        setNotice(t("auth.magicSent"));
      } catch {
        setError(t("auth.magicFailed"));
      }
      return;
    }
    try {
      const response = await fetch(`${apiUrl}/auth/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, password }) });
      const payload = (await response.json().catch(() => ({}))) as { accessToken?: string; refreshToken?: string; user?: { id: string; displayName: string } };
      if (!response.ok || !payload.accessToken || !payload.user) {
        setError(t(response.status === 429 ? "auth.error.rateLimited" : "auth.error.unauthorized"));
        return;
      }
      onSession({
        accessToken: payload.accessToken,
        ...(payload.refreshToken ? { refreshToken: payload.refreshToken } : {}),
        user: { id: payload.user.id, displayName: payload.user.displayName, telegramId: null, username: null, locale: "ru", themeId: "ember" },
      });
      if (!window.sessionStorage.getItem("lume-pending-room")) go("/");
    } catch {
      setError(t("auth.error.generic"));
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
  const homeFriends: HomeFriend[] = shot
    ? shotPeople.map((person, index) => ({ id: person.id, userId: person.id, displayName: person.name, roomId: index < 2 ? (shotRooms[index]?.id ?? null) : null, roomTitle: index < 2 ? (shotRooms[index]?.title ?? null) : null }))
    : friends;
  const homeResume: HomeResume | null = resume
    ? { title: resume.title, positionMs: resume.positionMs, durationMs: resume.durationMs, posterUrl: resume.posterUrl }
    : shot ? { title: shotRooms[0]?.title ?? "", positionMs: 4_364_000, durationMs: 7_390_000, posterUrl: null } : null;
  const homeProps: HomeProps = {
    displayName: session?.user.displayName ?? null,
    hour: shot ? 20 : visitHour,
    splash: shot ? (splashes[locale][0]?.text ?? null) : visitSplash,
    friends: homeFriends,
    resume: homeResume,
    resuming,
    onResume: () => void openResume(),
    catalog,
    level,
    heat: shot ? shotHeat : heat,
    reminders: reminders.map((note) => ({ id: note.id, title: note.title, body: note.body })),
    stats: globalStats,
    statsReady,
    guest: { name, onName: setName, onSignIn: (event) => void signIn(event), onTelegram: () => void signIn({ preventDefault() {} } as FormEvent) },
    join: { code, invalid: codeInvalid, onCode: updateCode, onSubmit: (event) => void joinRoom(event) },
    people,
    onSearchPeople: (value) => {
      if (!session) return;
      void fetch(`${apiUrl}/users/search?q=${encodeURIComponent(value)}`, { headers: { authorization: `Bearer ${session.accessToken}` } })
        .then((response) => response.json())
        .then((payload: { users?: Array<{ id: string; displayName: string }> }) => setPeople(payload.users ?? []))
        .catch(() => setPeople([]));
    },
    onCreate: () => go(session ? "/create" : "/auth"),
    onGo: go,
    onJoinFriend: openFriendRoom,
    onInviteFriend: inviteToNewRoom,
    onRemoveFriend: (friendshipId) => {
      setFriendFeed((current) => current && { ...current, items: current.items.filter((row) => row.id !== friendshipId) });
      void fetch(`${apiUrl}/friends/${friendshipId}`, { method: "DELETE", headers: { authorization: `Bearer ${session?.accessToken ?? ""}` } }).catch(() => undefined);
    },
  };
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
        <AppHeader
          searchLabel={text.search}
          query={query}
          onQuery={setQuery}
          onSearchFocus={() => go("/search")}
          onHome={() => { onLeave(); go("/"); }}
          actions={<NotificationInboxPopover {...inbox} viewAllLabel={t("feed.all")} onOpenAll={() => go("/notifications")} />}
          theme={mode === "light" ? "light" : "dark"}
          themeLabel={text.mode}
          onToggleTheme={() => void saveAppearance(style, document.documentElement.dataset.theme === "dark" ? "light" : "dark")}
          profileName={session?.user.displayName ?? ""}
          signInLabel={text.signIn}
          signedIn={Boolean(session)}
          onProfile={() => go("/profile")}
        />
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
      {/* On phones the onboarding card is laid out in the page flow, so the home behind it is desktop-only. */}
      {(homeVisible || (view === "onboarding" && !narrow)) && style !== "gruvbox" ? <HomeScreen {...homeProps} /> : null}
      {view !== "home" && view !== "room" ? (
        <Page title={view} onClose={() => go("/")}>
          {view === "search" ? <SearchScreen apiUrl={apiUrl} query={query} onQuery={setQuery} /> : null}
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
            <AuthScreen name={name} onName={setName} onTelegram={() => void signIn({ preventDefault() {} } as FormEvent)} onEmail={(event, password) => void emailSignIn(event, password)} onRegister={(event) => {
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
                    if (!window.sessionStorage.getItem("lume-pending-room")) go("/");
                  }
                });
            }} />
          ) : null}
          {view === "missing" ? <EmptyScreen title={t("empty.notFoundTitle")} body={t("empty.notFoundBody")} action={<><button type="button" className="btn btn-outline" onClick={() => go("/")}>{t("empty.home")}</button><button type="button" className="btn btn-primary" onClick={() => { updateCode(""); go("/join"); }}>{t("empty.tryRoomCode")}</button></>} /> : null}
          {view === "offline" ? <EmptyScreen title={t("empty.offlineTitle")} body={t("empty.offlineBody")} action={<button type="button" className="btn btn-primary" onClick={() => window.location.reload()}>{t("common.retry")}</button>} /> : null}
        </Page>
      ) : null}
      {narrow && view !== "room" ? <BottomNav current={view} onGo={go} /> : null}
      {error ? <p className="app-note">{error}</p> : null}
      {notice ? <p className="app-note">{notice}</p> : null}
    </AppShell>
  );
}
