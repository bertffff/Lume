import { emojiCategories, getNextRoomPanel, layoutAspectGroup, planPlayback, roomSheetPanels, sharedVoiceSeconds, shouldHoldForReady, voiceSessionStartedAt, withLayoutPreset, withVideoAspect, type RoomLayout, type RoomSheetPanel } from "@lume/contracts";
import { Fragment, useEffect, useRef, useState, useSyncExternalStore, type CSSProperties, type FormEvent } from "react";
import { apiUrl } from "../api/client.js";
import { useI18n } from "../i18n/context.js";
import type { MessageKey } from "../i18n/ru.js";
import { PlayerPanel } from "../layout/panels/PlayerPanel.js";
import { ResizeHandle } from "../layout/ResizeHandle.js";
import { resolveFlow } from "../layout/reflow.js";
import { clamp } from "../layout/weights.js";
import { useRoomActions } from "../room/live.js";
import { useChatScroll } from "../room/hooks/useChatScroll.js";
import { useRoomMeta } from "../room/hooks/useRoomMeta.js";
import { runVoicePreflight, saveVoicePreflight } from "../voice/preflight.js";
import { useVoiceChannel } from "../voice/useVoiceChannel.js";
import { EmojiPicker } from "./EmojiPicker.js";
import { permissionLabel, viewersWord } from "./copy.js";
import { posterStyle } from "./posters.js";
import { RoomProfileModal, type InRoomProfile } from "./RoomProfileModal.js";
import { RoomSettingsSheet } from "./RoomSettingsSheet.js";
import { SessionDock } from "./SessionDock.js";
import { currentStyle, initials, personHue, subscribeAppearance } from "./theme.js";

function clock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const body = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  return hours > 0 ? `${hours}:${body}` : body;
}

function durationLabel(durationMs: number | null): string {
  return durationMs === null ? "—" : clock(durationMs);
}

/** Fire-and-forget UI actions must not surface as unhandled promise rejections offline. */
function quietly(request: Promise<unknown>): void {
  void request.catch(() => undefined);
}

function voiceErrorKey(code: string): MessageKey {
  if (code === "livekit_disabled") return "voice.errorDisabled";
  if (code === "mic_denied") return "voice.errorMic";
  if (code === "forbidden") return "voice.errorForbidden";
  return "voice.errorGeneric";
}

