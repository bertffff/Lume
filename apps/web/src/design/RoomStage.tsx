import { layoutAspectGroup, sharedVoiceSeconds, shouldHoldForReady, voiceSessionStartedAt, type RoomLayout } from "@lume/contracts";
import { MessageCircle, Pause, Play, Settings2, SkipForward } from "lucide-react";
import { useContext, useEffect, useRef, useState, useSyncExternalStore, type CSSProperties, type ReactNode } from "react";
import { apiUrl } from "../api/client.js";
import { useI18n } from "../i18n/context.js";
import { ResizeHandle } from "../layout/ResizeHandle.js";
import { PlayerPanel } from "../layout/panels/PlayerPanel.js";
import { clamp } from "../layout/weights.js";
import { useRoomMeta } from "../room/hooks/useRoomMeta.js";
import { useRoomActions } from "../room/live.js";
import { useVoiceChannel } from "../voice/useVoiceChannel.js";
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
      if (event.key === "Escape" && !event.defaultPrevented && workspace.current?.querySelector(".room-dock")?.contains(document.activeElement)) {
        setDockOpen(false);
        (dockFocus.current ?? dockToggle.current)?.focus();
      }
    }
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [dockOpen]);

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
    <div className="room-live" data-room-style={style} data-testid="room-live" data-dock-open={dockOpen}>
      <RoomHeader title={meta.settings?.title ?? room.title} code={room.code} synced={synced} playbackStatus={status}
        memberCount={members.length} participants={members} onPeople={() => openDock("people")} onLeave={onLeave} appearance={appearance}
        onSettings={self.role === "host" ? () => setSettings("host") : undefined} />
      <div className="room-notices">{notices}</div>
      <div ref={workspace} className="room-workspace" style={{ "--room-player-share": `${layout.playerRatio * 100}%` } as CSSProperties}>
        <section className="room-player" aria-label={t("player.stage")}>
          <PlayerPanel aspect={layout.videoAspect} reload={reload} onError={setErrorUrl} onAspect={(videoAspect) => onLayout({ ...layout, videoAspect })}
            stage={{ className: "room-stage stage-card", "data-testid": "player-frame", "data-preset": layout.preset, "data-aspect": layoutAspectGroup(layout.videoAspect) }}
            overlay={<>
              {now && <strong className="room-media-title" title={now.title}>{now.title}</strong>}
              {playerError && <div className="room-player-error" data-testid="player-error">
                <h2>{t("room.videoUnavailable")}</h2>
                <div>
                  <button type="button" data-testid="player-retry" onClick={() => {
                    if (extractors) void refreshStream();
                    else { setErrorUrl(null); setReload((value) => value + 1); }
                    recover("retry", playerError);
                  }}>{t(refreshState === "error" ? "room.refreshFailed" : "room.refreshLink")}</button>
                  <button type="button" data-testid="player-open" onClick={() => {
                    const url = URL.canParse(playerError) ? new URL(playerError) : null;
                    if (url && (url.protocol === "http:" || url.protocol === "https:")) window.open(url, "_blank", "noopener,noreferrer");
                    recover("open", playerError);
                  }}>{t("room.openPlatform")}</button>
                </div>
                <form onSubmit={(event) => {
                  event.preventDefault();
                  const url = String(new FormData(event.currentTarget).get("url") ?? "").trim();
                  if (!url) return;
                  live.addQueue(url);
                  setErrorUrl(null);
                  recover("replace", url);
                }}>
                  <input name="url" type="url" required aria-label={t("room.newLink")} placeholder={t("room.newLink")} data-testid="player-replace-url" />
                  <button type="submit" data-testid="player-replace">{t("room.replaceVideo")}</button>
                </form>
              </div>}
              <div className="room-floats" data-testid="float-log" data-hide-other={meta.hideOther} data-room-hide-reactions={meta.settings?.hideReactions ?? false}>
                {live.floats.filter((item) => (!meta.hideOther && !meta.settings?.hideReactions) || item.userId === live.selfId).slice(-2).map((item) => <span key={item.id}>{item.emoji}</span>)}
              </div>
            </>}
            controls={<>
              <button type="button" className="room-play" data-testid="playback-play" disabled={!now || !live.canControl} aria-label={t(playing && now ? "player.pause" : "player.play")}
                onClick={() => live.setPlayback(playing ? "pause" : "play", live.positionMs)}>{playing && now ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />}</button>
              {now ? <span className="room-time">{roomClock(live.positionMs)}{duration ? ` / ${roomClock(duration)}` : ""}</span> : <strong className="room-time">{t("room.playerFree")}</strong>}
              {duration ? <progress max={duration} value={Math.min(duration, live.positionMs)} aria-label={t("player.stage")} /> : <span className="room-playbar-spacer" />}
              {live.canControl && queue.length > 0 ? <button type="button" data-testid="queue-next" onClick={live.playNext} aria-label={t("queue.next")} title={t("queue.next")}><SkipForward aria-hidden="true" /></button> : null}
              {now && !live.canControl && live.skip.needed > 1 ? <button type="button" onClick={() => live.voteSkip()} title={t("player.skip")}>{t("room.skipVotes", live.skip)}</button> : null}
              <button type="button" data-testid="room-personal-settings" aria-label={t("room.layoutGroup")} title={t("room.layoutGroup")} onClick={() => setSettings("personal")}><Settings2 aria-hidden="true" /></button>
            </>}
          />
        </section>
        <RoomVoiceCard voice={voice} members={members} presence={presence} sharedSeconds={sharedVoiceSeconds(presence, voiceClock.clock)} startedAt={voiceSessionStartedAt(presence)} localSeconds={voiceClock.seconds} />
        <RoomQueuePreview queue={queue} onAdd={() => openDock("queue", true)} />
        <div className="room-resize"><ResizeHandle axis="x" label={t("layout.resize")} onPointerDown={resize} onDrag={resize} onEnd={() => undefined} onKey={(delta) => onLayout({ ...layout, playerRatio: clamp(layout.playerRatio + delta, 0.35, 0.8), preset: "custom" })} /></div>
        <button type="button" ref={dockToggle} className="room-dock-toggle" data-testid="mobile-sheet-toggle" aria-expanded={dockOpen} onClick={() => openDock(tab)}><MessageCircle aria-hidden="true" />{t("room.openPanels")}</button>
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
