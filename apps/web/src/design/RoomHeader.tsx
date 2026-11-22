import { formatRoomCode, parseRoomCode } from "@lume/contracts";
import { ArrowLeft, Link2, Moon, Settings2, Sun, UsersRound } from "lucide-react";
import { useId, useState, useSyncExternalStore } from "react";
import { AvatarStack, Icon, IconButton } from "../ds/index.js";
import { cx } from "../ds/cx.js";
import { useI18n } from "../i18n/context.js";
import type { RoomAppearance } from "./room-appearance.js";
import { subscribeAppearance } from "./theme.js";
import styles from "./RoomHeader.module.css";

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

/** One row: where I am, whether we are in sync, who is here, and the few actions that matter. */
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
    <header className={styles.root} data-testid="room-header">
      <div className={styles.left}>
        <button type="button" className={styles.back} onClick={onLeave} aria-label={t("room.leaveHome")} title={t("room.leaveHome")} data-testid="session-dock-leave">
          <Icon icon={ArrowLeft} size="md" /><span className={styles.backLabel}>lume</span>
        </button>
        <h1 className={styles.title} data-testid="room-title" title={title}>{title}</h1>
        <div className={styles.sync} data-connected={synced} role="status">
          <span className={cx(styles.dot, synced && styles.live)} aria-hidden="true" />
          <span className={styles.syncText}>{synced ? t("room.synced") : t("room.connecting")}</span>
          {playbackStatus ? <small className={styles.status} data-testid="playback-status">{playbackStatus}</small> : null}
        </div>
      </div>
      <div className={styles.actions}>
        <button type="button" className={styles.invite} data-testid="session-dock-invite" aria-label={t("room.invite")} aria-describedby={codeId} title={t("room.invite")} onClick={() => void copyInvite()} disabled={!inviteLink}>
          <Icon icon={Link2} size="sm" />
          <span id={codeId} className={styles.code} data-testid="room-code">{inviteCode ? formatRoomCode(inviteCode) : "—"}</span>
          <span className={styles.inviteLabel}>{t("room.invite")}</span>
        </button>
        <button type="button" className={styles.people} onClick={onPeople} aria-label={t("room.memberCount", { count: memberCount })} title={t("room.people")}>
          <span className={styles.avatars}><AvatarStack names={(participants ?? []).map((member) => member.displayName)} max={3} size="sm" /></span>
          <Icon icon={UsersRound} size="sm" />
          <span>{memberCount}</span>
        </button>
        {appearance ? <IconButton icon={light ? Moon : Sun} label={t("nav.theme")} variant="ghost" className={styles.theme} onClick={() => appearance.onMode(light ? "dark" : "light")} /> : null}
        {onSettings ? <IconButton icon={Settings2} label={t("room.settings")} variant="ghost" data-testid="room-settings-open" onClick={onSettings} /> : null}
      </div>
      {inviteStatus && inviteLink ? <small className={styles.inviteStatus} role="status">{inviteStatus === "copied" ? t("room.inviteCopied") : <a href={inviteLink}>{inviteLink}</a>}</small> : null}
    </header>
  );
}