export function RoomStage({
  layout,
  synced,
  onLayout,
  onLeave,
  onRefreshed,
}: {
  layout: RoomLayout;
  synced: boolean;
  onLayout: (next: RoomLayout) => void;
  onLeave: () => void;
  onRefreshed?: (next: { id: string; url: string }) => void;
}) {
  const { t } = useI18n();
  const live = useRoomActions();
  const voice = useVoiceChannel(live?.state.room.id);
  const style = useSyncExternalStore(subscribeAppearance, currentStyle, () => "cinema" as const);
  const bodyRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ axis: "x" | "y"; origin: number; size: number } | null>(null);
  const [bodyWidth, setBodyWidth] = useState(1200);
  const [extractors, setExtractors] = useState(false);
  const [refreshState, setRefreshState] = useState<"idle" | "busy" | "error">("idle");
  const [url, setUrl] = useState("");
  const [detected, setDetected] = useState<string | null>(null);
  const [preflightBusy, setPreflightBusy] = useState(false);
  const [voiceSeconds, setVoiceSeconds] = useState(0);
  const [voiceClock, setVoiceClock] = useState(() => Date.now());
  const voiceSecondsRef = useRef(0);
  const [playerError, setPlayerError] = useState<string | null>(null);
  const [premiumBlocked, setPremiumBlocked] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [uploading, setUploading] = useState(false);
  const [command, setCommand] = useState("");
  const [sheet, setSheet] = useState(false);
  const [mobilePanel, setMobilePanel] = useState<RoomSheetPanel>("chat");
  const [railTab, setRailTab] = useState<"chat" | "people" | "queue">("chat");
  const [seenCount, setSeenCount] = useState(0);
  const seenReady = useRef(false);
  const chatRef = useRef<HTMLDivElement>(null);
  const emojiButtonRef = useRef<HTMLButtonElement>(null);
  const [profile, setProfile] = useState<InRoomProfile | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const hasLive = Boolean(live);
  const messageCount = live?.state.messages.length ?? 0;
  const meta = useRoomMeta(live?.state.room.id, live?.accessToken, live?.state.room.nowPlaying?.id);
  const {
    settings,
    setSettings,
    permissions,
    setPermissions,
    iceUrls,
    hideOther,
    setHideOther,
    premium,
    recentEmojis,
    setRecentEmojis,
    preflight,
    setPreflight,
    history,
    recommendations,
    clearHistory,
  } = meta;
  const roomTitle = settings?.title ?? null;
  const roomHideReactions = settings?.hideReactions ?? false;
  const chat = useChatScroll(chatRef, messageCount);
  useEffect(() => {
    const element = bodyRef.current;
    if (!element) {
      return;
    }
    const measure = () => setBodyWidth(element.clientWidth);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [hasLive]);
  useEffect(() => {
    void fetch(`${apiUrl}/flags`)
      .then((response) => response.json())
      .then((payload: { extractors?: boolean }) => setExtractors(Boolean(payload.extractors)))
      .catch(() => setExtractors(false));
  }, []);
  useEffect(() => {
    const timer = window.setInterval(() => setVoiceClock(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => {
    voiceSecondsRef.current = 0;
    setVoiceSeconds(0);
    if (!voice.joined) return;
    const startedAt = Date.now();
    const timer = window.setInterval(() => {
      const elapsed = Math.floor((Date.now() - startedAt) / 1000);
      voiceSecondsRef.current = elapsed;
      setVoiceSeconds(elapsed);
    }, 1000);
    return () => {
      window.clearInterval(timer);
      const seconds = Math.max(voiceSecondsRef.current, Math.floor((Date.now() - startedAt) / 1000));
      voiceSecondsRef.current = 0;
      const token = live?.accessToken;
      if (seconds <= 0 || !token) return;
      void (async () => {
        let remaining = seconds;
        while (remaining > 0) {
          const chunk = Math.min(remaining, 8 * 60 * 60);
          remaining -= chunk;
          await fetch(`${apiUrl}/me/voice-seconds`, {
            method: "POST",
            headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
            body: JSON.stringify({ seconds: chunk }),
            keepalive: true,
          }).catch(() => undefined);
        }
      })();
    };
  }, [voice.joined, live?.accessToken]);
  useEffect(() => {
    if (!hasLive || seenReady.current) return;
    seenReady.current = true;
    setSeenCount(messageCount);
  }, [hasLive, messageCount]);
  useEffect(() => {
    if (!sheet) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSheet(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sheet]);
  if (!live) return null;
  const flow = resolveFlow({ viewportWidth: bodyWidth, videoAspect: layout.videoAspect });
  const narrow = flow === "stack";
  const room = live.state.room;
  const members = live.state.members;
  const playing = live.state.playback.status === "playing";
  const queue = live.state.queue.filter((item) => !item.played && item.id !== room.nowPlaying?.id);
  const sheetItems = room.nowPlaying ? [room.nowPlaying, ...queue] : queue;
  const recommended = recommendations
    .filter((item) => !queue.some((queued) => queued.url === item.url))
    .slice(0, 4);
  const gruv = style === "gruvbox";
  const bufferingCount = live.state.viewers.filter((viewer) => viewer.phase === "buffering").length;
  const waiting = shouldHoldForReady(bufferingCount > 0, bufferingCount);
  const status = waiting ? t("room.waitReady") : `${playing ? t("room.syncPlay") : t("room.syncPause")} ${clock(live.positionMs)}`;
  const sharedVoice = sharedVoiceSeconds(live.state.voice, voiceClock);
  const sharedVoiceStart = voiceSessionStartedAt(live.state.voice);
  const unread = Math.max(0, live.state.messages.length - seenCount);
  const firstUnreadIndex = Math.min(seenCount, live.state.messages.length);
  const pendingPlan = url ? planPlayback({ url, premium }) : null;
  const premiumUrl = pendingPlan?.type === "error" && pendingPlan.code === "premium_required";
  const voiceReady = voice.enabled !== false || voice.stub;
  const progress = room.nowPlaying?.durationMs && room.nowPlaying.durationMs > 0
    ? Math.min(100, Math.max(0, (live.positionMs / room.nowPlaying.durationMs) * 100))
    : 0;

  function jumpToLatest() {
    chat.jumpToLatest();
    setSeenCount(live?.state.messages.length ?? 0);
  }

  function jumpToUnread() {
    const anchor = chatRef.current?.querySelector<HTMLElement>('[data-unread="true"]');
    anchor?.scrollIntoView({ block: "center" });
    setSeenCount(live?.state.messages.length ?? 0);
  }

  function beginResize(client: number) {
    const rect = bodyRef.current?.getBoundingClientRect();
    if (!rect) return;
    const axis = flow === "side" ? "x" : "y";
    dragRef.current = {
      axis,
      origin: axis === "x" ? rect.left : rect.top,
      size: axis === "x" ? rect.width : rect.height,
    };
    applyResize(client);
  }

  function applyResize(client: number) {
    const session = dragRef.current;
    if (!session || session.size <= 0) return;
    const ratio = clamp((client - session.origin) / session.size, 0.35, 0.8);
    onLayout({ ...layout, playerRatio: ratio, preset: "custom" });
  }

  async function refreshStream() {
    const playing = room.nowPlaying;
    if (!playing || !extractors || !live || refreshState === "busy") return;
    setRefreshState("busy");
    try {
      const response = await fetch(`${apiUrl}/video/refresh`, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${live.accessToken}` },
        body: JSON.stringify({
          url: playing.url,
          roomId: room.id,
          positionMs: live.positionMs,
          playing: live.state.playback.status === "playing",
        }),
      });
      if (!response.ok) throw new Error("refresh_failed");
      const payload = (await response.json()) as { url?: string };
      if (!payload.url) throw new Error("refresh_failed");
      onRefreshed?.({ id: playing.id, url: payload.url });
      setRefreshState("idle");
      setPlayerError(null);
    } catch {
      setRefreshState("error");
    }
  }

  function addUrl(event: FormEvent) {
    event.preventDefault();
    const next = url.trim();
    if (!next) return;
    const plan = planPlayback({ url: next, premium });
    if (plan.type === "error" && plan.code === "premium_required") {
      setPremiumBlocked(true);
      setDetected(null);
      setUrl("");
      return;
    }
    setPremiumBlocked(false);
    live?.addQueue(next);
    void fetch(`${apiUrl}/video/detect`, { method: "POST", headers: { authorization: `Bearer ${live?.accessToken}`, "content-type": "application/json" }, body: JSON.stringify({ url: next }) })
      .then((response) => response.json())
      .then((payload: { source?: string | null; plan?: { type?: string } }) => setDetected(`${payload.source ?? "unknown"}${payload.plan?.type ? `:${payload.plan.type}` : ""}`))
      .catch(() => setDetected(null));
    setUrl("");
  }

  function pickEmoji(emoji: string) {
    setDraft((value) => `${value}${emoji}`);
    if (!live) return;
    void fetch(`${apiUrl}/me/recent-emojis`, {
      method: "POST",
      headers: { authorization: `Bearer ${live.accessToken}`, "content-type": "application/json" },
      body: JSON.stringify({ emoji }),
    })
      .then((response) => response.json())
      .then((payload: { recentEmojis?: string[] }) => {
        if (Array.isArray(payload.recentEmojis)) setRecentEmojis(payload.recentEmojis);
      })
      .catch(() => undefined);
  }

  async function testVoice() {
    if (!live || preflightBusy) return;
    setPreflightBusy(true);
    const result = await runVoicePreflight();
    setPreflight(result);
    try {
      setPreflight(await saveVoicePreflight(live.accessToken, result));
    } catch {
      // The local result stays visible when only the write failed.
    } finally {
      setPreflightBusy(false);
    }
  }

  async function attachImage(file: File | undefined) {
    if (!file || !live) return;
    if (!file.type.startsWith("image/") || file.size > 10 * 1024 * 1024) return;
    setUploading(true);
    try {
      const dataBase64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result ?? "").split(",")[1] ?? "");
        reader.onerror = () => reject(new Error("read_failed"));
        reader.readAsDataURL(file);
      });
      const response = await fetch(`${apiUrl}/uploads`, {
        method: "POST",
        headers: { authorization: `Bearer ${live.accessToken}`, "content-type": "application/json" },
        body: JSON.stringify({ dataBase64 }),
      });
      if (!response.ok) return;
      const payload = (await response.json()) as { url?: string };
      if (payload.url) live.sendImage(payload.url, t("chat.photo"));
    } catch {
      // A failed upload leaves the composer unchanged.
    } finally {
      setUploading(false);
    }
  }

  function sendChat(event: FormEvent) {
    event.preventDefault();
    const body = draft.trim();
    if (!body) return;
    live?.sendChat(body);
    setDraft("");
  }

  return (
    <div className={`${gruv ? "g-room" : "cinema-room"}${narrow ? " is-narrow" : ""}`} data-flow={flow}>
      <header className={gruv ? "tabline" : "top"}>
        {gruv ? (
          <>
            <span className="brand"><span className="dot" />LUME</span>
            <div className="bufs"><span className="buf on"><span className="nr">1</span><b data-testid="room-title">{roomTitle ?? room.title}</b></span></div>
            <span className="hash" data-testid="room-code">{room.code}</span>
          </>
        ) : (
          <>
            <button type="button" className="logo" onClick={onLeave} aria-label={t("room.leaveHome")}><i />lume</button>
            <div className="crumb"><b data-testid="room-title">{roomTitle ?? room.title}</b><span className="slate mono" data-testid="room-code">{room.code}</span><span className="room-viewers">{members.length} {viewersWord(members.length)}</span></div>
            <span className="spacer" />
            <div className="sync sync-pill">
              <span className="dot" />
              <b>{synced ? t("room.synced") : t("room.connecting")}</b>
              <span data-testid="playback-status">{status}</span>
              <button type="button" data-testid="sync-incident" title={t("room.syncIncidentHint")} onClick={() => quietly(fetch(`${apiUrl}/rooms/${room.id}/sync-incident`, { method: "POST", headers: { authorization: `Bearer ${live.accessToken}`, "content-type": "application/json" }, body: JSON.stringify({ note: "player drift" }) }))}>{t("room.syncIncident")}</button>
              <button type="button" data-testid="report-buffering" title={t("room.bufferingHint")} onClick={() => live.reportViewer("buffering")}>{t("room.buffering")}</button>
              <button type="button" data-testid="hide-other-reactions" onClick={() => {
                const next = !hideOther;
                quietly(fetch(`${apiUrl}/me`, { method: "PATCH", headers: { authorization: `Bearer ${live.accessToken}`, "content-type": "application/json" }, body: JSON.stringify({ hideOtherReactions: next }) })
                  .then(() => fetch(`${apiUrl}/me`, { headers: { authorization: `Bearer ${live.accessToken}` } }))
                  .then((response) => response.json())
                  .then((payload: { hideOtherReactions?: boolean }) => setHideOther(Boolean(payload.hideOtherReactions))));
              }}>{hideOther ? t("room.showOthers") : t("room.hideOthers")}</button>
              {live.state.self.role === "host" ? (
                <button type="button" data-testid="room-settings-open" onClick={() => setSettingsOpen(true)}>{t("room.settings")}</button>
              ) : null}
            </div>
            <div className="layout-switch" role="group" aria-label={t("room.layoutGroup")}>
              <button type="button" className={layout.preset === "theater" ? "btn btn-outline on" : "btn btn-outline"} data-testid="layout-theater" onClick={() => onLayout(withLayoutPreset(layout, "theater"))}>{t("layout.theater")}</button>
              <button type="button" className={layout.preset === "enlarged" ? "btn btn-outline on" : "btn btn-outline"} data-testid="layout-enlarged" onClick={() => onLayout(withLayoutPreset(layout, "enlarged"))}>{t("layout.enlarged")}</button>
              <button type="button" className={layout.preset === "immersive" ? "btn btn-outline on" : "btn btn-outline"} data-testid="layout-immersive" onClick={() => onLayout(withLayoutPreset(layout, "immersive"))}>{t("layout.immersive")}</button>
              <span style={{ width: 1, height: 20, background: "var(--line-2)", display: "inline-block", margin: "0 2px" }} />
              <button type="button" className={layoutAspectGroup(layout.videoAspect) === "horizontal" ? "btn btn-outline on" : "btn btn-outline"} data-testid="layout-horizontal" onClick={() => onLayout(withVideoAspect(layout, 16 / 9))}>16:9</button>
              <button type="button" className={layoutAspectGroup(layout.videoAspect) === "vertical" ? "btn btn-outline on" : "btn btn-outline"} data-testid="layout-vertical" onClick={() => onLayout(withVideoAspect(layout, 9 / 16))}>9:16</button>
            </div>
          </>
        )}
      </header>
      <SessionDock
        roomId={room.id}
        token={live.accessToken}
        memberCount={members.length}
        voiceCount={live.state.voice.length}
        voiceEnabled={voice.enabled === true}
        voiceJoined={voice.joined}
        voiceMuted={voice.muted}
        unread={unread}
        narrow={narrow}
        canSettings={live.state.self.role === "host"}
        onJumpUnread={jumpToLatest}
        onVoiceJoin={() => void voice.join()}
        onVoiceLeave={() => void voice.leave()}
        onVoiceMute={() => void voice.toggleMute()}
        onSettings={() => setSettingsOpen(true)}
        onLeave={onLeave}
      />
      <div className={`body flow-${flow}`} ref={bodyRef} data-flow={flow}>
        <section className="player-col" style={flow === "stack" ? undefined : { flexGrow: layout.playerRatio }}>
          <div
            className="stage-card stage-root"
            data-testid="player-frame"
            data-preset={layout.preset}
            data-aspect={layoutAspectGroup(layout.videoAspect)}
            style={{ "--player-aspect": layout.videoAspect } as CSSProperties}
          >
            {room.nowPlaying ? <div className="top-ov"><span className="pill">{room.nowPlaying.title}</span></div> : null}
            <PlayerPanel bare aspect={layout.videoAspect} synced={synced} onError={(url) => setPlayerError(url || "error")} onAspect={(videoAspect) => onLayout({ ...layout, videoAspect })} />
            {playerError ? (
              <div className="unavail" data-testid="player-error">
                <h2>{t("room.videoUnavailable")}</h2>
                <p>{playerError}</p>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center" }}>
                  <button type="button" data-testid="player-retry" onClick={() => { if (extractors) void refreshStream(); quietly(fetch(`${apiUrl}/rooms/${room.id}/recovery`, { method: "POST", headers: { authorization: `Bearer ${live.accessToken}`, "content-type": "application/json" }, body: JSON.stringify({ action: "retry", url: playerError }) })); }}>{t("room.refreshLink")}</button>
                  <button type="button" data-testid="player-open" onClick={() => { window.open(playerError, "_blank", "noopener"); quietly(fetch(`${apiUrl}/rooms/${room.id}/recovery`, { method: "POST", headers: { authorization: `Bearer ${live.accessToken}`, "content-type": "application/json" }, body: JSON.stringify({ action: "open", url: playerError }) })); }}>{t("room.openPlatform")}</button>
                </div>
                <form onSubmit={(event) => { event.preventDefault(); const next = String(new FormData(event.currentTarget).get("url") ?? ""); if (!next) return; live.addQueue(next); setPlayerError(null); quietly(fetch(`${apiUrl}/rooms/${room.id}/recovery`, { method: "POST", headers: { authorization: `Bearer ${live.accessToken}`, "content-type": "application/json" }, body: JSON.stringify({ action: "replace", url: next }) })); }}>
                  <input data-testid="player-replace-url" name="url" placeholder={t("room.newLink")} />
                  <button type="submit" data-testid="player-replace">{t("room.replaceVideo")}</button>
                </form>
              </div>
            ) : null}
            <div className="flo" data-testid="float-log" data-hide-other={hideOther ? "true" : "false"} data-room-hide-reactions={roomHideReactions ? "true" : "false"}>
              {live.floats.filter((float) => (!hideOther && !roomHideReactions) || float.userId === live.selfId).slice(-2).map((float) => (
                <div className="fb" key={float.id}><span>{float.emoji}</span></div>
              ))}
            </div>
          </div>
          {room.nowPlaying ? (
            <div className="ctl">
              <button
                type="button"
                className="play"
                data-testid="playback-play"
                onClick={() => live.setPlayback(playing ? "pause" : "play", live.positionMs)}
                aria-label={playing ? t("player.pause") : t("player.play")}
              >
                {playing ? "II" : "▶"}
              </button>
              <span className="time">{clock(live.positionMs)}{room.nowPlaying.durationMs ? <span> / {durationLabel(room.nowPlaying.durationMs)}</span> : null}</span>
              <div className="tlw">
                <div className="track"><div className="buf" style={{ width: `${Math.max(progress, 6)}%` }} /><div className="prog" style={{ width: `${progress}%` }} /></div>
                <div className="head" style={{ left: `${progress}%` }} />
                {members.slice(0, 2).map((member, index) => (
                  <span key={member.userId} className="fh" style={{ left: `${Math.min(94, progress + 6 + index * 8)}%` }}>
                    <span className={`av p-${personHue(member.userId)}`}>{initials(member.displayName).slice(0, 1)}</span>
                  </span>
                ))}
              </div>
            </div>
          ) : (
            <div className="ctl ctl-empty">
              <button
                type="button"
                className="play"
                data-testid="playback-play"
                onClick={() => live.setPlayback(playing ? "pause" : "play", live.positionMs)}
                aria-label={playing ? t("player.pause") : t("player.play")}
              >
                {playing ? "II" : "▶"}
              </button>
              <span className="empty-title"><i />{t("room.playerFree")}</span>
              <span className="ctl-empty-hint">{t("room.playerFreeHint")}</span>
            </div>
          )}
          <div className={narrow ? "sheet" : "low"}>
            {narrow ? <button type="button" className="sheet-tab" data-testid="mobile-sheet-toggle" onClick={() => setSheet((value) => !value)}>{t("room.openPanels")}</button> : null}
            <div className="card voice-card">
              <div className="ct">{t("room.voiceTitle")}
                {voice.joined ? <small data-testid="voice-session" data-seconds={sharedVoice} data-start={sharedVoiceStart ?? ""} data-local-seconds={voiceSeconds}>{t("room.onAir", { seconds: sharedVoice })}</small> : voice.enabled === false ? <small data-testid="voice-disabled" data-stub={voice.stub ? "true" : "false"}>{t("voice.disabled")}</small> : null}
                <small data-testid="voice-ice" data-count={iceUrls.length} title={iceUrls.join(" · ")}>{iceUrls.length > 0 ? iceUrls.join(" · ") : t("room.stunDefault")}</small>
              </div>
              <div className="voice-body">
                <ul className="voice-list" data-testid="member-list">
                  {members.map((member) => {
                    const channel = live.state.voice.find((item) => item.userId === member.userId);
                    return (
                      <li key={member.userId}>
                        <button
                          type="button"
                          className={channel?.speaking ? "vp spk" : "vp"}
                          data-testid={`member-${member.userId}`}
                          data-in-voice={channel ? "true" : "false"}
                          data-muted={channel ? String(channel.muted) : "none"}
                          data-speaking={channel ? String(channel.speaking) : "false"}
                          onClick={() => setProfile({ userId: member.userId, displayName: member.displayName, role: member.role })}
                          title={member.displayName}
                        >
                          <span className={`av p-${personHue(member.userId)}`}>{initials(member.displayName)}</span>
                          <span>{member.displayName}</span>
                          {channel?.muted ? <em data-testid={`member-muted-${member.userId}`}>{t("room.mutedShort")}</em> : null}
                        </button>
                      </li>
                    );
                  })}
                </ul>
                <div className="voice-controls">
                  <button type="button" className="vbtn" data-testid="voice-join" disabled={!voiceReady || voice.busy} onClick={() => void voice.join()}>{t("room.voiceJoin")}</button>
                  <button type="button" className="vbtn" data-testid="voice-preflight-run" disabled={preflightBusy} onClick={() => void testVoice()}>{preflightBusy ? t("room.voiceChecking") : t("room.voiceCheck")}</button>
                  <button type="button" className="vbtn" data-testid="voice-toggle" aria-pressed={!voice.muted} disabled={!voiceReady} onClick={() => void voice.toggleMute()}>{voice.muted ? t("room.micOn") : t("room.micOff")}</button>
                  <button type="button" className="vbtn" data-testid="voice-deafen" aria-pressed={voice.deafened} disabled={!voiceReady} onClick={() => void voice.toggleDeafen()}>{voice.deafened ? t("voice.undeafen") : t("voice.deafen")}</button>
                  <button type="button" className="vbtn leave" data-testid="voice-leave" onClick={() => void voice.leave()}>{t("room.leave")}</button>
                </div>
                {voice.enabled === false || voice.error ? (
                  <div className="voice-banner" role="status" data-testid="voice-fallback" data-stub={voice.stub ? "true" : "false"}>
                    {voice.enabled === false ? t("voice.disabledBanner") : t(voiceErrorKey(voice.error ?? ""))}
                  </div>
                ) : null}
                {voice.error ? <small className="voice-error" data-testid="voice-error" data-code={voice.error}>{t(voiceErrorKey(voice.error))}</small> : null}
                <div
                  className="voice-preflight"
                  data-testid="voice-preflight"
                  data-state={preflight ? "done" : "idle"}
                  data-network={preflight?.network ?? ""}
                  data-mic={preflight ? String(preflight.mic) : ""}
                  data-speaker={preflight ? String(preflight.speaker) : ""}
                >
                  {preflight ? (
                    <>
                      <span data-testid="voice-preflight-mic">{preflight.mic ? t("room.micLevel", { level: preflight.micLevel }) : t("room.micNoAccess")}</span>
                      <span data-testid="voice-preflight-speaker">{preflight.speaker ? t("room.speakersOk") : t("room.speakersNone")}</span>
                      <span data-testid="voice-preflight-network" data-network={preflight.network}>{t("room.network", { state: preflight.network === "good" ? t("room.networkGood") : preflight.network === "fair" ? t("room.networkFair") : t("room.networkWeak") })}</span>
                    </>
                  ) : (
                    <span>{t("room.preflightHint")}</span>
                  )}
                </div>
              </div>
            </div>
            <div className="card queue-card">
              <div className="ct">{t("room.queueTitle")} <small>{queue.length}</small>{live.skip.needed > 1 ? <span className="pill">{t("room.skipVotes", { votes: live.skip.votes, needed: live.skip.needed })}</span> : null}</div>
              <div className="queue-section">
                <h4>{t("room.upNext")} <small>{queue.length + (room.nowPlaying ? 1 : 0)}</small></h4>
                <div className="q">
                  {room.nowPlaying ? (
                    <div className="queue-now" data-testid="queue-now" data-refresh-state={refreshState}>
                      <div className="im" style={posterStyle(room.nowPlaying.id, room.nowPlaying.thumbnailUrl)} />
                      <div><small>{t("room.onAirShort")}</small><b>{room.nowPlaying.title}</b></div>
                      <span className="pill mono">{clock(live.positionMs)}</span>
                      {extractors ? (
                        <button
                          type="button"
                          className="mini refresh-link"
                          data-testid="queue-refresh"
                          disabled={refreshState === "busy"}
                          onClick={() => void refreshStream()}
                        >
                          {refreshState === "busy" ? t("room.refreshing") : refreshState === "error" ? t("room.refreshFailed") : t("room.refreshLink")}
                        </button>
                      ) : null}
                    </div>
                  ) : null}
                  <ol className="queue-list q">
                    {queue.slice(0, 3).map((item) => (
                      <li key={item.id} className="qi" data-testid="queue-item" data-url={item.url} data-provider={item.provider} data-title={item.title}>
                        <div className="im" style={posterStyle(item.id, item.thumbnailUrl)} />
                        <b>{item.title}</b>
                        <small data-testid="queue-item-duration" data-duration-ms={item.durationMs ?? ""}>{durationLabel(item.durationMs)}</small>
                      </li>
                    ))}
                  </ol>
                  <form className="qi add" onSubmit={addUrl}>
                    <input data-testid="queue-input" value={url} onChange={(event) => { setUrl(event.target.value); setPremiumBlocked(false); }} placeholder={t("queue.url")} aria-label={t("queue.url")} />
                    <button type="submit" data-testid="queue-add">{t("queue.add")}</button>
                    {detected ? <small>{detected}</small> : null}
                    {premiumUrl ? <small data-testid="premium-gate">{t("room.premiumNeeded")}</small> : null}
                    {premiumBlocked ? <small data-testid="premium-blocked">{t("room.premiumBlocked")}</small> : null}
                  </form>
                </div>
              </div>
              <div className="queue-section" data-testid="queue-recommendations">
                <h4>{t("room.recommendations")} <small>{recommended.length}</small></h4>
                {recommended.length === 0 ? <p className="empty-note">{t("room.recommendationsEmpty")}</p> : (
                  <ol className="recommendations-list">
                    {recommended.map((item) => (
                      <li key={item.url} data-testid="queue-recommendation" data-url={item.url} data-reason={item.reason}>
                        <b>{item.title ?? item.url}</b>
                        <small>{item.reason === "favorite" ? t("room.favorite") : t("room.history")}</small>
                        <button type="button" data-testid="queue-recommendation-add" onClick={() => live.addQueue(item.url, item.title ?? undefined)}>{t("room.toQueue")}</button>
                      </li>
                    ))}
                  </ol>
                )}
              </div>
              <div className="queue-section queue-history" data-testid="queue-history">
                <h4>
                  {t("room.historyTitle")} <small data-testid="queue-history-count">{history.length}</small>
                  {live.state.self.role === "host" && history.length > 0 ? (
                    <button type="button" data-testid="history-clear" onClick={() => void clearHistory()}>{t("room.clear")}</button>
                  ) : null}
                </h4>
                {history.length === 0 ? <p className="empty-note">{t("room.historyEmpty")}</p> : (
                  <ol className="queue-list history-list">
                    {history.map((item) => (
                      <li key={item.id} data-testid="queue-history-item" data-url={item.url}>
                        <b>{item.title ?? item.url}</b>
                        <small>{item.source}</small>
                        <button type="button" data-testid="history-reload" onClick={() => live.reloadHistory(item.id)}>{t("room.toQueue")}</button>
                      </li>
                    ))}
                  </ol>
                )}
              </div>
              {live.canControl ? (
                <>
                  <div className="queue-section">
                    <h4>{t("room.viewerRights")}</h4>
                    <form className="perms" data-testid="room-defaults" onSubmit={(event) => {
                      event.preventDefault();
                      quietly(fetch(`${apiUrl}/rooms/${room.id}/defaults`, {
                        method: "POST",
                        headers: { authorization: `Bearer ${live.accessToken}`, "content-type": "application/json" },
                        body: JSON.stringify(permissions),
                      }));
                    }}>
                      {(Object.keys(permissions) as Array<keyof typeof permissions>).map((key) => (
                        <label key={key}>
                          <input data-testid={`perm-${key}`} type="checkbox" checked={permissions[key]} onChange={(event) => setPermissions((current) => ({ ...current, [key]: event.target.checked }))} />
                          {permissionLabel(key, t)}
                        </label>
                      ))}
                      <button type="submit" data-testid="perm-save">{t("room.save")}</button>
                    </form>
                  </div>
                  <div className="queue-section">
                    <h4>{t("room.reportMember")}</h4>
                    <form className="report-form" data-testid="report-form" onSubmit={(event) => {
                      event.preventDefault();
                      const data = new FormData(event.currentTarget);
                      const reason = String(data.get("reason") ?? "").trim();
                      const target = String(data.get("target") ?? "");
                      if (!reason || !target || target === live.selfId) return;
                      quietly(fetch(`${apiUrl}/reports`, { method: "POST", headers: { authorization: `Bearer ${live.accessToken}`, "content-type": "application/json" }, body: JSON.stringify({ targetKind: "user", targetId: target, roomId: room.id, reason }) }));
                      event.currentTarget.reset();
                    }}>
                      <select data-testid="report-target" name="target" aria-label={t("room.reportTarget")}>
                        {members.filter((member) => member.userId !== live.selfId).map((member) => (
                          <option key={member.userId} value={member.userId}>{member.displayName}</option>
                        ))}
                      </select>
                      <input data-testid="report-reason" name="reason" placeholder={t("room.reportReason")} aria-label={t("room.reportReason")} />
                      <button type="submit" data-testid="report-send">{t("room.reportSend")}</button>
                    </form>
                  </div>
                  <div className="queue-actions">
                    <button type="button" className="btn btn-outline" data-testid="queue-next" onClick={live.playNext}>{t("queue.next")}</button>
                  </div>
                </>
              ) : null}
            </div>
          </div>
        </section>
        {flow === "stack" ? null : (
          <ResizeHandle
            axis={flow === "side" ? "x" : "y"}
            label={t("layout.resize")}
            onPointerDown={beginResize}
            onDrag={applyResize}
            onEnd={() => {
              dragRef.current = null;
            }}
            onKey={(delta) => onLayout({ ...layout, playerRatio: clamp(layout.playerRatio + delta, 0.35, 0.8), preset: "custom" })}
          />
        )}
        <aside
          className={gruv ? "pane irc" : "rail"}
          style={flow === "stack" ? undefined : { flexGrow: 1 - layout.playerRatio }}
        >
          <div className="tabs" role="tablist" aria-label={t("room.panels")}>
            <button type="button" role="tab" aria-selected={railTab === "chat"} className={railTab === "chat" ? "tab on" : "tab"} onClick={() => setRailTab("chat")}>{t("chat.title")} <span className="n">{live.state.messages.length}</span></button>
            <button type="button" role="tab" aria-selected={railTab === "people"} className={railTab === "people" ? "tab on" : "tab"} onClick={() => setRailTab("people")}>{t("room.people")} <span className="n">{members.length}</span></button>
            <button type="button" role="tab" aria-selected={railTab === "queue"} className={railTab === "queue" ? "tab on" : "tab"} onClick={() => setRailTab("queue")}>{t("room.queueTitle")} <span className="n">{queue.length}</span></button>
            {unread > 0 ? (
              <button type="button" className="unread-anchor" data-testid="unread-anchor" onClick={jumpToUnread}>
                {t("room.newMessagesShort", { count: unread })}
              </button>
            ) : null}
          </div>
          {railTab === "chat" ? (
            <>
              <div className="log" data-testid="chat-log" ref={chatRef} onScroll={chat.onScroll}>
                {live.state.messages.length === 0 ? <p className="rail-empty">{t("room.chatEmpty")}</p> : null}
                {live.state.messages.map((message, index) => {
                  const mine = message.userId === live.selfId;
                  const hue = personHue(message.userId);
                  return (
                    <Fragment key={message.id}>
                      {index === firstUnreadIndex && unread > 0 ? (
                        <span className="unread-divider" data-testid="unread-divider">{t("room.unreadTitle")}</span>
                      ) : null}
                      <div
                        className={mine ? "m mine" : "m"}
                        data-testid="chat-message"
                        data-unread={index >= firstUnreadIndex && unread > 0 ? "true" : "false"}
                      >
                        {mine ? null : <span className={`av p-${hue}`}>{initials(message.displayName)}</span>}
                        <div className="bu">
                          {mine ? null : <div className={`n p-${hue}`}>{message.displayName}</div>}
                          {message.body}
                          {message.imageUrl ? (
                            <img className="chat-attach" src={message.imageUrl} alt={t("chat.photo")} loading="lazy" />
                          ) : null}
                        </div>
                      </div>
                    </Fragment>
                  );
                })}
              </div>
              <div className="quick">{Object.values(emojiCategories).flat().slice(0, 7).map((emoji) => <button key={emoji} type="button" onClick={() => live.sendFloat(emoji)} aria-label={t("room.reaction", { emoji })}>{emoji}</button>)}</div>
              {chat.newCount > 0 ? (
                <button type="button" className="chat-new" data-testid="chat-new" onClick={jumpToLatest}>
                  {t("chat.new", { count: chat.newCount })}
                </button>
              ) : null}
              {emojiOpen ? (
                <EmojiPicker
                  recent={recentEmojis}
                  anchor={emojiButtonRef.current}
                  onPick={pickEmoji}
                  onClose={() => setEmojiOpen(false)}
                />
              ) : null}
              <form className="comp" onSubmit={sendChat}>
                <button
                  type="button"
                  className="emoji-toggle"
                  data-testid="emoji-picker-toggle"
                  ref={emojiButtonRef}
                  aria-expanded={emojiOpen}
                  aria-label={t("room.emoji")}
                  onClick={() => setEmojiOpen((value) => !value)}
                >
                  😊
                </button>
                <label className="attach" title={t("chat.attach")}>
                  <input
                    type="file"
                    accept="image/*"
                    data-testid="chat-attach"
                    aria-label={t("chat.attach")}
                    disabled={uploading}
                    onChange={(event) => void attachImage(event.target.files?.[0])}
                  />
                  <span aria-hidden="true">{uploading ? "…" : "📎"}</span>
                </label>
                <input data-testid="chat-input" value={draft} onChange={(event) => { setDraft(event.target.value); live.sendTyping(); }} placeholder={t("room.chatPlaceholder")} aria-label={t("room.message")} />
                <button type="submit" className="send" data-testid="chat-send" aria-label={t("chat.send")}>➤</button>
              </form>
            </>
          ) : null}
          {railTab === "people" ? (
            <div className="log" data-testid="rail-people">
              <div className="rail-section">
                <h4>{t("room.hostTitle")}</h4>
                {members.filter((member) => member.role === "host").map((member) => {
                  const channel = live.state.voice.find((item) => item.userId === member.userId);
                  return (
                    <button key={member.userId} type="button" className="rail-member" onClick={() => setProfile({ userId: member.userId, displayName: member.displayName, role: member.role })}>
                      <span className={`av p-${personHue(member.userId)}`}>{initials(member.displayName)}</span>
                      <div><b>{member.displayName}</b><small>{channel?.speaking ? t("room.speaking") : channel ? t("room.inVoice") : t("room.inRoom")}</small></div>
                      <span className="mini">{t("room.profile")}</span>
                    </button>
                  );
                })}
              </div>
              <div className="rail-section">
                <h4>{t("room.inRoomCount", { count: members.length })}</h4>
                {members.map((member) => {
                  const channel = live.state.voice.find((item) => item.userId === member.userId);
                  return (
                    <button key={member.userId} type="button" className="rail-member" onClick={() => setProfile({ userId: member.userId, displayName: member.displayName, role: member.role })}>
                      <span className={`av p-${personHue(member.userId)}`}>{initials(member.displayName)}</span>
                      <div><b>{member.displayName}{member.userId === live.selfId ? t("room.you") : ""}</b><small>{channel ? (channel.muted ? t("room.micOff") : t("room.inVoice")) : t("room.viewing")}</small></div>
                      <span className="mini">{t("room.profile")}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}
          {railTab === "queue" ? (
            <div className="log" data-testid="rail-queue">
              <div className="rail-section">
                <h4>{t("room.nowTitle")}</h4>
                {room.nowPlaying ? <div className="rail-queue-item"><b>{room.nowPlaying.title}</b><small>{clock(live.positionMs)} / {durationLabel(room.nowPlaying.durationMs)}</small></div> : <div className="rail-empty">{t("room.nothingPlaying")}</div>}
              </div>
              <div className="rail-section">
                <h4>{t("room.nextTitle", { count: queue.length })}</h4>
                {queue.length === 0 ? <div className="rail-empty">{t("room.queueEmpty")}</div> : queue.map((item) => (
                  <div key={item.id} className="rail-queue-item"><b>{item.title}</b><small>{durationLabel(item.durationMs)} · {item.provider}</small></div>
                ))}
              </div>
            </div>
          ) : null}
          {gruv ? (
            <form className="status" onSubmit={(event) => { event.preventDefault(); if (command.trim()) live.sendChat(command.trim()); setCommand(""); }}>
              <span className="sl-mode">ROOM</span>
              <span>:</span>
              <input aria-label="command" value={command} onChange={(event) => setCommand(event.target.value)} />
            </form>
          ) : null}
        </aside>
      </div>
      {narrow ? (
        <div className={sheet ? "mobile-sheet is-open" : "mobile-sheet"} data-testid="mobile-sheet" data-open={sheet ? "true" : "false"}>
          <div
            className="mobile-sheet-tabs"
            role="tablist"
            onKeyDown={(event) => {
              if (event.key === "ArrowRight") setMobilePanel(getNextRoomPanel(mobilePanel, 1));
              if (event.key === "ArrowLeft") setMobilePanel(getNextRoomPanel(mobilePanel, -1));
            }}
          >
            {roomSheetPanels.map((panel) => (
              <button
                key={panel}
                type="button"
                role="tab"
                aria-selected={mobilePanel === panel && sheet}
                className={mobilePanel === panel && sheet ? "on" : ""}
                data-testid={`mobile-sheet-tab-${panel}`}
                onClick={() => {
                  setMobilePanel(panel);
                  setSheet(true);
                }}
              >
                {panel === "chat" ? t("chat.title") : panel === "members" ? t("room.people") : t("room.queueTitle")}
              </button>
            ))}
            <button type="button" className="mobile-sheet-close" data-testid="mobile-sheet-close" onClick={() => setSheet(false)}>×</button>
          </div>
          {sheet ? (
            <div className="mobile-sheet-panel" data-testid="mobile-sheet-panel" data-panel={mobilePanel}>
              {mobilePanel === "chat" ? (
                <div className="log" data-testid="mobile-sheet-chat">
                  {live.state.messages.length === 0 ? <p className="empty-note">{t("room.mobileEmpty")}</p> : null}
                  {live.state.messages.slice(-12).map((message) => (
                    <div key={message.id} className="m">
                      <div className="bu">
                        <div className="n">{message.displayName}</div>
                        {message.body}
                        {message.imageUrl ? <img className="chat-attach" src={message.imageUrl} alt={t("chat.photo")} loading="lazy" /> : null}
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
              {mobilePanel === "members" ? (
                <ul className="mobile-sheet-list" data-testid="mobile-sheet-members">
                  {members.map((member) => (
                    <li key={member.userId}>
                      <button type="button" onClick={() => setProfile({ userId: member.userId, displayName: member.displayName, role: member.role })}>
                        <span className={`av p-${personHue(member.userId)}`}>{initials(member.displayName)}</span>
                        {member.displayName}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
              {mobilePanel === "queue" ? (
                <ol className="queue-list mobile-sheet-queue" data-testid="mobile-sheet-queue">
                  {sheetItems.length === 0 ? <li className="empty">{t("room.queueEmpty")}</li> : null}
                  {sheetItems.map((item) => (
                    <li key={item.id}>
                      <b>{item.title}</b>
                      <small>{item.id === room.nowPlaying?.id ? t("room.now") : item.provider}</small>
                    </li>
                  ))}
                </ol>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
      {profile ? (
        <RoomProfileModal
          member={profile}
          roomId={room.id}
          token={live.accessToken}
          selfId={live.selfId}
          canBan={live.state.self.role === "host"}
          onClose={() => setProfile(null)}
        />
      ) : null}
      {settingsOpen ? (
        <RoomSettingsSheet
          roomId={room.id}
          token={live.accessToken}
          onClose={() => setSettingsOpen(false)}
          onSaved={(next) => {
            setSettings({ title: next.title, hideReactions: Boolean(next.hideReactions), defaults: next.defaults ?? null });
          }}
        />
      ) : null}
    </div>
  );
}
