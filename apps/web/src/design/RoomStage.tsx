import { emojiCategories, getNextRoomPanel, layoutAspectGroup, planPlayback, roomSheetPanels, sharedVoiceSeconds, shouldHoldForReady, voiceSessionStartedAt, withLayoutPreset, withVideoAspect, type RoomLayout, type RoomSheetPanel } from "@lume/contracts";
import { Fragment, useEffect, useRef, useState, type CSSProperties, type FormEvent } from "react";
import { apiUrl } from "../api/client.js";
import { useI18n } from "../i18n/context.js";
import { PlayerPanel } from "../layout/panels/PlayerPanel.js";
import { useRoomActions } from "../room/live.js";
import { runVoicePreflight, saveVoicePreflight, type VoicePreflightResult } from "../voice/preflight.js";
import { useVoiceChannel } from "../voice/useVoiceChannel.js";
import { EmojiPicker } from "./EmojiPicker.js";
import { permissionLabel, viewersWord } from "./copy.js";
import { posterStyle } from "./posters.js";
import { RoomProfileModal, type InRoomProfile } from "./RoomProfileModal.js";
import { RoomSettingsSheet, type RoomSettings } from "./RoomSettingsSheet.js";
import { SessionDock } from "./SessionDock.js";
import { initials, personHue } from "./theme.js";

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

function voiceErrorText(code: string): string {
  if (code === "livekit_disabled") return "Голос не настроен на сервере";
  if (code === "mic_denied") return "Нет доступа к микрофону";
  if (code === "forbidden") return "Говорить в этой комнате нельзя";
  return "Не удалось подключиться к голосу";
}

