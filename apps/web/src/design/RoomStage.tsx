import { layoutAspectGroup, sharedVoiceSeconds, shouldHoldForReady, voiceSessionStartedAt, type RoomLayout } from "@lume/contracts";
import { MessageCircle, Pause, Play, Settings2, SkipForward } from "lucide-react";
import { Button, IconButton, Progress } from "../ds/index.js";
import { useContext, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { apiUrl } from "../api/client.js";
import { useI18n } from "../i18n/context.js";
import { ResizeHandle } from "../layout/ResizeHandle.js";
import { PlayerPanel } from "../layout/panels/PlayerPanel.js";
import { clamp } from "../layout/weights.js";
import { useRoomMeta } from "../room/hooks/useRoomMeta.js";
import { useRoomActions } from "../room/live.js";
import { useVoiceChannel } from "../voice/useVoiceChannel.js";
import { PlayerError } from "./PlayerError.js";
import { RoomChat } from "./RoomChat.js";
import { RoomHeader } from "./RoomHeader.js";
import { RoomPeople } from "./RoomPeople.js";
import { RoomProfileModal, type InRoomProfile } from "./RoomProfileModal.js";
import { RoomQueue } from "./RoomQueue.js";
import { RoomQueuePreview, roomClock } from "./RoomQueuePreview.js";
import { RoomSettingsSheet } from "./RoomSettingsSheet.js";
import { RoomVoiceCard } from "./RoomVoiceCard.js";
import { RoomPersonalSettings } from "./RoomPersonalSettings.js";
import { SessionDock, type DockTab } from "./SessionDock.js";
import { RoomAppearanceContext } from "./room-appearance.js";
import { currentStyle, subscribeAppearance } from "./theme.js";
import styles from "./RoomStage.module.css";

function useVoiceClock(joined: boolean, token?: string) {
  const [clock, setClock] = useState(() => Date.now());
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    setSeconds(0);
    setClock(Date.now());
    if (!joined) return;
    const start = Date.now();
    const timer = window.setInterval(() => {
      const now = Date.now();
      setSeconds(Math.floor((now - start) / 1000));
      setClock(now);
    }, 1000);
    return () => {
      window.clearInterval(timer);
      const elapsed = Math.floor((Date.now() - start) / 1000);
      if (!token || elapsed <= 0) return;
      for (let remaining = elapsed; remaining > 0; remaining -= 28_800) {
        void fetch(`${apiUrl}/me/voice-seconds`, {
          method: "POST",
          headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
          body: JSON.stringify({ seconds: Math.min(remaining, 28_800) }),
          keepalive: true,
        }).catch(() => undefined);
      }
    };
  }, [joined, token]);
  return { clock, seconds };
}

