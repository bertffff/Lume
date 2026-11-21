import { canControlPlayback, playerShortcut, positionAt, sessionSoftWarn, type RoomLayout as RoomLayoutModel } from "@lume/contracts";
import { useEffect, useState } from "react";
import { useI18n } from "../i18n/context.js";
import { RoomStage } from "../design/RoomStage.js";
import { RoomProvider } from "../room/live.js";
import { Modal } from "../ui/index.js";
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
  const [refreshed, setRefreshed] = useState<{ id: string; url: string } | null>(null);

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
      <section className="app-room">
        <p className="empty-note">{live.error === "kicked" ? "Вас удалили из комнаты" : live.error ? "Не удалось подключиться к комнате" : t("realtime.connecting")}</p>
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
  const nowPlaying = live.state.room.nowPlaying;
  const state =
    refreshed && nowPlaying?.id === refreshed.id
      ? { ...live.state, room: { ...live.state.room, nowPlaying: { ...nowPlaying, url: refreshed.url } } }
      : live.state;

  return (
    <RoomProvider
      value={{
        state,
        positionMs,
        offsetMs: clock,
        canControl: canControlPlayback(live.state.self.role),
        selfId,
        sendChat: live.sendChat,
        sendImage: live.sendImage,
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
        {warn ? <p className="app-banner">{t("room.warnSession")}</p> : null}
        {live.error ? (
          <p className="app-note" data-testid="room-error" data-code={live.error}>
            {live.error === "kicked" ? "Вас удалили из комнаты" : "Соединение с комнатой прервано"}
          </p>
        ) : null}
        <RoomStage layout={layout} synced={live.status === "online"} onLayout={onLayout} onLeave={onLeave} onRefreshed={setRefreshed} />
        <Modal open={helpOpen} title={t("room.hotkeys")} onClose={() => setHelpOpen(false)}>
          <p><b>J / L</b> — {t("room.hotkeysSeek")}</p>
          <p><b>K</b> — {t("room.hotkeysPause")}</p>
          <p><b>?</b> — {t("room.hotkeysHelp")}</p>
        </Modal>
      </>
    </RoomProvider>
  );
}
