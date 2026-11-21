import { AudioLines, LogOut, Mic, MicOff, Volume2, VolumeX } from "lucide-react";
import type { LiveRoom } from "../realtime/useRoomChannel.js";
import { useI18n } from "../i18n/context.js";
import type { useVoiceChannel } from "../voice/useVoiceChannel.js";
import { initials, personHue } from "./theme.js";

function voiceErrorKey(code: string) {
  if (code === "livekit_disabled") return "voice.errorDisabled";
  if (code === "mic_denied") return "voice.errorMic";
  if (code === "forbidden") return "voice.errorForbidden";
  return "voice.errorGeneric";
}

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
    <section className="room-card room-voice" data-testid="voice-card">
      <div className="room-card-heading">
        <h2><AudioLines aria-hidden="true" />{t("room.voiceTitle")} <small>{presence.length}</small></h2>
        {voice.joined && <small data-testid="voice-session" data-seconds={sharedSeconds} data-start={startedAt ?? ""} data-local-seconds={localSeconds}>{t("room.onAir", { seconds: sharedSeconds })}</small>}
      </div>
      {presence.length > 0 && <ul className="room-speakers" aria-label={t("room.voiceTitle")}>
        {presence.map((entry) => {
          const member = members.find((item) => item.userId === entry.userId);
          if (!member) return null;
          const speaking = entry.speaking && !entry.muted;
          const label = `${member.displayName} · ${speaking ? t("room.speaking") : entry.muted ? t("room.micOff") : t("room.inVoice")}`;
          return <li key={entry.userId} title={label} aria-label={label} data-testid={`voice-member-${entry.userId}`} data-muted={entry.muted} data-speaking={speaking} className={`av p-${personHue(entry.userId)}`}>
            {initials(member.displayName)}
            {entry.muted && <MicOff className="room-muted-icon" aria-hidden="true" data-testid={`member-muted-${entry.userId}`} />}
          </li>;
        })}
      </ul>}
      <div className="room-voice-controls">
        {voice.joined ? (
          <>
            <button type="button" data-testid="voice-toggle" aria-label={voice.muted ? t("room.micOn") : t("room.micOff")} title={voice.muted ? t("room.micOn") : t("room.micOff")} onClick={() => void voice.toggleMute()}>{voice.muted ? <MicOff aria-hidden="true" /> : <Mic aria-hidden="true" />}</button>
            <button type="button" data-testid="voice-deafen" aria-label={voice.deafened ? t("voice.undeafen") : t("voice.deafen")} title={voice.deafened ? t("voice.undeafen") : t("voice.deafen")} onClick={() => void voice.toggleDeafen()}>{voice.deafened ? <VolumeX aria-hidden="true" /> : <Volume2 aria-hidden="true" />}</button>
            <button type="button" data-testid="voice-leave" aria-label={t("voice.leave")} title={t("voice.leave")} onClick={() => void voice.leave()}><LogOut aria-hidden="true" /></button>
          </>
        ) : <button type="button" data-testid="voice-join" disabled={(voice.enabled === false && !voice.stub) || voice.busy} onClick={() => void voice.join()}><Mic aria-hidden="true" />{t("room.voiceJoin")}</button>}
      </div>
      {(voice.error || voice.enabled === false) && (
        <p className="room-empty" role="status" data-testid="voice-fallback" data-stub={voice.stub}>
          {voice.error ? <span data-testid="voice-error" data-code={voice.error}>{t(voiceErrorKey(voice.error))}</span> : t("voice.disabledBanner")}
        </p>
      )}
    </section>
  );
}
