import { emojiCategories, getNextRoomPanel, historyLabel, layoutAspectGroup, oEmbedEndpoint, planPlayback, roomSheetPanels, shouldHoldForReady, withLayoutPreset, withVideoAspect, type RoomLayout, type RoomSheetPanel } from "@lume/contracts";
import { Fragment, useEffect, useRef, useState, type CSSProperties, type FormEvent } from "react";
import { apiUrl } from "../api/client.js";
import { useI18n } from "../i18n/context.js";
import { PlayerPanel } from "../layout/panels/PlayerPanel.js";
import { useRoomActions } from "../room/live.js";
import { useVoiceChannel } from "../voice/useVoiceChannel.js";
import { posterFor } from "./posters.js";
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
  const [history, setHistory] = useState<Array<{ id: string; title: string | null }>>([]);
  const [tip, setTip] = useState<string | null>(null);
  const [iceUrl, setIceUrl] = useState<string | null>(null);
  const [voiceSeconds, setVoiceSeconds] = useState(0);
  const [permissions, setPermissions] = useState({ canChat: true, canQueue: true, canSpeak: true, canReact: true, canSeek: false, canInvite: true });
  const [playerError, setPlayerError] = useState<string | null>(null);
  const [hideOther, setHideOther] = useState(false);
  const [draft, setDraft] = useState("");
  const [command, setCommand] = useState("");
  const [sheet, setSheet] = useState(false);
  const [mobilePanel, setMobilePanel] = useState<RoomSheetPanel>("chat");
  const [seenCount, setSeenCount] = useState(0);
  const seenReady = useRef(false);
  const chatRef = useRef<HTMLDivElement>(null);
  const [profile, setProfile] = useState<InRoomProfile | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [roomTitle, setRoomTitle] = useState<string | null>(null);
  const [roomHideReactions, setRoomHideReactions] = useState(false);
  useEffect(() => {
    const observer = new MutationObserver(() => {
      setStyle(document.documentElement.dataset.style === "gruvbox" ? "gruvbox" : "cinema");
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-style"] });
    const room = live?.state.room.id;
    const token = live?.accessToken;
    if (room && token) {
      void fetch(`${apiUrl}/rooms/${room}/history`, { headers: { authorization: `Bearer ${token}` } })
        .then((response) => response.json())
        .then((payload: { history?: Array<{ id: string; title: string | null }> }) => setHistory(payload.history ?? []))
        .catch(() => setHistory([]));
      void fetch(`${apiUrl}/rooms/${room}/settings`, { headers: { authorization: `Bearer ${token}` } })
        .then((response) => response.json())
        .then((payload: RoomSettings) => {
          setRoomTitle(payload.title);
          setRoomHideReactions(Boolean(payload.hideReactions));
        })
        .catch(() => undefined);
      void fetch(`${apiUrl}/me/discovery`, { headers: { authorization: `Bearer ${token}` } })
        .then((response) => response.json())
        .then((payload: { items?: Array<{ title: string | null; url: string }> }) => setTip(payload.items?.[0]?.title ?? payload.items?.[0]?.url ?? null))
        .catch(() => setTip(null));
    }
    void fetch(`${apiUrl}/ice-servers`).then((response) => response.json()).then((payload: { iceServers?: Array<{ urls?: string }> }) => setIceUrl(payload.iceServers?.[0]?.urls ?? null)).catch(() => setIceUrl(null));
    if (token) {
      void fetch(`${apiUrl}/me`, { headers: { authorization: `Bearer ${token}` } })
        .then((response) => response.json())
        .then((payload: { hideOtherReactions?: boolean }) => setHideOther(Boolean(payload.hideOtherReactions)))
        .catch(() => setHideOther(false));
    }
    const onResize = () => setNarrow(window.innerWidth < 800);
    window.addEventListener("resize", onResize);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", onResize);
    };
  }, []);
  useEffect(() => {
    if (!voice.joined) return;
    const timer = window.setInterval(() => setVoiceSeconds((value) => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, [voice.joined]);
  useEffect(() => {
    if (!live || seenReady.current) return;
    seenReady.current = true;
    setSeenCount(live.state.messages.length);
  }, [live?.state.messages.length]);
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
  const queue = live.state.queue.filter((item) => item.id !== room.nowPlaying?.id);
  const sheetItems = room.nowPlaying ? [room.nowPlaying, ...queue] : queue;
  const gruv = style === "gruvbox";
  const bufferingCount = live.state.viewers.filter((viewer) => viewer.phase === "buffering").length;
  const waiting = shouldHoldForReady(bufferingCount > 0, bufferingCount);
  const status = waiting ? "Ждём готовности" : `${playing ? t("room.syncPlay") : t("room.syncPause")} ${clock(live.positionMs)}`;
  const unread = Math.max(0, live.state.messages.length - seenCount);
  const firstUnreadIndex = Math.min(seenCount, live.state.messages.length);

  function jumpToUnread() {
    const anchor = chatRef.current?.querySelector<HTMLElement>('[data-unread="true"]');
    anchor?.scrollIntoView({ block: "center" });
    setSeenCount(live?.state.messages.length ?? 0);
  }

  function addUrl(event: FormEvent) {
    event.preventDefault();
    const next = url.trim();
    if (!next) return;
    live?.addQueue(next);
    void fetch(`${apiUrl}/video/detect`, { method: "POST", headers: { authorization: `Bearer ${live?.accessToken}`, "content-type": "application/json" }, body: JSON.stringify({ url: next }) })
      .then((response) => response.json())
      .then((payload: { source?: string | null; plan?: { type?: string } }) => setDetected(`${payload.source ?? "unknown"}${payload.plan?.type ? `:${payload.plan.type}` : ""}`))
      .catch(() => setDetected(null));
    setUrl("");
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
            <button type="button" className="logo" onClick={onLeave}><i />lume</button>
            <div className="crumb"><b data-testid="room-title">{roomTitle ?? room.title}</b><span className="slate mono" data-testid="room-code">{room.code}</span></div>
            <span className="spacer" />
            <div className="sync sync-pill"><span className="dot" /><b>{synced ? "Синхронно" : "…"}</b> <span data-testid="playback-status">{status}</span>
              <button type="button" data-testid="sync-incident" onClick={() => void fetch(`${apiUrl}/rooms/${room.id}/sync-incident`, { method: "POST", headers: { authorization: `Bearer ${live.accessToken}`, "content-type": "application/json" }, body: JSON.stringify({ note: "player drift" }) })}>Сбой</button>
              <button type="button" data-testid="report-buffering" onClick={() => live.reportViewer("buffering")}>Буфер</button>
              <button type="button" data-testid="hide-other-reactions" onClick={() => {
                const next = !hideOther;
                void fetch(`${apiUrl}/me`, { method: "PATCH", headers: { authorization: `Bearer ${live.accessToken}`, "content-type": "application/json" }, body: JSON.stringify({ hideOtherReactions: next }) })
                  .then(() => fetch(`${apiUrl}/me`, { headers: { authorization: `Bearer ${live.accessToken}` } }))
                  .then((response) => response.json())
                  .then((payload: { hideOtherReactions?: boolean }) => setHideOther(Boolean(payload.hideOtherReactions)));
              }}>Скрыть чужие</button>
              {live.state.self.role === "host" ? (
                <button type="button" data-testid="room-settings-open" onClick={() => setSettingsOpen(true)}>Настройки</button>
              ) : null}
            </div>
            <div className="who">
              <div className="stack">
                {members.slice(0, 4).map((member) => (
                  <span key={member.userId} className={`av sm p-${personHue(member.userId)}`}>{initials(member.displayName)}</span>
                ))}
              </div>
              смотрят
            </div>
            <div className="layout-switch" role="group" aria-label="layout presets">
              <button type="button" className={layout.preset === "theater" ? "btn btn-outline on" : "btn btn-outline"} data-testid="layout-theater" onClick={() => onLayout(withLayoutPreset(layout, "theater"))}>Обычный</button>
              <button type="button" className={layout.preset === "enlarged" ? "btn btn-outline on" : "btn btn-outline"} data-testid="layout-enlarged" onClick={() => onLayout(withLayoutPreset(layout, "enlarged"))}>Шире</button>
              <button type="button" className={layout.preset === "immersive" ? "btn btn-outline on" : "btn btn-outline"} data-testid="layout-immersive" onClick={() => onLayout(withLayoutPreset(layout, "immersive"))}>Погружение</button>
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
                <button type="button" data-testid="player-retry" onClick={() => void fetch(`${apiUrl}/rooms/${room.id}/recovery`, { method: "POST", headers: { authorization: `Bearer ${live.accessToken}`, "content-type": "application/json" }, body: JSON.stringify({ action: "retry", url: playerError }) })}>Обновить ссылку</button>
                <button type="button" data-testid="player-open" onClick={() => { window.open(playerError, "_blank", "noopener"); void fetch(`${apiUrl}/rooms/${room.id}/recovery`, { method: "POST", headers: { authorization: `Bearer ${live.accessToken}`, "content-type": "application/json" }, body: JSON.stringify({ action: "open", url: playerError }) }); }}>Открыть на платформе</button>
                <form onSubmit={(event) => { event.preventDefault(); const next = String(new FormData(event.currentTarget).get("url") ?? ""); if (!next) return; live.addQueue(next); setPlayerError(null); void fetch(`${apiUrl}/rooms/${room.id}/recovery`, { method: "POST", headers: { authorization: `Bearer ${live.accessToken}`, "content-type": "application/json" }, body: JSON.stringify({ action: "replace", url: next }) }); }}>
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
          <div className="ctl">
            <button
              type="button"
              className="play"
              data-testid="playback-play"
              onClick={() => live.setPlayback(playing ? "pause" : "play", live.positionMs)}
            >
              {playing ? "II" : "▶"}
            </button>
            <span className="time">{clock(live.positionMs)} <span>/ 02:03:10</span></span>
            <div className="tlw">
              <div className="track"><div className="buf" /><div className="prog" style={{ width: "32%" }} /></div>
              <div className="head" style={{ left: "32%" }} />
              {members.slice(0, 2).map((member, index) => (
                <span key={member.userId} className="fh" style={{ left: `${40 + index * 8}%` }}>
                  <span className={`av p-${personHue(member.userId)}`}>{initials(member.displayName).slice(0, 1)}</span>
                </span>
              ))}
            </div>
            <span className="pill mono">1×</span>
            <span className="pill">1080p</span>
          </div>
          <div className={narrow ? "sheet" : "low"}>
            {narrow ? <button type="button" className="sheet-tab" data-testid="mobile-sheet-toggle" onClick={() => setSheet((value) => !value)}>Панели</button> : null}
            <div className="card voice-card">
              <div className="ct">Голосовой {voice.enabled === false ? <small data-testid="voice-disabled">{t("voice.disabled")}</small> : <small>{voice.joined ? `в эфире ${voiceSeconds}с` : iceUrl}</small>}</div>
              <div className="voice">
                <ul className="voice" data-testid="member-list">
                  {members.map((member) => (
                    <li key={member.userId}>
                      <button
                        type="button"
                        className="vp"
                        data-testid={`member-${member.userId}`}
                        onClick={() => setProfile({ userId: member.userId, displayName: member.displayName, role: member.role })}
                      >
                        <span className={`av p-${personHue(member.userId)}`}>{initials(member.displayName)}</span>
                        {member.displayName}
                      </button>
                    </li>
                  ))}
                </ul>
                <div className="vbtns">
                  <button type="button" className="vbtn" onClick={() => void voice.join()}>Войти</button>
                <button type="button" className="vbtn" onClick={() => void navigator.mediaDevices?.getUserMedia({ audio: true }).then((stream) => stream.getTracks().forEach((track) => track.stop()))}>Тест</button>
                <button type="button" className="vbtn" onClick={() => void voice.toggleMute()}>{voice.muted ? "Выкл" : "Вкл"}</button>
                  <button type="button" className="vbtn leave" onClick={() => void voice.leave()}>✕</button>
                </div>
              </div>
            </div>
            <div className="card queue-card">
              <div className="ct">Дальше в очереди <small>{queue.length}</small>{historyLabel(history.length) ? <small>{historyLabel(history.length)}</small> : null}{tip ? <small>ещё: {tip}</small> : null}{live.skip.needed > 1 ? <span className="pill">Пропуск {live.skip.votes} из {live.skip.needed}</span> : null}</div>
              <div className="q">
                <ol className="tr-queue q">
                  {queue.slice(0, 2).map((item) => (
                    <li key={item.id} className="qi" data-testid="queue-item" data-url={item.url} data-provider={item.provider}>
                      <div className="im" style={{ backgroundImage: `url(${posterFor(item.id, item.thumbnailUrl)})` }} />
                      <b>{item.title}</b>
                    </li>
                  ))}
                </ol>
                <form className="qi add" onSubmit={addUrl}>
                  <input data-testid="queue-input" value={url} onChange={(event) => setUrl(event.target.value)} placeholder="Добавить ссылку" aria-label={t("queue.url")} />
                  {detected ? <small>{detected}</small> : null}
                  {detected === "youtube" ? <small>{oEmbedEndpoint({ provider: "youtube", externalId: "video", url: url || "https://youtu.be/video", titleHint: "video" })}</small> : null}
                  {url && planPlayback({ url, premium: false }).type === "error" ? <small>Нужен премиум</small> : null}
                  <button type="submit" data-testid="queue-add">{t("queue.add")}</button>
                </form>
              </div>
              {live.canControl ? (
                <form data-testid="room-defaults" onSubmit={(event) => {
                  event.preventDefault();
                  void fetch(`${apiUrl}/rooms/${room.id}/defaults`, {
                    method: "POST",
                    headers: { authorization: `Bearer ${live.accessToken}`, "content-type": "application/json" },
                    body: JSON.stringify(permissions),
                  });
                }}>
                  {(Object.keys(permissions) as Array<keyof typeof permissions>).map((key) => (
                    <label key={key}>
                      <input data-testid={`perm-${key}`} type="checkbox" checked={permissions[key]} onChange={(event) => setPermissions((current) => ({ ...current, [key]: event.target.checked }))} />
                      {key}
                    </label>
                  ))}
                  <button type="submit" data-testid="perm-save">Права</button>
                </form>
              ) : null}
              {live.canControl ? <button type="button" data-testid="queue-next" onClick={live.playNext}>{t("queue.next")}</button> : null}
              <form data-testid="report-form" onSubmit={(event) => {
                event.preventDefault();
                const data = new FormData(event.currentTarget);
                const reason = String(data.get("reason") ?? "").trim();
                const target = String(data.get("target") ?? "");
                if (!reason || !target || target === live.selfId) return;
                void fetch(`${apiUrl}/reports`, { method: "POST", headers: { authorization: `Bearer ${live.accessToken}`, "content-type": "application/json" }, body: JSON.stringify({ targetKind: "user", targetId: target, roomId: room.id, reason }) });
                event.currentTarget.reset();
              }}>
                <select data-testid="report-target" name="target" aria-label="report target">
                  {members.filter((member) => member.userId !== live.selfId).map((member) => (
                    <option key={member.userId} value={member.userId}>{member.displayName}</option>
                  ))}
                </select>
                <input data-testid="report-reason" name="reason" placeholder="Жалоба" aria-label="report" />
                <button type="submit" data-testid="report-send">Пожаловаться</button>
              </form>
            </div>
          </div>
        </section>
        <aside className={gruv ? "pane irc" : "rail"}>
          <div className="tabs">
            <span className="tab on">Чат <span className="n">{live.state.messages.length}</span></span>
            <span className="tab">Люди <span className="n">{members.length}</span></span>
            <span className="tab">Очередь <span className="n">{queue.length}</span></span>
            {unread > 0 ? (
              <button type="button" className="unread-anchor" data-testid="unread-anchor" onClick={jumpToUnread}>
                К новым · {unread}
              </button>
            ) : null}
          </div>
          <div className="log" data-testid="chat-log" ref={chatRef}>
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
          <div className="quick">{Object.values(emojiCategories).flat().map((emoji) => <button key={emoji} type="button" onClick={() => live.sendFloat(emoji)}>{emoji}</button>)}</div>
          <form className="comp" onSubmit={sendChat}>
            <input data-testid="chat-input" value={draft} onChange={(event) => { setDraft(event.target.value); live.sendTyping(); }} placeholder="Написать в комнату…" />
            <button type="submit" className="send" data-testid="chat-send">{t("chat.send")}</button>
          </form>
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