export function RoomStage({
  layout,
  synced,
  onLayout,
  onLeave,
}: {
  layout: RoomLayout;
  synced: boolean;
  onLayout: (next: RoomLayout) => void;
  onLeave: () => void;
}) {
  const { t } = useI18n();
  const live = useRoomActions();
  const voice = useVoiceChannel(live?.state.room.id);
  const [style, setStyle] = useState(() => (document.documentElement.dataset.style === "gruvbox" ? "gruvbox" : "cinema"));
  const [narrow, setNarrow] = useState(() => window.innerWidth < 800);
  const [url, setUrl] = useState("");
  const [detected, setDetected] = useState<string | null>(null);
  const [history, setHistory] = useState<Array<{ id: string; title: string | null; url: string; source: string; watchedAt: string }>>([]);
  const [recommendations, setRecommendations] = useState<Array<{ url: string; title: string | null; reason: string }>>([]);
  const [iceUrls, setIceUrls] = useState<string[]>([]);
  const [preflight, setPreflight] = useState<VoicePreflightResult | null>(null);
  const [preflightBusy, setPreflightBusy] = useState(false);
  const [voiceSeconds, setVoiceSeconds] = useState(0);
  const [voiceClock, setVoiceClock] = useState(() => Date.now());
  const voiceSecondsRef = useRef(0);
  const [permissions, setPermissions] = useState({ canChat: true, canQueue: true, canSpeak: true, canReact: true, canSeek: false, canInvite: true });
  const [playerError, setPlayerError] = useState<string | null>(null);
  const [hideOther, setHideOther] = useState(false);
  const [premium, setPremium] = useState(false);
  const [premiumBlocked, setPremiumBlocked] = useState(false);
  const [recentEmojis, setRecentEmojis] = useState<string[]>([]);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [command, setCommand] = useState("");
  const [sheet, setSheet] = useState(false);
  const [mobilePanel, setMobilePanel] = useState<RoomSheetPanel>("chat");
  const [railTab, setRailTab] = useState<"chat" | "people" | "queue">("chat");
  const [seenCount, setSeenCount] = useState(0);
  const seenReady = useRef(false);
  const chatRef = useRef<HTMLDivElement>(null);
  const [profile, setProfile] = useState<InRoomProfile | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [roomTitle, setRoomTitle] = useState<string | null>(null);
  const [roomHideReactions, setRoomHideReactions] = useState(false);
  const liveRoomId = live?.state.room.id;
  const accessToken = live?.accessToken;
  const hasLive = Boolean(live);
  const messageCount = live?.state.messages.length ?? 0;
  useEffect(() => {
    const onResize = () => setNarrow(window.innerWidth < 800);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  useEffect(() => {
    const observer = new MutationObserver(() => {
      setStyle(document.documentElement.dataset.style === "gruvbox" ? "gruvbox" : "cinema");
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-style"] });
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (!liveRoomId || !accessToken) return;
    let stopped = false;
    void fetch(`${apiUrl}/rooms/${liveRoomId}/settings`, { headers: { authorization: `Bearer ${accessToken}` } })
      .then((response) => response.json())
      .then((payload: RoomSettings) => {
        if (stopped) return;
        setRoomTitle(payload.title);
        setRoomHideReactions(Boolean(payload.hideReactions));
      })
      .catch(() => undefined);
    void fetch(`${apiUrl}/ice-servers`, { headers: { authorization: `Bearer ${accessToken}` } })
      .then((response) => response.json())
      .then((payload: { iceServers?: Array<{ urls?: string | string[] }> }) => {
        if (stopped) return;
        setIceUrls((payload.iceServers ?? []).flatMap((server) => (Array.isArray(server.urls) ? server.urls : server.urls ? [server.urls] : [])));
      })
      .catch(() => {
        if (!stopped) setIceUrls([]);
      });
    void fetch(`${apiUrl}/me`, { headers: { authorization: `Bearer ${accessToken}` } })
      .then((response) => response.json())
      .then((payload: { hideOtherReactions?: boolean; isPremium?: boolean; recentEmojis?: string[] }) => {
        if (stopped) return;
        setHideOther(Boolean(payload.hideOtherReactions));
        setPremium(Boolean(payload.isPremium));
        setRecentEmojis(Array.isArray(payload.recentEmojis) ? payload.recentEmojis : []);
      })
      .catch(() => {
        if (stopped) return;
        setHideOther(false);
        setPremium(false);
        setRecentEmojis([]);
      });
    return () => {
      stopped = true;
    };
  }, [accessToken, liveRoomId]);
  useEffect(() => {
    const token = live?.accessToken;
    if (!token) return;
    let stopped = false;
    void fetch(`${apiUrl}/voice/preflight`, { headers: { authorization: `Bearer ${token}` } })
      .then((response) => response.json())
      .then((payload: { preflight?: VoicePreflightResult | null }) => {
        if (!stopped) setPreflight(payload.preflight ?? null);
      })
      .catch(() => undefined);
    return () => {
      stopped = true;
    };
  }, [live?.accessToken]);
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
    const room = live?.state.room.id;
    const token = live?.accessToken;
    if (!room || !token) return;
    let stopped = false;
    void fetch(`${apiUrl}/rooms/${room}/history`, { headers: { authorization: `Bearer ${token}` } })
      .then((response) => response.json())
      .then((payload: { history?: Array<{ id: string; title: string | null; url: string; source: string; watchedAt: string }> }) => {
        if (!stopped) setHistory(payload.history ?? []);
      })
      .catch(() => {
        if (!stopped) setHistory([]);
      });
    return () => {
      stopped = true;
    };
  }, [live?.accessToken, live?.state.room.id, live?.state.room.nowPlaying?.id]);
  useEffect(() => {
    const room = live?.state.room.id;
    const token = live?.accessToken;
    if (!room || !token) return;
    let stopped = false;
    void fetch(`${apiUrl}/me/discovery?roomId=${encodeURIComponent(room)}`, { headers: { authorization: `Bearer ${token}` } })
      .then((response) => response.json())
      .then((payload: { items?: Array<{ url: string; title: string | null; reason: string }> }) => {
        if (!stopped) setRecommendations(payload.items ?? []);
      })
      .catch(() => {
        if (!stopped) setRecommendations([]);
      });
    return () => {
      stopped = true;
    };
  }, [live?.accessToken, live?.state.room.id, live?.state.room.nowPlaying?.id]);
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
  const status = waiting ? "Ждём готовности" : `${playing ? t("room.syncPlay") : t("room.syncPause")} ${clock(live.positionMs)}`;
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

  function jumpToUnread() {
    const anchor = chatRef.current?.querySelector<HTMLElement>('[data-unread="true"]');
    anchor?.scrollIntoView({ block: "center" });
    setSeenCount(live?.state.messages.length ?? 0);
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

  async function clearHistory() {
    if (!live) return;
    const response = await fetch(`${apiUrl}/rooms/${room.id}/history`, {
      method: "DELETE",
      headers: { authorization: `Bearer ${live.accessToken}` },
    }).catch(() => null);
    if (response?.ok) {
      setHistory([]);
    }
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

  function sendChat(event: FormEvent) {
    event.preventDefault();
    const body = draft.trim();
    if (!body) return;
    live?.sendChat(body);
    setDraft("");
  }

  return (
    <div className={`${gruv ? "g-room" : "cinema-room"}${narrow ? " is-narrow" : ""}`}>
      <header className={gruv ? "tabline" : "top"}>
        {gruv ? (
          <>
            <span className="brand"><span className="dot" />LUME</span>
            <div className="bufs"><span className="buf on"><span className="nr">1</span><b data-testid="room-title">{roomTitle ?? room.title}</b></span></div>
            <span className="hash" data-testid="room-code">{room.code}</span>
          </>
        ) : (
          <>
            <button type="button" className="logo" onClick={onLeave} aria-label="Выйти на главную"><i />lume</button>
            <div className="crumb"><b data-testid="room-title">{roomTitle ?? room.title}</b><span className="slate mono" data-testid="room-code">{room.code}</span><span className="room-viewers">{members.length} {viewersWord(members.length)}</span></div>
            <span className="spacer" />
            <div className="sync sync-pill">
              <span className="dot" />
              <b>{synced ? "Синхронно" : "Подключение"}</b>
              <span data-testid="playback-status">{status}</span>
              <button type="button" data-testid="sync-incident" title="Сообщить о рассинхронизации" onClick={() => quietly(fetch(`${apiUrl}/rooms/${room.id}/sync-incident`, { method: "POST", headers: { authorization: `Bearer ${live.accessToken}`, "content-type": "application/json" }, body: JSON.stringify({ note: "player drift" }) }))}>Сбой</button>
              <button type="button" data-testid="report-buffering" title="Сообщить о буферизации" onClick={() => live.reportViewer("buffering")}>Буфер</button>
              <button type="button" data-testid="hide-other-reactions" onClick={() => {
                const next = !hideOther;
                quietly(fetch(`${apiUrl}/me`, { method: "PATCH", headers: { authorization: `Bearer ${live.accessToken}`, "content-type": "application/json" }, body: JSON.stringify({ hideOtherReactions: next }) })
                  .then(() => fetch(`${apiUrl}/me`, { headers: { authorization: `Bearer ${live.accessToken}` } }))
                  .then((response) => response.json())
                  .then((payload: { hideOtherReactions?: boolean }) => setHideOther(Boolean(payload.hideOtherReactions))));
              }}>{hideOther ? "Показать чужие" : "Скрыть чужие"}</button>
              {live.state.self.role === "host" ? (
                <button type="button" data-testid="room-settings-open" onClick={() => setSettingsOpen(true)}>Настройки</button>
              ) : null}
            </div>
            <div className="layout-switch" role="group" aria-label="Раскладка комнаты">
              <button type="button" className={layout.preset === "theater" ? "btn btn-outline on" : "btn btn-outline"} data-testid="layout-theater" onClick={() => onLayout(withLayoutPreset(layout, "theater"))}>Обычный</button>
              <button type="button" className={layout.preset === "enlarged" ? "btn btn-outline on" : "btn btn-outline"} data-testid="layout-enlarged" onClick={() => onLayout(withLayoutPreset(layout, "enlarged"))}>Шире</button>
              <button type="button" className={layout.preset === "immersive" ? "btn btn-outline on" : "btn btn-outline"} data-testid="layout-immersive" onClick={() => onLayout(withLayoutPreset(layout, "immersive"))}>Погружение</button>
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
        canSettings={live.state.self.role === "host"}
        onVoiceJoin={() => void voice.join()}
        onVoiceLeave={() => void voice.leave()}
        onVoiceMute={() => void voice.toggleMute()}
        onSettings={() => setSettingsOpen(true)}
        onLeave={onLeave}
      />
      <div className="body">
        <section className="player-col">
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
                <h2>Видео недоступно</h2>
                <p>{playerError}</p>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center" }}>
                  <button type="button" data-testid="player-retry" onClick={() => quietly(fetch(`${apiUrl}/rooms/${room.id}/recovery`, { method: "POST", headers: { authorization: `Bearer ${live.accessToken}`, "content-type": "application/json" }, body: JSON.stringify({ action: "retry", url: playerError }) }))}>Обновить ссылку</button>
                  <button type="button" data-testid="player-open" onClick={() => { window.open(playerError, "_blank", "noopener"); quietly(fetch(`${apiUrl}/rooms/${room.id}/recovery`, { method: "POST", headers: { authorization: `Bearer ${live.accessToken}`, "content-type": "application/json" }, body: JSON.stringify({ action: "open", url: playerError }) })); }}>Открыть на платформе</button>
                </div>
                <form onSubmit={(event) => { event.preventDefault(); const next = String(new FormData(event.currentTarget).get("url") ?? ""); if (!next) return; live.addQueue(next); setPlayerError(null); quietly(fetch(`${apiUrl}/rooms/${room.id}/recovery`, { method: "POST", headers: { authorization: `Bearer ${live.accessToken}`, "content-type": "application/json" }, body: JSON.stringify({ action: "replace", url: next }) })); }}>
                  <input data-testid="player-replace-url" name="url" placeholder="Новая ссылка" />
                  <button type="submit" data-testid="player-replace">Заменить видео</button>
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
                aria-label={playing ? "Пауза" : "Играть"}
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
              <span className="pill mono">1×</span>
            </div>
          ) : (
            <div className="ctl ctl-empty">
              <button
                type="button"
                className="play"
                data-testid="playback-play"
                onClick={() => live.setPlayback(playing ? "pause" : "play", live.positionMs)}
                aria-label={playing ? "Пауза" : "Играть"}
              >
                {playing ? "II" : "▶"}
              </button>
              <span className="empty-title"><i />Плеер свободен</span>
              <span className="ctl-empty-hint">Вставьте ссылку в сцене или добавьте видео в очередь</span>
              <span className="pill mono">1×</span>
            </div>
          )}
          <div className={narrow ? "sheet" : "low"}>
            {narrow ? <button type="button" className="sheet-tab" data-testid="mobile-sheet-toggle" onClick={() => setSheet((value) => !value)}>Открыть панели</button> : null}
            <div className="card voice-card">
              <div className="ct">Голос
                {voice.joined ? <small data-testid="voice-session" data-seconds={sharedVoice} data-start={sharedVoiceStart ?? ""} data-local-seconds={voiceSeconds}>{`в эфире ${sharedVoice}с`}</small> : voice.enabled === false ? <small data-testid="voice-disabled" data-stub={voice.stub ? "true" : "false"}>{t("voice.disabled")}</small> : null}
                <small data-testid="voice-ice" data-count={iceUrls.length} title={iceUrls.join(" · ")}>{iceUrls.length > 0 ? iceUrls.join(" · ") : "STUN по умолчанию"}</small>
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
                          {channel?.muted ? <em data-testid={`member-muted-${member.userId}`}>выкл</em> : null}
                        </button>
                      </li>
                    );
                  })}
                </ul>
                <div className="voice-controls">
                  <button type="button" className="vbtn" data-testid="voice-join" disabled={!voiceReady || voice.busy} onClick={() => void voice.join()}>Войти</button>
                  <button type="button" className="vbtn" data-testid="voice-preflight-run" disabled={preflightBusy} onClick={() => void testVoice()}>{preflightBusy ? "Проверяем" : "Проверка"}</button>
                  <button type="button" className="vbtn" data-testid="voice-toggle" disabled={!voiceReady} onClick={() => void voice.toggleMute()}>{voice.muted ? "Микрофон: вкл" : "Микрофон: выкл"}</button>
                  <button type="button" className="vbtn leave" data-testid="voice-leave" onClick={() => void voice.leave()}>Выйти</button>
                </div>
                {voice.error ? <small className="voice-error" data-testid="voice-error" data-code={voice.error}>{voiceErrorText(voice.error)}</small> : null}
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
                      <span data-testid="voice-preflight-mic">Микрофон: {preflight.mic ? `уровень ${preflight.micLevel}%` : "нет доступа"}</span>
                      <span data-testid="voice-preflight-speaker">Динамики: {preflight.speaker ? "слышно" : "не найдены"}</span>
                      <span data-testid="voice-preflight-network" data-network={preflight.network}>Сеть: {preflight.network === "good" ? "хорошая" : preflight.network === "fair" ? "средняя" : "слабая"}</span>
                    </>
                  ) : (
                    <span>Проверьте микрофон, динамики и сеть перед входом в голос.</span>
                  )}
                </div>
              </div>
            </div>
            <div className="card queue-card">
              <div className="ct">Очередь <small>{queue.length}</small>{live.skip.needed > 1 ? <span className="pill">Пропуск {live.skip.votes} из {live.skip.needed}</span> : null}</div>
              <div className="queue-section">
                <h4>Сейчас и далее <small>{queue.length + (room.nowPlaying ? 1 : 0)}</small></h4>
                <div className="q">
                  {room.nowPlaying ? (
                    <div className="queue-now">
                      <div className="im" style={posterStyle(room.nowPlaying.id, room.nowPlaying.thumbnailUrl)} />
                      <div><small>в эфире</small><b>{room.nowPlaying.title}</b></div>
                      <span className="pill mono">{clock(live.positionMs)}</span>
                    </div>
                  ) : null}
                  <ol className="tr-queue q">
                    {queue.slice(0, 3).map((item) => (
                      <li key={item.id} className="qi" data-testid="queue-item" data-url={item.url} data-provider={item.provider} data-title={item.title}>
                        <div className="im" style={posterStyle(item.id, item.thumbnailUrl)} />
                        <b>{item.title}</b>
                        <small data-testid="queue-item-duration" data-duration-ms={item.durationMs ?? ""}>{durationLabel(item.durationMs)}</small>
                      </li>
                    ))}
                  </ol>
                  <form className="qi add" onSubmit={addUrl}>
                    <input data-testid="queue-input" value={url} onChange={(event) => { setUrl(event.target.value); setPremiumBlocked(false); }} placeholder="Добавить ссылку" aria-label={t("queue.url")} />
                    <button type="submit" data-testid="queue-add">{t("queue.add")}</button>
                    {detected ? <small>{detected}</small> : null}
                    {premiumUrl ? <small data-testid="premium-gate">Нужен Premium для этой платформы</small> : null}
                    {premiumBlocked ? <small data-testid="premium-blocked">Платформа доступна с Premium</small> : null}
                  </form>
                </div>
              </div>
              <div className="queue-section" data-testid="queue-recommendations">
                <h4>Рекомендации <small>{recommended.length}</small></h4>
                {recommended.length === 0 ? <p className="empty-note">Пока пусто — рекомендации появятся после первых просмотров.</p> : (
                  <ol className="recommendations-list">
                    {recommended.map((item) => (
                      <li key={item.url} data-testid="queue-recommendation" data-url={item.url} data-reason={item.reason}>
                        <b>{item.title ?? item.url}</b>
                        <small>{item.reason === "favorite" ? "избранное" : "история"}</small>
                        <button type="button" data-testid="queue-recommendation-add" onClick={() => live.addQueue(item.url, item.title ?? undefined)}>В очередь</button>
                      </li>
                    ))}
                  </ol>
                )}
              </div>
              <div className="queue-section queue-history" data-testid="queue-history">
                <h4>
                  История <small data-testid="queue-history-count">{history.length}</small>
                  {live.state.self.role === "host" && history.length > 0 ? (
                    <button type="button" data-testid="history-clear" onClick={() => void clearHistory()}>Очистить</button>
                  ) : null}
                </h4>
                {history.length === 0 ? <p className="empty-note">История пуста</p> : (
                  <ol className="tr-queue history-list">
                    {history.map((item) => (
                      <li key={item.id} data-testid="queue-history-item" data-url={item.url}>
                        <b>{item.title ?? item.url}</b>
                        <small>{item.source}</small>
                        <button type="button" data-testid="history-reload" onClick={() => live.reloadHistory(item.id)}>В очередь</button>
                      </li>
                    ))}
                  </ol>
                )}
              </div>
              {live.canControl ? (
                <>
                  <div className="queue-section">
                    <h4>Права зрителей</h4>
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
                          {permissionLabel(key)}
                        </label>
                      ))}
                      <button type="submit" data-testid="perm-save">Сохранить</button>
                    </form>
                  </div>
                  <div className="queue-section">
                    <h4>Жалоба на участника</h4>
                    <form className="report-form" data-testid="report-form" onSubmit={(event) => {
                      event.preventDefault();
                      const data = new FormData(event.currentTarget);
                      const reason = String(data.get("reason") ?? "").trim();
                      const target = String(data.get("target") ?? "");
                      if (!reason || !target || target === live.selfId) return;
                      quietly(fetch(`${apiUrl}/reports`, { method: "POST", headers: { authorization: `Bearer ${live.accessToken}`, "content-type": "application/json" }, body: JSON.stringify({ targetKind: "user", targetId: target, roomId: room.id, reason }) }));
                      event.currentTarget.reset();
                    }}>
                      <select data-testid="report-target" name="target" aria-label="На кого жалоба">
                        {members.filter((member) => member.userId !== live.selfId).map((member) => (
                          <option key={member.userId} value={member.userId}>{member.displayName}</option>
                        ))}
                      </select>
                      <input data-testid="report-reason" name="reason" placeholder="Причина жалобы" aria-label="Причина жалобы" />
                      <button type="submit" data-testid="report-send">Пожаловаться</button>
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
        <aside className={gruv ? "pane irc" : "rail"}>
          <div className="tabs" role="tablist" aria-label="Панели комнаты">
            <button type="button" role="tab" aria-selected={railTab === "chat"} className={railTab === "chat" ? "tab on" : "tab"} onClick={() => setRailTab("chat")}>Чат <span className="n">{live.state.messages.length}</span></button>
            <button type="button" role="tab" aria-selected={railTab === "people"} className={railTab === "people" ? "tab on" : "tab"} onClick={() => setRailTab("people")}>Люди <span className="n">{members.length}</span></button>
            <button type="button" role="tab" aria-selected={railTab === "queue"} className={railTab === "queue" ? "tab on" : "tab"} onClick={() => setRailTab("queue")}>Очередь <span className="n">{queue.length}</span></button>
            {unread > 0 ? (
              <button type="button" className="unread-anchor" data-testid="unread-anchor" onClick={jumpToUnread}>
                К новым · {unread}
              </button>
            ) : null}
          </div>
          {railTab === "chat" ? (
            <>
              <div className="log" data-testid="chat-log" ref={chatRef}>
                {live.state.messages.length === 0 ? <p className="rail-empty">Пока тихо. Напишите первым.</p> : null}
                {live.state.messages.map((message, index) => {
                  const mine = message.userId === live.selfId;
                  const hue = personHue(message.userId);
                  return (
                    <Fragment key={message.id}>
                      {index === firstUnreadIndex && unread > 0 ? (
                        <span className="unread-divider" data-testid="unread-divider">Непрочитанные</span>
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
                        </div>
                      </div>
                    </Fragment>
                  );
                })}
              </div>
              <div className="quick">{Object.values(emojiCategories).flat().slice(0, 7).map((emoji) => <button key={emoji} type="button" onClick={() => live.sendFloat(emoji)} aria-label={`Реакция ${emoji}`}>{emoji}</button>)}</div>
              {emojiOpen ? <EmojiPicker recent={recentEmojis} onPick={pickEmoji} /> : null}
              <form className="comp" onSubmit={sendChat}>
                <button
                  type="button"
                  className="emoji-toggle"
                  data-testid="emoji-picker-toggle"
                  aria-expanded={emojiOpen}
                  aria-label="Эмодзи"
                  onClick={() => setEmojiOpen((value) => !value)}
                >
                  😊
                </button>
                <input data-testid="chat-input" value={draft} onChange={(event) => { setDraft(event.target.value); live.sendTyping(); }} placeholder="Написать в комнату…" aria-label="Сообщение" />
                <button type="submit" className="send" data-testid="chat-send" aria-label={t("chat.send")}>➤</button>
              </form>
            </>
          ) : null}
          {railTab === "people" ? (
            <div className="log" data-testid="rail-people">
              <div className="rail-section">
                <h4>Ведущий</h4>
                {members.filter((member) => member.role === "host").map((member) => {
                  const channel = live.state.voice.find((item) => item.userId === member.userId);
                  return (
                    <button key={member.userId} type="button" className="rail-member" onClick={() => setProfile({ userId: member.userId, displayName: member.displayName, role: member.role })}>
                      <span className={`av p-${personHue(member.userId)}`}>{initials(member.displayName)}</span>
                      <div><b>{member.displayName}</b><small>{channel?.speaking ? "говорит" : channel ? "в голосе" : "в комнате"}</small></div>
                      <span className="mini">Профиль</span>
                    </button>
                  );
                })}
              </div>
              <div className="rail-section">
                <h4>В комнате · {members.length}</h4>
                {members.map((member) => {
                  const channel = live.state.voice.find((item) => item.userId === member.userId);
                  return (
                    <button key={member.userId} type="button" className="rail-member" onClick={() => setProfile({ userId: member.userId, displayName: member.displayName, role: member.role })}>
                      <span className={`av p-${personHue(member.userId)}`}>{initials(member.displayName)}</span>
                      <div><b>{member.displayName}{member.userId === live.selfId ? " · вы" : ""}</b><small>{channel ? (channel.muted ? "микрофон выкл" : "в голосе") : "смотрит"}</small></div>
                      <span className="mini">Профиль</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}
          {railTab === "queue" ? (
            <div className="log" data-testid="rail-queue">
              <div className="rail-section">
                <h4>Сейчас</h4>
                {room.nowPlaying ? <div className="rail-queue-item"><b>{room.nowPlaying.title}</b><small>{clock(live.positionMs)} / {durationLabel(room.nowPlaying.durationMs)}</small></div> : <div className="rail-empty">Ничего не играет</div>}
              </div>
              <div className="rail-section">
                <h4>Далее · {queue.length}</h4>
                {queue.length === 0 ? <div className="rail-empty">Очередь пуста</div> : queue.map((item) => (
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
                {panel === "chat" ? "Чат" : panel === "members" ? "Люди" : "Очередь"}
              </button>
            ))}
            <button type="button" className="mobile-sheet-close" data-testid="mobile-sheet-close" onClick={() => setSheet(false)}>×</button>
          </div>
          {sheet ? (
            <div className="mobile-sheet-panel" data-testid="mobile-sheet-panel" data-panel={mobilePanel}>
              {mobilePanel === "chat" ? (
                <div className="log" data-testid="mobile-sheet-chat">
                  {live.state.messages.length === 0 ? <p className="tr-empty">Пока пусто</p> : null}
                  {live.state.messages.slice(-12).map((message) => (
                    <div key={message.id} className="m"><div className="bu"><div className="n">{message.displayName}</div>{message.body}</div></div>
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
                <ol className="tr-queue mobile-sheet-queue" data-testid="mobile-sheet-queue">
                  {sheetItems.length === 0 ? <li className="empty">Очередь пуста</li> : null}
                  {sheetItems.map((item) => (
                    <li key={item.id}>
                      <b>{item.title}</b>
                      <small>{item.id === room.nowPlaying?.id ? "сейчас" : item.provider}</small>
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
            setRoomTitle(next.title);
            setRoomHideReactions(Boolean(next.hideReactions));
          }}
        />
      ) : null}
    </div>
  );
}
