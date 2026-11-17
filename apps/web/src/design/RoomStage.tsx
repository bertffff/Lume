import type { RoomLayout } from "@lume/contracts";
import { useEffect, useState } from "react";
import { useI18n } from "../i18n/context.js";
import { ChatPanel } from "../layout/panels/ChatPanel.js";
import { PlayerPanel } from "../layout/panels/PlayerPanel.js";
import { QueuePanel } from "../layout/panels/QueuePanel.js";
import { VoicePanel } from "../layout/panels/VoicePanel.js";
import { useRoomActions } from "../room/live.js";
import { initials, personHue } from "./theme.js";

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
  const [style, setStyle] = useState(() => (document.documentElement.dataset.style === "gruvbox" ? "gruvbox" : "cinema"));
  const [command, setCommand] = useState("");
  useEffect(() => {
    const observer = new MutationObserver(() => {
      setStyle(document.documentElement.dataset.style === "gruvbox" ? "gruvbox" : "cinema");
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-style"] });
    return () => observer.disconnect();
  }, []);
  const room = live?.state.room;
  const members = live?.state.members ?? [];
  const gruv = style === "gruvbox";
  return (
    <div className={gruv ? "g-room" : "cinema-room"}>
      {gruv ? (
        <header className="tabline">
          <span className="brand"><span className="dot" />LUME</span>
          <div className="bufs">
            <span className="buf on"><span className="nr">1</span>{room?.title}</span>
            <span className="buf"><span className="nr">2</span>#чат</span>
          </div>
        </header>
      ) : (
        <header className="top">
          <button type="button" className="logo" onClick={onLeave}><i className="dot" />lume</button>
          <div className="crumb">
            <b data-testid="room-title">{room?.title}</b>
            <span className="slate mono" data-testid="room-code">{room?.code}</span>
          </div>
          <span className="spacer" />
          <span className="sync"><span className="dot" />{synced ? t("player.synced") : t("realtime.connecting")}</span>
          <span className="who">
            {members.slice(0, 4).map((member) => (
              <span key={member.userId} className={`av sm p-${personHue(member.userId)}`}>{initials(member.displayName)}</span>
            ))}
          </span>
        </header>
      )}
      <div className="body">
        <section className="player-col">
          <div className="stage-card stage-root">
            {gruv ? <div className="pt">%video</div> : null}
            {gruv && room ? <span className="sr-only" data-testid="room-title">{room.title}</span> : null}
            {gruv && room ? <b className="sr-only" data-testid="room-code">{room.code}</b> : null}
            <PlayerPanel aspect={layout.videoAspect} synced={synced} onAspect={(videoAspect) => onLayout({ ...layout, videoAspect })} />
          </div>
          <div className="low">
            <div className="card voice-card"><VoicePanel collapsed={false} collapsible={false} onToggle={() => undefined} /></div>
            <div className="card queue-card"><QueuePanel collapsed={false} collapsible={false} onToggle={() => undefined} /></div>
          </div>
        </section>
        <aside className={gruv ? "pane irc" : "rail"}>
          {gruv ? <div className="pt">#чат</div> : <div className="tabs"><span className="tab on">{t("chat.title")}</span></div>}
          <ChatPanel collapsed={false} collapsible={false} onToggle={() => undefined} />
        </aside>
      </div>
      {gruv ? (
        <footer className="status">
          <span className="sl-mode">ROOM</span>
          <span className="sl-file">{room?.code}</span>
          <form className="sl-mid" onSubmit={(event) => { event.preventDefault(); if (command.trim()) live?.sendChat(command.trim()); setCommand(""); }}>
            <span>:</span>
            <input aria-label="command" value={command} onChange={(event) => setCommand(event.target.value)} />
          </form>
          <span className="sl-keys">{members.length} online</span>
        </footer>
      ) : null}
    </div>
  );
}
