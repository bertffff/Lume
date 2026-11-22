import { canControlPlayback, playerShortcut, positionAt, sessionSoftWarn, type RoomLayout as RoomLayoutModel } from "@lume/contracts";
import { useEffect, useState } from "react";
import { useI18n } from "../i18n/context.js";
import { RoomStage } from "../design/RoomStage.js";
import { RoomProvider } from "../room/live.js";
import { Modal } from "../ds/index.js";
import { State } from "../ds/index.js";
import styles from "./RoomScreen.module.css";
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
  const self = live.state?.members.find((member) => member.userId === selfId) ?? live.state?.self;
  const canControl = canControlPlayback(self?.role ?? "viewer");
  const [refreshed, setRefreshed] = useState<{ roomId: string; id: string; url: string } | null>(null);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (event.key === "Escape") {
        setHelpOpen(false);
        return;
      }
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey || target?.closest("input, textarea, select, [contenteditable], [role=dialog]")) return;
      const action = playerShortcut(event.key, Boolean(live.state?.room.nowPlaying) && canControl);
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
  }, [live, canControl]);

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
      <main className={styles.connecting} id="app-main" tabIndex={-1}>
        <State kind={live.error ? "error" : "empty"} title={live.error === "kicked" ? t("room.kicked") : live.error ? t("room.connectFailed") : t("realtime.connecting")} />
      </main>
    );
  }

  const anchor = {
    status: live.state.playback.status,
    anchorPositionMs: live.state.playback.anchorPositionMs,
    anchorServerTimeMs: live.state.playback.anchorServerTimeMs,
    version: live.state.playback.version,
    updatedBy: live.state.playback.updatedBy,
  };
  const positionMs = Math.max(0, Math.round(positionAt(anchor, tick + clock)));
  const warn = sessionSoftWarn(Date.parse(live.state.room.createdAt), Date.now());
  const nowPlaying = live.state.room.nowPlaying;
  const stateWithMedia =
    refreshed && nowPlaying?.id === refreshed.id && refreshed.roomId === live.state.room.id
      ? { ...live.state, room: { ...live.state.room, nowPlaying: { ...nowPlaying, url: refreshed.url } } }
      : live.state;
  const state = self ? { ...stateWithMedia, self: { role: self.role, muted: self.muted } } : stateWithMedia;

  return (
    <RoomProvider
      value={{
        state,
        positionMs,
        offsetMs: clock,
        canControl,
        selfId,
        sendChat: live.sendChat,
        sendImage: live.sendImage,
        react: live.react,
        addQueue: live.addQueue,
        reloadHistory: live.reloadHistory,
        removeQueueItem: live.removeQueueItem,
        moveQueueItem: live.moveQueueItem,
        playQueueItem: live.playQueueItem,
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
        <RoomStage key={state.room.id} layout={layout} synced={live.status === "online"} onLayout={onLayout} onLeave={onLeave}
          onRefreshed={(next) => setRefreshed({ ...next, roomId: state.room.id })}
          notices={<>
            {warn && <p className={styles.banner}>{t("room.warnSession")}</p>}
            {live.error && <p className={styles.note} role="status" data-testid="room-error" data-code={live.error}>
              {live.error === "kicked" ? t("room.kicked") : t("room.connectionLost")}
            </p>}
          </>} />
        <Modal open={helpOpen} size="sm" title={t("room.hotkeys")} onClose={() => setHelpOpen(false)}>
          <p className={styles.hotkey}><kbd>J / L</kbd> {t("room.hotkeysSeek")}</p>
          <p className={styles.hotkey}><kbd>K</kbd> {t("room.hotkeysPause")}</p>
          <p className={styles.hotkey}><kbd>?</kbd> {t("room.hotkeysHelp")}</p>
        </Modal>
      </>
    </RoomProvider>
  );
}