export function RoomStage({ layout, synced, onLayout, onLeave, onRefreshed, notices }: {
  layout: RoomLayout;
  synced: boolean;
  onLayout: (next: RoomLayout) => void;
  onLeave: () => void;
  onRefreshed?: (next: { id: string; url: string }) => void;
  notices?: ReactNode;
}) {
  const { t } = useI18n();
  const live = useRoomActions();
  const voice = useVoiceChannel(live?.state.room.id);
  const appearance = useContext(RoomAppearanceContext);
  const style = useSyncExternalStore(subscribeAppearance, currentStyle, () => "cinema" as const);
  const voiceClock = useVoiceClock(voice.joined, live?.accessToken);
  const meta = useRoomMeta(live?.state.room.id, live?.accessToken, live?.state.room.nowPlaying?.id);
  const [tab, setTab] = useState<DockTab>("chat");
  const [dockOpen, setDockOpen] = useState(false);
  const [focusQueue, setFocusQueue] = useState(0);
  const [profile, setProfile] = useState<InRoomProfile | null>(null);
  const [settings, setSettings] = useState<"personal" | "host" | null>(null);
  const [extractors, setExtractors] = useState(false);
  const [refreshState, setRefreshState] = useState<"idle" | "busy" | "error">("idle");
  const [errorUrl, setErrorUrl] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const dockToggle = useRef<HTMLButtonElement>(null);
  const dockFocus = useRef<HTMLElement | null>(null);
  const queueInput = useRef<HTMLInputElement>(null);
  const workspace = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const controller = new AbortController();
    void fetch(`${apiUrl}/flags`, { signal: controller.signal })
      .then(async (response) => response.ok && Boolean((await response.json() as { extractors?: boolean }).extractors))
      .then(setExtractors).catch(() => undefined);
    return () => controller.abort();
  }, []);
  useEffect(() => {
    if (focusQueue > 0) queueInput.current?.focus();
  }, [focusQueue]);
  useEffect(() => {
    if (!dockOpen || tab === "queue" || !dockToggle.current?.getClientRects().length) return;
    workspace.current?.querySelector<HTMLElement>(`[data-testid="session-dock-${tab}"]`)?.focus();
  }, [dockOpen, tab]);
  useEffect(() => {
    if (!dockOpen) return;
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape" && !event.defaultPrevented && workspace.current?.querySelector('[data-testid="session-dock"]')?.contains(document.activeElement)) {
        setDockOpen(false);
        (dockFocus.current ?? dockToggle.current)?.focus();
      }
    }
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [dockOpen]);

  useLayoutEffect(() => {
    const element = workspace.current;
    if (!element) return;
    element.style.setProperty("--room-share", `${layout.playerRatio * 100}%`);
    element.style.setProperty("--room-aspect", String(layout.videoAspect));
  }, [layout.playerRatio, layout.videoAspect, live]);

  if (!live) return null;
  const { room, members, self, messages, voice: presence } = live.state;
  const now = room.nowPlaying;
  const playing = live.state.playback.status === "playing";
  const queue = live.state.queue.filter((item) => !item.played && item.id !== now?.id);
  const waiting = shouldHoldForReady(live.state.viewers.some((viewer) => viewer.phase === "buffering"), live.state.viewers.filter((viewer) => viewer.phase === "buffering").length);
  const status = now && synced ? (waiting ? t("room.waitReady") : t(playing ? "room.syncPlay" : "room.syncPause")) : undefined;
  const duration = now?.durationMs && now.durationMs > 0 ? now.durationMs : null;
  const playerError = errorUrl && errorUrl === now?.url ? errorUrl : null;

  function openDock(next: DockTab, focusInput = false) {
    if (document.activeElement instanceof HTMLElement) dockFocus.current = document.activeElement;
    setTab(next);
    setDockOpen(true);
    if (focusInput) setFocusQueue((value) => value + 1);
    else if (!dockToggle.current?.getClientRects().length) {
      workspace.current?.querySelector<HTMLElement>(`[data-testid="session-dock-${next}"]`)?.focus();
    }
  }

  async function refreshStream() {
    if (!now || !live || refreshState === "busy") return;
    setRefreshState("busy");
    try {
      const response = await fetch(`${apiUrl}/video/refresh`, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${live.accessToken}` },
        body: JSON.stringify({ url: now.url, roomId: room.id, positionMs: live.positionMs, playing }),
      });
      if (!response.ok) throw new Error("refresh_failed");
      const { url } = (await response.json()) as { url?: string };
      if (!url) throw new Error("refresh_failed");
      if (url === now.url) setReload((value) => value + 1);
      else onRefreshed?.({ id: now.id, url });
      setRefreshState("idle");
      setErrorUrl(null);
    } catch {
      setRefreshState("error");
    }
  }

  function recover(action: "retry" | "open" | "replace", url: string) {
    void fetch(`${apiUrl}/rooms/${room.id}/recovery`, {
      method: "POST",
      headers: { authorization: `Bearer ${live?.accessToken}`, "content-type": "application/json" },
      body: JSON.stringify({ action, url }),
    }).catch(() => undefined);
  }

  function resize(client: number) {
    const rect = workspace.current?.getBoundingClientRect();
    if (!rect?.width) return;
    onLayout({ ...layout, playerRatio: clamp((client - rect.left) / rect.width, 0.35, 0.8), preset: "custom" });
  }

  return (
    <div className={styles.live} data-room-style={style} data-testid="room-live" data-dock-open={dockOpen}>
      <RoomHeader title={meta.settings?.title ?? room.title} code={room.code} synced={synced} playbackStatus={status}
        memberCount={members.length} participants={members} onPeople={() => openDock("people")} onLeave={onLeave} appearance={appearance}
        onSettings={self.role === "host" ? () => setSettings("host") : undefined} />
      <div className={styles.notices}>{notices}</div>
      <div ref={workspace} className={styles.workspace}>
        <div className={styles.main}>
          <section className={styles.player} aria-label={t("player.stage")}>
            <PlayerPanel aspect={layout.videoAspect} reload={reload} onError={setErrorUrl} onAspect={(videoAspect) => onLayout({ ...layout, videoAspect })}
              stage={{ "data-testid": "player-frame", "data-preset": layout.preset, "data-aspect": layoutAspectGroup(layout.videoAspect) }}
              overlay={<>
                {now && <strong className={styles.mediaTitle} title={now.title}>{now.title}</strong>}
                {playerError && <PlayerError url={playerError} refreshState={refreshState}
                  onRetry={() => {
                    if (extractors) void refreshStream();
                    else { setErrorUrl(null); setReload((value) => value + 1); }
                    recover("retry", playerError);
                  }}
                  onOpen={() => {
                    const url = URL.canParse(playerError) ? new URL(playerError) : null;
                    if (url && (url.protocol === "http:" || url.protocol === "https:")) window.open(url, "_blank", "noopener,noreferrer");
                    recover("open", playerError);
                  }}
                  onReplace={(url) => {
                    live.addQueue(url);
                    setErrorUrl(null);
                    recover("replace", url);
                  }} />}
                <div className={styles.floats} data-testid="float-log" data-hide-other={meta.hideOther} data-room-hide-reactions={meta.settings?.hideReactions ?? false}>
                  {live.floats.filter((item) => (!meta.hideOther && !meta.settings?.hideReactions) || item.userId === live.selfId).slice(-2).map((item) => <span key={item.id}>{item.emoji}</span>)}
                </div>
              </>}
              controls={<>
                <IconButton icon={playing && now ? Pause : Play} variant="primary" label={t(playing && now ? "player.pause" : "player.play")}
                  data-testid="playback-play" disabled={!now || !live.canControl} onClick={() => live.setPlayback(playing ? "pause" : "play", live.positionMs)} />
                {now ? <span className={styles.time}>{roomClock(live.positionMs)}{duration ? ` / ${roomClock(duration)}` : ""}</span> : <strong className={styles.free}>{t("room.playerFree")}</strong>}
                <div className={styles.progress}>{duration ? <Progress value={live.positionMs / duration} label={t("player.stage")} /> : null}</div>
                {live.canControl && queue.length > 0 ? <IconButton icon={SkipForward} variant="ghost" size="sm" data-testid="queue-next" label={t("queue.next")} onClick={live.playNext} /> : null}
                {now && !live.canControl && live.skip.needed > 1 ? <Button size="sm" variant="ghost" onClick={() => live.voteSkip()} title={t("player.skip")}>{t("room.skipVotes", live.skip)}</Button> : null}
                <IconButton icon={Settings2} variant="ghost" size="sm" data-testid="room-personal-settings" label={t("room.layoutGroup")} onClick={() => setSettings("personal")} />
              </>}
            />
          </section>
          <div className={styles.tray}>
            <RoomVoiceCard voice={voice} members={members} presence={presence} sharedSeconds={sharedVoiceSeconds(presence, voiceClock.clock)} startedAt={voiceSessionStartedAt(presence)} localSeconds={voiceClock.seconds} />
            <RoomQueuePreview queue={queue} onAdd={() => openDock("queue", true)} />
          </div>
        </div>
        <div className={styles.resize}><ResizeHandle axis="x" label={t("layout.resize")} onPointerDown={resize} onDrag={resize} onEnd={() => undefined} onKey={(delta) => onLayout({ ...layout, playerRatio: clamp(layout.playerRatio + delta, 0.35, 0.8), preset: "custom" })} /></div>
        <Button ref={dockToggle} className={styles.dockToggle} icon={MessageCircle} data-testid="mobile-sheet-toggle" aria-expanded={dockOpen} onClick={() => openDock(tab)}>{t("room.openPanels")}</Button>
        <SessionDock tab={tab} role={self.role} open={dockOpen} onTab={setTab} onClose={() => {
          setDockOpen(false);
          (dockFocus.current ?? dockToggle.current)?.focus();
        }} counts={{ chat: messages.length, people: members.length, queue: queue.length }} panels={{
          chat: <RoomChat live={live} recent={meta.recentEmojis} onRecent={meta.setRecentEmojis} active={tab === "chat"} commandLine={style === "gruvbox"} />,
          people: <RoomPeople live={live} onProfile={setProfile} />,
          queue: <RoomQueue live={live} meta={meta} queue={queue} inputRef={queueInput} refreshing={refreshState} refresh={extractors ? () => void refreshStream() : undefined} />,
        }} />
      </div>
      {profile && <RoomProfileModal member={profile} roomId={room.id} token={live.accessToken} selfId={live.selfId} canBan={self.role === "host" && profile.role !== "host"} onClose={() => setProfile(null)} />}
      {settings === "personal" && <RoomPersonalSettings live={live} meta={meta} appearance={appearance} layout={layout} onLayout={onLayout} onClose={() => setSettings(null)} />}
      {settings === "host" && self.role === "host" && <RoomSettingsSheet roomId={room.id} token={live.accessToken} onMuteAll={() => live.muteVoices()} members={members}
        onClose={() => setSettings(null)} onSaved={(next) => meta.setSettings({ title: next.title, hideReactions: Boolean(next.hideReactions), defaults: next.defaults ?? null })} />}
    </div>
  );
}
