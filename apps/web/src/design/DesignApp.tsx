import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { formatRoomCode, roomPresets, type RoomPresetId } from "@lume/contracts";
import { api, apiUrl, ClientError } from "../api/client.js";
import { useI18n } from "../i18n/context.js";
import { dayPartOf } from "../screens/home/greeting.js";
import { HomeScreen } from "../screens/home/HomeScreen.js";
import type { HomeFriend, HomeProps, HomeResume } from "../screens/home/types.js";
import { GruvboxBar } from "../screens/gruvbox/GruvboxBar.js";
import { GruvboxHome } from "../screens/gruvbox/GruvboxHome.js";
import { NotificationInboxPopover } from "../screens/notifications/NotificationInbox.js";
import { pickSplash, splashes } from "../i18n/splashes.js";
import type { ClientSession } from "../session.js";
import { AppHeader } from "../shell/AppHeader.js";
import { AppShell } from "../shell/AppShell.js";
import { BottomNav } from "../shell/BottomNav.js";
import { bindBackButton } from "../telegram/adapter.js";
import { readTelegramWebApp } from "../telegram/types.js";
import { RoomPreview } from "./chrome.js";
import { copy } from "./copy.js";
import { type CreateRoomWizardLabels } from "./CreateRoomWizard.js";
import { DesignPages } from "./DesignPages.js";
import { RoomFeed, type RoomFeedLoader, type RoomFeedRoom } from "./RoomFeed.js";
import { RoomAppearanceContext } from "./room-appearance.js";
import { shotHeat, shotPeople, shotRooms } from "./shot-fixtures.js";
import { useAccount } from "./useAccount.js";
import { useAppearance } from "./useAppearance.js";
import { useEntry } from "./useEntry.js";
import { useGlobalStats } from "./useGlobalStats.js";
import { useInbox } from "./useInbox.js";
import { useRouter } from "./useRouter.js";
import { roomErrorKey } from "./views.js";

