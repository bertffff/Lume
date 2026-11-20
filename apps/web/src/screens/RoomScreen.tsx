import { canControlPlayback, playerShortcut, positionAt, sessionSoftWarn, type RoomLayout as RoomLayoutModel } from "@lume/contracts";
import { useEffect, useState } from "react";
import { useI18n } from "../i18n/context.js";
import { RoomStage } from "../design/RoomStage.js";
import { RoomProvider } from "../room/live.js";
import type { useRoomChannel } from "../realtime/useRoomChannel.js";

export function RoomScreen({
  selfId,
  live,
  layout,
  onLayout,
  onLeave,
}: {
  selfId: string;
  live: ReturnType<typeof useRoomChannel>;
  layout: RoomLayoutModel;
  onLayout: (next: RoomLayoutModel) => void;
  onLeave: () => void;
}) {
  const { t } = useI18n();
  const [tick, setTick] = useState(() => Date.now());
  const [offset, setOffset] = useState(0);
  const [helpOpen, setHelpOpen] = useState(false);
  const clock = live.clockOffset || offset;
  const playback = live.state?.playback;

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;
      if (event.key === "Escape") {
        setHelpOpen(false);
        return;
      }
      const action = playerShortcut(event.key, canControlPlayback(live.state?.self.role ?? "viewer"));
      const anchor = live.state?.playback;
      const position = anchor
        ? Math.max(0, Math.round(positionAt(anchor, Date.now() + (live.clockOffset || 0))))
        : 0;
      if (action === "play") live.setPlayback(anchor?.status === "playing" ? "pause" : "play", position);
      if (action === "back") live.setPlayback("seek", Math.max(0, position - 10_000));
      if (action === "forward") live.setPlayback("seek", position + 10_000);
      if (action === "help") setHelpOpen(true);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [live]);

  useEffect(() => {
    const timer = window.setInterval(() => setTick(Date.now()), 250);
    return () => window.clearInterval(timer);
  }, []);

  const playbackVersion = playback?.version;
  const playbackStatus = playback?.status;
  const playbackServerTimeMs = playback?.serverTimeMs;
  const playbackAnchorPositionMs = playback?.anchorPositionMs;
  useEffect(() => {
    if (playbackServerTimeMs === undefined) {
      return;
    }
    setOffset(playbackServerTimeMs - Date.now());
  }, [playbackVersion, playbackStatus, playbackServerTimeMs, playbackAnchorPositionMs]);

  if (!live.state) {
    return (
      <section className="tr-room">
        <p className="tr-empty">{live.error === "kicked" ? "Вас удалили из комнаты" : live.error ? "Не удалось подключиться к комнате" : t("realtime.connecting")}</p>
      </section>
    );
  }

  const anchor = {
    status: live.state.playback.status,
    anchorPositionMs: live.state.playback.anchorPositionMs,
    anchorServerTimeMs: live.state.playback.anchorServerTimeMs,
    version: live.state.playback.version,
    updatedBy: live.state.playback.updatedBy,
  };
  const positionMs = Math.max(0, Math.round(positionAt(anchor, tick + offset)));
  const warn = sessionSoftWarn(Date.parse(live.state.room.createdAt), Date.now());

  return (
    <RoomProvider
      value={{
        state: live.state,
        positionMs,
        offsetMs: clock,
        canControl: canControlPlayback(live.state.self.role),
        selfId,
        sendChat: live.sendChat,
        react: live.react,
        addQueue: live.addQueue,
        reloadHistory: live.reloadHistory,
        playNext: live.playNext,
        setPlayback: live.setPlayback,
        reportViewer: live.reportViewer,
        accessToken: live.token,
        voiceForce: live.voiceForce,
        joinVoicePresence: live.joinVoicePresence,
        leaveVoicePresence: live.leaveVoicePresence,
        reportVoice: live.reportVoice,
        muteVoices: live.muteVoices,
        disconnectVoice: live.disconnectVoice,
        kick: live.kick,
        mute: live.mute,
        promote: live.promote,
        clockOffset: live.clockOffset,
        skip: live.skip,
        typingName: live.typingName,
        typingNames: live.typingNames,
        heartbeatAt: live.heartbeatAt,
        heartbeat: live.heartbeat,
        floats: live.floats,
        voteSkip: live.voteSkip,
        sendTyping: live.sendTyping,
        sendFloat: live.sendFloat,
      }}
    >
      <>
        {warn ? <p className="tr-banner">{t("room.warnSession")}</p> : null}
        {live.error ? <p className="tr-note">{live.error === "kicked" ? "Вас удалили из комнаты" : "Соединение с комнатой прервано"}</p> : null}
        <RoomStage layout={layout} synced={live.status === "online"} onLayout={onLayout} onLeave={onLeave} />
        {helpOpen ? (
          <div className="overlay docked" role="dialog" aria-modal="true" aria-label="Горячие клавиши">
            <div className="modal">
              <div className="mh"><h2>Горячие клавиши</h2><button type="button" aria-label="Закрыть" onClick={() => setHelpOpen(false)}>×</button></div>
              <div className="mb">
                <p><b>J / L</b> — назад / вперёд на 10 секунд</p>
                <p><b>K</b> — пауза или продолжение</p>
                <p><b>?</b> — эта справка</p>
              </div>
            </div>
          </div>
        ) : null}
      </>
    </RoomProvider>
  );
}
