import { canControlPlayback, positionAt, sessionSoftWarn, type RoomLayout as RoomLayoutModel } from "@lume/contracts";
import { useEffect, useState } from "react";
import { useI18n } from "../i18n/context.js";
import { RoomLayoutView } from "../layout/RoomLayout.js";
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
  const clock = live.clockOffset || offset;
  const playback = live.state?.playback;

  useEffect(() => {
    const timer = window.setInterval(() => setTick(Date.now()), 250);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!playback) {
      return;
    }
    setOffset(playback.serverTimeMs - Date.now());
  }, [playback?.version, playback?.status, playback?.serverTimeMs, playback?.anchorPositionMs]);

  if (!live.state) {
    return (
      <section className="tr-room">
        <p className="tr-empty">{live.error ?? t("realtime.connecting")}</p>
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
        floats: live.floats,
        voteSkip: live.voteSkip,
        sendTyping: live.sendTyping,
        sendFloat: live.sendFloat,
      }}
    >
      <section className="tr-room">
        <div className="tr-room-bar">
          <div>
            <strong data-testid="room-title">{live.state.room.title}</strong>
            <span>
              {t("room.code")} <b data-testid="room-code">{live.state.room.code}</b>
            </span>
          </div>
          <button type="button" className="tr-text-button" onClick={onLeave}>
            {t("room.leave")}
          </button>
        </div>
        {warn ? <p className="tr-banner">{t("room.warnSession")}</p> : null}
        {live.error ? <p className="tr-note">{live.error}</p> : null}
        <RoomLayoutView layout={layout} synced={live.status === "online"} onLayout={onLayout} />
      </section>
    </RoomProvider>
  );
}