export type { View } from "./views.js";

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
  const webApp = useMemo(() => readTelegramWebApp(), []);
  const { style, mode, setStyle, setMode, saveAppearance } = useAppearance(session);
  const router = useRouter(roomId, joiningInvite);
  const { path, shot, narrow, view } = router;
  const [invitee, setInvitee] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [people, setPeople] = useState<Array<{ id: string; displayName: string }>>([]);
  const [friendCatalog, setFriendCatalog] = useState(0);
  // One greeting and one splash per visit: re-renders must not reshuffle them.
  const [visitHour] = useState(() => new Date().getHours());
  const [visitSplash] = useState(() => pickSplash(locale, dayPartOf(new Date().getHours()), (session?.user.displayName ?? "").split(/\s+/)[0] ?? ""));

  const routerGo = router.go;
  const go = useCallback((next: string) => {
    setInvitee(null);
    routerGo(next);
  }, [routerGo]);

  const account = useAccount({ session, path, roomId, shot, query, setStyle, setMode });
  const { inbox, reminders } = useInbox(session?.accessToken, go);
  const entry = useEntry({ session, onSession, onOpen, onJoinNeedsAuth, go, view, hasResume: Boolean(account.resume), invitee, setInvitee });
  const { globalStats, statsReady } = useGlobalStats(shot, path, roomId);

  useEffect(() => {
    if (!webApp) return;
    if (view === "home" || view === "room" || view === "auth") {
      webApp.BackButton?.hide();
      return;
    }
    return bindBackButton(webApp, () => go("/"));
  }, [webApp, view, go]);

  useEffect(() => {
    if (view !== "create" && view !== "join" && view !== "onboarding") return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") go("/");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [view, go]);

  const shownRooms = account.rooms.filter((roomItem) => {
    const q = query.trim().toLowerCase();
    return !q || roomItem.title.toLowerCase().includes(q) || roomItem.code.includes(q) || formatRoomCode(roomItem.code).toLowerCase().includes(q);
  });

  const toggleTheme = () => void saveAppearance(style, document.documentElement.dataset.theme === "dark" ? "light" : "dark");
  const inboxPopover = <NotificationInboxPopover {...inbox} viewAllLabel={t("feed.all")} onOpenAll={() => go("/notifications")} />;

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
      .catch((caught: unknown) => entry.setError(caught instanceof ClientError ? t(roomErrorKey(caught.code)) : t("room.createFailed")));
  };
  const openFriendRoom = (target: string) => {
    const visibleRoom = account.rooms.find((item) => item.id === target);
    if (visibleRoom) { openCatalogRoom(visibleRoom); return; }
    setFriendCatalog((current) => current + 1);
    requestAnimationFrame(() => document.getElementById("public-rooms")?.scrollIntoView({ block: "start" }));
  };
  const inviteToNewRoom = (userId: string) => { go("/create"); setInvitee(userId); };
  const catalog = <RoomFeed id="public-rooms" key={`${session?.user.id ?? "guest"}:${friendCatalog}`} initialFilter={friendCatalog ? "friends" : "all"}
    style={style} signedIn={Boolean(session)} loadPage={loadCatalog} onOpenRoom={openCatalogRoom} onSignIn={() => go("/auth")} />;

  const homeFriends: HomeFriend[] = shot
    ? shotPeople.map((person, index) => ({ id: person.id, userId: person.id, displayName: person.name, roomId: index < 2 ? (shotRooms[index]?.id ?? null) : null, roomTitle: index < 2 ? (shotRooms[index]?.title ?? null) : null }))
    : account.friends;
  const homeResume: HomeResume | null = account.resume
    ? { title: account.resume.title, positionMs: account.resume.positionMs, durationMs: account.resume.durationMs, posterUrl: account.resume.posterUrl }
    : shot ? { title: shotRooms[0]?.title ?? "", positionMs: 4_364_000, durationMs: 7_390_000, posterUrl: null } : null;
  const homeProps: HomeProps = {
    displayName: session?.user.displayName ?? null,
    hour: shot ? 20 : visitHour,
    splash: shot ? (splashes[locale][0]?.text ?? null) : visitSplash,
    friends: homeFriends,
    resume: homeResume,
    resuming: entry.resuming,
    onResume: () => void entry.openResume(),
    catalog,
    level: account.level,
    heat: shot ? shotHeat : account.heat,
    reminders: reminders.map((note) => ({ id: note.id, title: note.title, body: note.body })),
    stats: globalStats,
    statsReady,
    guest: { name: entry.name, onName: entry.setName, onSignIn: (event) => void entry.signIn(event), onTelegram: () => void entry.signIn({ preventDefault() {} } as FormEvent) },
    join: { code: entry.code, invalid: entry.codeInvalid, onCode: entry.updateCode, onSubmit: (event) => void entry.joinRoom(event) },
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
      account.removeFriend(friendshipId);
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
      view === "room" || view === "auth" ? null : style === "gruvbox"
        ? <GruvboxBar view={view} onGo={go} searchLabel={text.search} actions={inboxPopover} light={mode === "light"} onToggleTheme={toggleTheme} themeLabel={text.mode} />
        : (
          <AppHeader
            searchLabel={text.search} query={query} onQuery={setQuery} onSearchFocus={() => go("/search")} onHome={() => { onLeave(); go("/"); }}
            actions={inboxPopover} theme={mode === "light" ? "light" : "dark"} themeLabel={text.mode} onToggleTheme={toggleTheme}
            profileName={session?.user.displayName ?? ""} signInLabel={text.signIn} signedIn={Boolean(session)} onProfile={() => go("/profile")}
          />
        )}>
      {view === "room" && roomId ? (
        <RoomAppearanceContext.Provider value={{ style, mode, onStyle: (next) => void saveAppearance(next, mode), onMode: (next) => void saveAppearance(style, next) }}>
          {room}
        </RoomAppearanceContext.Provider>
      ) : null}
      {(view === "room" || view === "unavailable") && !roomId ? <RoomPreview unavailable={view === "unavailable"} onGo={go} /> : null}
      {homeVisible && style === "gruvbox" ? (
        <GruvboxHome
          session={session} rooms={shownRooms} heat={shot ? shotHeat : account.heat} resume={account.resume?.title ?? (shot ? shotRooms[0]?.title ?? null : null)}
          onResume={account.resume ? () => void entry.openResume() : undefined} catalog={catalog} friends={account.friends} onJoinFriend={openFriendRoom} onInviteFriend={inviteToNewRoom}
          isShot={Boolean(shot)} name={entry.name} onName={entry.setName} onSignIn={(event) => void entry.signIn(event)} onGo={go}
          code={entry.code} codeInvalid={entry.codeInvalid} onCode={entry.updateCode} onJoin={(event) => void entry.joinRoom(event)}
          onOpen={(item) => { if (!session) { go("/auth"); return; } void api.joinRoom(session.accessToken, item.code).then((result) => onOpen(result.room.id)); }}
        />
      ) : null}
      {/* On phones the onboarding card is laid out in the page flow, so the home behind it is desktop-only. */}
      {(homeVisible || (view === "onboarding" && !narrow)) && style !== "gruvbox" ? <HomeScreen {...homeProps} /> : null}
      {view !== "home" && view !== "room" ? (
        <DesignPages
          view={view} session={session} go={go} style={style} mode={mode} onAppearance={(nextStyle, nextMode) => void saveAppearance(nextStyle, nextMode)}
          query={query} onQuery={setQuery} inbox={inbox} joiningInvite={joiningInvite} isShot={Boolean(shot)} wizardLabels={wizardLabels}
          onCreateRoom={entry.createRoom} onCloseWizard={() => go("/")} entry={entry} account={account}
        />
      ) : null}
      {narrow && view !== "room" ? <BottomNav current={view} onGo={go} /> : null}
      {entry.error ? <p className="app-note">{entry.error}</p> : null}
      {entry.notice ? <p className="app-note">{entry.notice}</p> : null}
    </AppShell>
  );
}
