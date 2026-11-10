import { canActOnMember, canModerate } from "@lume/contracts";
import { useI18n } from "../../i18n/context.js";
import { roleLabel, useRoomActions } from "../../room/live.js";
import { readTelegramWebApp } from "../../telegram/types.js";
import { useVoiceChannel } from "../../voice/useVoiceChannel.js";
import { MemberSheet } from "./MemberSheet.js";

export function VoicePanel({
  collapsed,
  collapsible,
  onToggle,
}: {
  collapsed: boolean;
  collapsible: boolean;
  onToggle: () => void;
}) {
  const { t } = useI18n();
  const live = useRoomActions();
  const voice = useVoiceChannel(live?.state.room.id);
  const inTelegram = readTelegramWebApp() !== null;

  if (collapsed) {
    return (
      <button type="button" className="tr-rail" onClick={onToggle}>
        {t("voice.title")}
      </button>
    );
  }

  const members = live?.state.members ?? [];
  const self = live?.state.self.role;
  const voiceIds = new Set((live?.state.voice ?? []).map((member) => member.userId));

  return (
    <section className="tr-panel" aria-label={t("voice.title")}>
      <header className="tr-panel-bar">
        <span>{t("voice.title")}</span>
        {collapsible ? (
          <button type="button" className="tr-text-button" onClick={onToggle}>
            {t("layout.collapse")}
          </button>
        ) : null}
      </header>
      {voice.enabled === false ? (
        <p className="tr-empty" data-testid="voice-disabled">
          {t("voice.disabled")}
        </p>
      ) : null}
      {voice.enabled ? (
        <div className="tr-voice-controls">
          {inTelegram ? <p className="tr-note">{t("voice.micHint")}</p> : null}
          {voice.joined ? (
            <>
              <button type="button" className="tr-text-button" data-testid="voice-mute" onClick={() => void voice.toggleMute()}>
                {voice.muted ? t("voice.unmute") : t("voice.mute")}
              </button>
              <button type="button" className="tr-text-button" data-testid="voice-leave" onClick={() => void voice.leave()}>
                {t("voice.leave")}
              </button>
              {voice.devices.length > 0 ? (
                <label className="tr-check">
                  {t("voice.mic")}
                  <select
                    value={voice.deviceId}
                    onChange={(event) => void voice.pickDevice(event.target.value)}
                  >
                    <option value="">{t("voice.mic")}</option>
                    {voice.devices.map((device) => (
                      <option key={device.deviceId} value={device.deviceId}>
                        {device.label}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
            </>
          ) : (
            <button
              type="button"
              className="tr-primary"
              data-testid="voice-join"
              disabled={voice.busy}
              onClick={() => void voice.join()}
            >
              {t("voice.join")}
            </button>
          )}
          {voice.error === "mic_denied" ? <p className="tr-note">{t("voice.micDenied")}</p> : null}
          {voice.error && voice.error !== "mic_denied" ? <p className="tr-note">{voice.error}</p> : null}
          {self && canModerate(self) && voice.joined ? (
            <button type="button" className="tr-text-button" onClick={() => live?.muteVoices()}>
              {t("voice.muteAll")}
            </button>
          ) : null}
        </div>
      ) : null}
      <MemberSheet />
      <ul className="tr-voice-list" data-testid="member-list">
        {members.length === 0 ? <li className="tr-empty">{t("voice.empty")}</li> : null}
        {members.map((member) => {
          const inVoice = voiceIds.has(member.userId);
          const channel = live?.state.voice.find((item) => item.userId === member.userId);
          return (
            <li key={member.userId}>
              <i className={channel?.speaking ? "is-speaking" : channel?.muted || !inVoice ? "is-quiet" : "is-hot"} />
              <span>
                {member.displayName}
                <em> {roleLabel(member.role, t)}</em>
                {inVoice ? <em> · {t("voice.inVoice")}</em> : null}
              </span>
              {self && member.userId !== live?.selfId && canActOnMember(self, member.role) ? (
                <span className="tr-inline-actions">
                  <button type="button" className="tr-text-button" onClick={() => live?.kick(member.userId)}>
                    {t("member.kick")}
                  </button>
                  <button
                    type="button"
                    className="tr-text-button"
                    onClick={() => live?.mute(member.userId, !member.muted)}
                  >
                    {member.muted ? t("member.unmute") : t("member.mute")}
                  </button>
                  {inVoice ? (
                    <button type="button" className="tr-text-button" onClick={() => live?.disconnectVoice(member.userId)}>
                      {t("voice.disconnect")}
                    </button>
                  ) : null}
                </span>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
