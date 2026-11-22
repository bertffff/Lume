import { canActOnMember, canAssignRole } from "@lume/contracts";
import { Ellipsis } from "lucide-react";
import { mediaSrc } from "../api/client.js";
import { Avatar, Badge, Icon } from "../ds/index.js";
import { useI18n } from "../i18n/context.js";
import type { RoomActions } from "../room/live.js";
import type { InRoomProfile } from "./RoomProfileModal.js";
import styles from "./RoomPeople.module.css";

export function RoomPeople({ live, onProfile }: { live: RoomActions; onProfile: (member: InRoomProfile) => void }) {
  const { t } = useI18n();
  const { members, self, voice } = live.state;
  return (
    <ul className={styles.list} data-testid="rail-people">
      {members.map((member) => {
        const { userId, role, displayName } = member;
        const peer = voice.find((entry) => entry.userId === userId);
        const mine = userId === live.selfId;
        const allowed = !mine && canActOnMember(self.role, role);
        const roleText = t(role === "host" ? "profile.roleHost" : role === "mod" ? "profile.roleMod" : "profile.roleViewer");
        const voiceText = peer ? t(peer.speaking ? "room.speaking" : peer.muted ? "room.micOff" : "room.inVoice") : null;
        return (
          <li key={userId} className={styles.row}>
            <button type="button" className={styles.person} data-testid={`member-${userId}`} data-in-voice={Boolean(peer)} data-speaking={Boolean(peer?.speaking)} data-muted={peer ? String(peer.muted) : "none"} onClick={() => onProfile({ userId, displayName, role })}>
              <Avatar name={displayName} src={mediaSrc(member.avatarUrl)} presence={peer ? "online" : undefined} speaking={Boolean(peer?.speaking && !peer.muted)} />
              <span className={styles.text}>
                <b className={styles.name}>{displayName}{mine ? t("room.you") : ""}</b>
                <small className={styles.sub}>{voiceText ?? roleText}</small>
              </span>
              {role !== "viewer" ? <Badge tone={role === "host" ? "accent" : "neutral"}>{roleText}</Badge> : null}
            </button>
            {allowed ? (
              <details className={styles.menu}>
                <summary className={styles.summary} aria-label={`${displayName}: ${t("room.settings")}`}><Icon icon={Ellipsis} size="md" /></summary>
                <div className={styles.actions}>
                  <button type="button" data-testid={`member-mute-${userId}`} onClick={() => live.mute(userId, !member.muted)}>{t(member.muted ? "member.unmute" : "member.mute")}</button>
                  {peer && <button type="button" onClick={() => live.disconnectVoice(userId)}>{t("voice.disconnect")}</button>}
                  {role === "viewer" && canAssignRole(self.role) && <button type="button" onClick={() => live.promote(userId)}>{t("member.makeMod")}</button>}
                  <button type="button" className={styles.danger} data-testid={`member-kick-${userId}`} onClick={() => live.kick(userId)}>{t("member.kick")}</button>
                </div>
              </details>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
