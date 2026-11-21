import { formatRoomCode, parseRoomCode } from "@lume/contracts";
import { ArrowLeft, Link2, Moon, Settings2, Sun, UsersRound } from "lucide-react";
import { useId, useState, useSyncExternalStore } from "react";
import { useI18n } from "../i18n/context.js";
import type { RoomAppearance } from "./room-appearance.js";
import { initials, personHue, subscribeAppearance } from "./theme.js";

interface RoomHeaderProps {
  title: string;
  code: string;
  synced: boolean;
  playbackStatus?: string;
  memberCount: number;
  participants?: readonly { userId: string; displayName: string }[];
  onPeople: () => void;
  onLeave: () => void;
  onSettings?: () => void;
  appearance?: RoomAppearance | null;
}

export function RoomHeader({ title, code, synced, playbackStatus, memberCount, participants, onPeople, onLeave, onSettings, appearance }: RoomHeaderProps) {
  const { t } = useI18n();
  const [inviteStatus, setInviteStatus] = useState<"copied" | "manual" | null>(null);
  const codeId = useId();
  const inviteCode = parseRoomCode(code);
  const inviteLink = inviteCode ? `${window.location.origin}/join/${inviteCode}` : null;

  async function copyInvite() {
    if (!inviteLink) return;
    try {
      await navigator.clipboard.writeText(inviteLink);
      setInviteStatus("copied");
    } catch {
      setInviteStatus("manual");
    }
  }

  const light = useSyncExternalStore(subscribeAppearance, () => document.documentElement.dataset.theme === "light", () => false);
  return (
    <header className="room-header" data-testid="room-header">
      <button type="button" onClick={onLeave} aria-label={t("room.leaveHome")} title={t("room.leaveHome")} data-testid="session-dock-leave"><ArrowLeft aria-hidden="true" /><span className="room-header-label">lume</span></button>
      <h1 data-testid="room-title" title={title}>{title}</h1>
      <div className="room-sync" data-connected={synced} role="status">
        <span aria-hidden="true" />
        <b>{synced ? t("room.synced") : t("room.connecting")}</b>
        {playbackStatus ? <small data-testid="playback-status">{playbackStatus}</small> : null}
      </div>
      <div className="room-header-actions">
        <button type="button" data-testid="session-dock-invite" aria-label={t("room.invite")} aria-describedby={codeId} title={t("room.invite")} onClick={() => void copyInvite()} disabled={!inviteLink}>
          <Link2 aria-hidden="true" /><span id={codeId} data-testid="room-code">{inviteCode ? formatRoomCode(inviteCode) : "—"}</span>
          <span className="room-header-label">{t("room.invite")}</span>
        </button>
        <button type="button" onClick={onPeople} aria-label={t("room.memberCount", { count: memberCount })} title={t("room.people")}>
          <UsersRound aria-hidden="true" />
          <span className="room-header-avatars" aria-hidden="true">{participants?.slice(0, 3).map((member) => (
            <span key={member.userId} className={`av p-${personHue(member.userId)}`}>{initials(member.displayName)}</span>
          ))}</span>
          <span>{memberCount}</span>
        </button>
        {appearance ? <button type="button" aria-label={t("nav.theme")} title={t("nav.theme")} onClick={() => appearance.onMode(light ? "dark" : "light")}>{light ? <Moon aria-hidden="true" /> : <Sun aria-hidden="true" />}</button> : null}
        {onSettings ? <button type="button" data-testid="room-settings-open" aria-label={t("room.settings")} title={t("room.settings")} onClick={onSettings}><Settings2 aria-hidden="true" /></button> : null}
      </div>
      {inviteStatus && inviteLink ? <small className="room-invite-status" role="status">{inviteStatus === "copied" ? t("room.inviteCopied") : <a href={inviteLink}>{inviteLink}</a>}</small> : null}
    </header>
  );
}
