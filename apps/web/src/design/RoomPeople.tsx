import { canActOnMember, canAssignRole } from "@lume/contracts";
import { Ellipsis } from "lucide-react";
import { useI18n } from "../i18n/context.js";
import type { RoomActions } from "../room/live.js";
import type { InRoomProfile } from "./RoomProfileModal.js";
import { initials, personHue } from "./theme.js";

export function RoomPeople({ live, onProfile }: { live: RoomActions; onProfile: (member: InRoomProfile) => void }) {
  const { t } = useI18n();
  const { members, self, voice } = live.state;
  return (
    <ul className="room-people" data-testid="rail-people">
      {members.map((member) => {
        const { userId, role, displayName } = member;
        const peer = voice.find((entry) => entry.userId === userId);
        const mine = userId === live.selfId;
        const allowed = !mine && canActOnMember(self.role, role);
        const roleText = t(role === "host" ? "profile.roleHost" : role === "mod" ? "profile.roleMod" : "profile.roleViewer");
        return (
          <li key={userId}>
            <button type="button" className="room-person" data-testid={`member-${userId}`} data-in-voice={Boolean(peer)} data-speaking={Boolean(peer?.speaking)} data-muted={peer ? String(peer.muted) : "none"} onClick={() => onProfile({ userId, role, displayName })}>
              <span className={`av p-${personHue(userId)}`} aria-hidden="true">{initials(displayName)}</span>
              <span><b>{displayName}{mine ? t("room.you") : ""}</b><small>{roleText}{peer ? ` · ${t(peer.speaking ? "room.speaking" : peer.muted ? "room.micOff" : "room.inVoice")}` : ""}</small></span>
            </button>
            {allowed ? (
              <details className="room-member-actions">
                <summary aria-label={`${displayName}: ${t("room.settings")}`}><Ellipsis aria-hidden="true" /></summary>
                <div>
                  <button type="button" data-testid={`member-mute-${userId}`} onClick={() => live.mute(userId, !member.muted)}>{t(member.muted ? "member.unmute" : "member.mute")}</button>
                  {peer && <button type="button" onClick={() => live.disconnectVoice(userId)}>{t("voice.disconnect")}</button>}
                  {role === "viewer" && canAssignRole(self.role) && <button type="button" onClick={() => live.promote(userId)}>{t("member.makeMod")}</button>}
                  <button type="button" data-testid={`member-kick-${userId}`} onClick={() => live.kick(userId)}>{t("member.kick")}</button>
                </div>
              </details>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
