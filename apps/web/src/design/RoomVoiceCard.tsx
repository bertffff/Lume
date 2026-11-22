import { AudioLines, Volume2, LogOut, Mic, MicOff, VolumeX } from "lucide-react";
import { mediaSrc } from "../api/client.js";
import { Avatar, Button, Icon, IconButton } from "../ds/index.js";
import type { LiveRoom } from "../realtime/useRoomChannel.js";
import { useI18n } from "../i18n/context.js";
import type { useVoiceChannel } from "../voice/useVoiceChannel.js";
import styles from "./RoomVoiceCard.module.css";

function voiceErrorKey(code: string) {
  if (code === "livekit_disabled") return "voice.errorDisabled";
  if (code === "mic_denied") return "voice.errorMic";
  if (code === "forbidden") return "voice.errorForbidden";
  return "voice.errorGeneric";
}

/** Voice at a glance: who is on the line, and the three controls that matter. */
export function RoomVoiceCard({ voice, members, presence, sharedSeconds, startedAt, localSeconds }: {
  voice: ReturnType<typeof useVoiceChannel>;
  members: LiveRoom["members"];
  presence: LiveRoom["voice"];
  sharedSeconds: number;
  startedAt: number | null;
  localSeconds: number;
}) {
  const { t } = useI18n();
  return (
    <section className={styles.root} data-testid="voice-card">
      <div className={styles.heading}>
        <h2 className={styles.title}><Icon icon={AudioLines} size="sm" />{t("room.voiceTitle")} <small className={styles.count}>{presence.length}</small></h2>
        {voice.joined && <small className={styles.onAir} data-testid="voice-session" data-seconds={sharedSeconds} data-start={startedAt ?? ""} data-local-seconds={localSeconds}>{t("room.onAir", { seconds: sharedSeconds })}</small>}
        <div className={styles.controls}>
          {voice.joined ? (
            <>
              <IconButton icon={voice.muted ? MicOff : Mic} size="sm" data-testid="voice-toggle" label={voice.muted ? t("room.micOn") : t("room.micOff")} onClick={() => void voice.toggleMute()} />
              <IconButton icon={voice.deafened ? VolumeX : Volume2} size="sm" data-testid="voice-deafen" label={voice.deafened ? t("voice.undeafen") : t("voice.deafen")} onClick={() => void voice.toggleDeafen()} />
              <IconButton icon={LogOut} size="sm" variant="danger" data-testid="voice-leave" label={t("voice.leave")} onClick={() => void voice.leave()} />
            </>
          ) : <Button size="sm" icon={Mic} data-testid="voice-join" disabled={(voice.enabled === false && !voice.stub) || voice.busy} onClick={() => void voice.join()}>{t("room.voiceJoin")}</Button>}
        </div>
      </div>
        {presence.length > 0 && <ul className={styles.speakers} aria-label={t("room.voiceTitle")}>
          {presence.map((entry) => {
            const member = members.find((item) => item.userId === entry.userId);
            if (!member) return null;
            const speaking = entry.speaking && !entry.muted;
            const label = `${member.displayName} · ${speaking ? t("room.speaking") : entry.muted ? t("room.micOff") : t("room.inVoice")}`;
            return (
              <li key={entry.userId} className={styles.speaker} title={label} aria-label={label} data-testid={`voice-member-${entry.userId}`} data-muted={entry.muted} data-speaking={speaking}>
                <Avatar name={member.displayName} src={mediaSrc(member.avatarUrl)} size="md" speaking={speaking} />
                {entry.muted && <span className={styles.muted} data-testid={`member-muted-${entry.userId}`}><Icon icon={MicOff} size="sm" /></span>}
              </li>
            );
          })}
        </ul>}
      {(voice.error || voice.enabled === false) && (
        <p className={styles.note} role="status" data-testid="voice-fallback" data-stub={voice.stub}>
          {voice.error ? <span data-testid="voice-error" data-code={voice.error}>{t(voiceErrorKey(voice.error))}</span> : t("voice.disabledBanner")}
        </p>
      )}
    </section>
  );
}
