import { canActOnMember, canAssignRole } from "@lume/contracts";
import { useI18n } from "../../i18n/context.js";
import { roleLabel, useRoomActions } from "../../room/live.js";

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

  if (collapsed) {
    return (
      <button type="button" className="tr-rail" onClick={onToggle}>
        {t("voice.title")}
      </button>
    );
  }

  const members = live?.state.members ?? [];
  const self = live?.state.self.role;

  return (
    <section className="tr-panel" aria-label={t("voice.title")}>
      <header className="tr-panel-bar">
        <span>{t("room.members")}</span>
        {collapsible ? (
          <button type="button" className="tr-text-button" onClick={onToggle}>
            {t("layout.collapse")}
          </button>
        ) : null}
      </header>
      <ul className="tr-voice-list" data-testid="member-list">
        {members.length === 0 ? <li className="tr-empty">{t("lobby.emptyRooms")}</li> : null}
        {members.map((member) => (
          <li key={member.userId}>
            <i className={member.muted ? "is-quiet" : "is-hot"} />
            <span>
              {member.displayName}
              <em> {roleLabel(member.role, t)}</em>
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
                {self && canAssignRole(self) && member.role === "viewer" ? (
                  <button type="button" className="tr-text-button" onClick={() => live?.promote(member.userId)}>
                    {t("member.makeMod")}
                  </button>
                ) : null}
              </span>
            ) : null}
          </li>
        ))}
      </ul>
      <footer className="tr-panel-bar">
        <span className="tr-chip">{t("voice.livekit")}</span>
      </footer>
    </section>
  );
}
