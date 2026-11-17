import { emojiCategories, historyLabel, shouldHoldForReady, type RoomLayout } from "@lume/contracts";
import { useEffect, useState, type FormEvent } from "react";
import { apiUrl } from "../api/client.js";
import { useI18n } from "../i18n/context.js";
import { PlayerPanel } from "../layout/panels/PlayerPanel.js";
import { useRoomActions } from "../room/live.js";
import { useVoiceChannel } from "../voice/useVoiceChannel.js";
import { posterFor } from "./posters.js";
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
  const [draft, setDraft] = useState("");
  const [command, setCommand] = useState("");
  const [sheet, setSheet] = useState(false);
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
      void fetch(`${apiUrl}/me/discovery`, { headers: { authorization: `Bearer ${token}` } })
        .then((response) => response.json())
        .then((payload: { items?: Array<{ title: string | null; url: string }> }) => setTip(payload.items?.[0]?.title ?? payload.items?.[0]?.url ?? null))
        .catch(() => setTip(null));
    }
    const onResize = () => setNarrow(window.innerWidth < 800);
    window.addEventListener("resize", onResize);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", onResize);
    };
  }, []);
  if (!live) return null;
  const room = live.state.room;
  const members = live.state.members;
  const playing = live.state.playback.status === "playing";
  const queue = live.state.queue.filter((item) => item.id !== room.nowPlaying?.id);
  const gruv = style === "gruvbox";
  const waiting = shouldHoldForReady(true, live.state.viewers.filter((viewer) => viewer.phase === "buffering").length);
  const status = waiting ? "Ждём готовности" : `${playing ? t("room.syncPlay") : t("room.syncPause")} ${clock(live.positionMs)}`;

  function addUrl(event: FormEvent) {
    event.preventDefault();
    const next = url.trim();
    if (!next) return;
    live?.addQueue(next);
    void fetch(`${apiUrl}/video/detect`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ url: next }) })
      .then((response) => response.json())
      .then((payload: { source?: string | null }) => setDetected(payload.source ?? "unknown"))
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
            <div className="bufs"><span className="buf on"><span className="nr">1</span><b data-testid="room-title">{room.title}</b></span></div>
            <span className="hash" data-testid="room-code">{room.code}</span>
          </>
        ) : (
          <>
            <button type="button" className="logo" onClick={onLeave}><i />lume</button>
            <div className="crumb"><b data-testid="room-title">{room.title}</b><span className="slate mono" data-testid="room-code">{room.code}</span></div>
            <span className="spacer" />
            <div className="sync session-dock"><span className="dot" /><b>{synced ? "Синхронно" : "…"}</b> <span data-testid="playback-status">{status}</span></div>
            <div className="who">
              <div className="stack">
                {members.slice(0, 4).map((member) => (
                  <span key={member.userId} className={`av sm p-${personHue(member.userId)}`}>{initials(member.displayName)}</span>
                ))}
              </div>
              смотрят
            </div>
            <button type="button" className="btn btn-outline">Позвать</button>
          </>
        )}
      </header>
      <div className="body">
        <section className="player-col">
          <div className="stage-card stage-root">
            {room.nowPlaying ? <div className="top-ov"><span className="pill">{room.nowPlaying.title}</span></div> : null}
            <PlayerPanel bare aspect={layout.videoAspect} synced={synced} onAspect={(videoAspect) => onLayout({ ...layout, videoAspect })} />
            <div className="flo">
              {live.floats.slice(-2).map((float) => (
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
            {narrow ? <button type="button" className="sheet-tab" onClick={() => setSheet((value) => !value)}>Очередь</button> : null}
            <div className="card voice-card">
              <div className="ct">Голосовой {voice.enabled === false ? <small data-testid="voice-disabled">{t("voice.disabled")}</small> : <small>{voice.joined ? "в эфире" : ""}</small>}</div>
              <div className="voice">
                <ul className="voice" data-testid="member-list">
                  {members.map((member) => (
                    <li key={member.userId} className="vp">
                      <span className={`av p-${personHue(member.userId)}`}>{initials(member.displayName)}</span>
                      {member.displayName}
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
                    <li key={item.id} className="qi">
                      <div className="im" style={{ backgroundImage: `url(${posterFor(item.id, item.thumbnailUrl)})` }} />
                      <b>{item.title}</b>
                    </li>
                  ))}
                </ol>
                <form className="qi add" onSubmit={addUrl}>
                  <input data-testid="queue-input" value={url} onChange={(event) => setUrl(event.target.value)} placeholder="Добавить ссылку" aria-label={t("queue.url")} />
                  {detected ? <small>{detected}</small> : null}
                  <button type="submit" data-testid="queue-add">{t("queue.add")}</button>
                </form>
              </div>
              {live.canControl ? <button type="button" data-testid="queue-next" onClick={live.playNext}>{t("queue.next")}</button> : null}
              <form onSubmit={(event) => {
                event.preventDefault();
                const data = new FormData(event.currentTarget);
                const reason = String(data.get("reason") ?? "").trim();
                const target = members[0]?.userId;
                if (!reason || !target) return;
                void fetch(`${apiUrl}/reports`, { method: "POST", headers: { authorization: `Bearer ${live.accessToken}`, "content-type": "application/json" }, body: JSON.stringify({ targetKind: "user", targetId: target, roomId: room.id, reason }) });
                event.currentTarget.reset();
              }}>
                <input name="reason" placeholder="Жалоба" aria-label="report" />
                <button type="submit">Пожаловаться</button>
              </form>
            </div>
          </div>
        </section>
        <aside className={gruv ? "pane irc" : "rail"}>
          <div className="tabs">
            <span className="tab on">Чат <span className="n">{live.state.messages.length}</span></span>
            <span className="tab">Люди <span className="n">{members.length}</span></span>
            <span className="tab">Очередь <span className="n">{queue.length}</span></span>
          </div>
          <div className="log" data-testid="chat-log">
            {live.state.messages.map((message) => {
              const mine = message.userId === live.selfId;
              const hue = personHue(message.userId);
              return (
                <div key={message.id} className={mine ? "m mine" : "m"}>
                  {mine ? null : <span className={`av p-${hue}`}>{initials(message.displayName)}</span>}
                  <div className="bu">
                    {mine ? null : <div className={`n p-${hue}`}>{message.displayName}</div>}
                    {message.body}
                  </div>
                </div>
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
      {narrow && sheet ? <div className="sheet-open">{queue.map((item) => <p key={item.id}>{item.title}</p>)}</div> : null}
    </div>
  );
}
