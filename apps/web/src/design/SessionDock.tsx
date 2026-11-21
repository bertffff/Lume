import { useEffect, useState } from "react";
import { apiUrl } from "../api/client.js";
import { useI18n } from "../i18n/context.js";

interface SessionInfo {
  roomId: string;
  code: string;
  title: string;
  startedAt: string;
  elapsedSeconds: number;
  memberCount: number;
  role: "host" | "mod" | "viewer";
}

function clock(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

type IconName = "chat" | "bell" | "clock" | "mic" | "mic-off" | "settings" | "leave" | "users";

function Icon({ name }: { name: IconName }) {
  const paths: Record<IconName, string> = {
    chat: "M4 5h16v10H9l-5 4V5z",
    bell: "M6 16h12l-1.5-2.5V9a4.5 4.5 0 1 0-9 0v4.5L6 16zm4 3a2 2 0 0 0 4 0",
    clock: "M12 7v5l3 2M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z",
    mic: "M12 4a2.5 2.5 0 0 0-2.5 2.5v5a2.5 2.5 0 0 0 5 0v-5A2.5 2.5 0 0 0 12 4zM6 11a6 6 0 0 0 12 0M12 17v3",
    "mic-off": "M4 4l16 16M9.5 6.5v5a2.5 2.5 0 0 0 3.8 2.1M6 11a6 6 0 0 0 9.3 5M12 17v3",
    settings: "M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM19 12l1.5 2-2 3.5-2.5-.7-2 1.2-.4 2.5h-4l-.4-2.5-2-1.2-2.5.7-2-3.5L4 12l-1.5-2 2-3.5 2.5.7 2-1.2L9.4 3h4l.4 2.5 2 1.2 2.5-.7 2 3.5L19 12z",
    leave: "M10 5H5v14h5M15 8l4 4-4 4M9 12h10",
    users: "M8 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM2 20a6 6 0 0 1 12 0M16 4.5a3.5 3.5 0 0 1 0 7M17 14a5 5 0 0 1 5 5",
  };
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d={paths[name]} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function SessionDock({
  roomId,
  token,
  memberCount,
  voiceCount,
  voiceEnabled,
  voiceJoined,
  voiceMuted,
  unread = 0,
  narrow = false,
  canSettings,
  onJumpUnread,
  onVoiceJoin,
  onVoiceLeave,
  onVoiceMute,
  onSettings,
  onLeave,
}: {
  roomId: string;
  token: string;
  memberCount: number;
  voiceCount: number;
  voiceEnabled: boolean;
  voiceJoined: boolean;
  voiceMuted: boolean;
  unread?: number;
  narrow?: boolean;
  canSettings: boolean;
  onJumpUnread?: () => void;
  onVoiceJoin: () => void;
  onVoiceLeave: () => void;
  onVoiceMute: () => void;
  onSettings: () => void;
  onLeave: () => void;
}) {
  const { t } = useI18n();
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [baseMs, setBaseMs] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let stopped = false;
    setSession(null);
    setBaseMs(null);
    void fetch(`${apiUrl}/rooms/${roomId}/session`, { headers: { authorization: `Bearer ${token}` } })
      .then((response) => response.json())
      .then((payload: SessionInfo) => {
        if (stopped) return;
        setSession(payload);
        setBaseMs(Date.now() - Math.max(0, payload.elapsedSeconds) * 1000);
      })
      .catch(() => {
        if (!stopped) setSession(null);
      });
    return () => {
      stopped = true;
    };
  }, [roomId, token]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  function flash(message: string) {
    setNote(message);
    window.setTimeout(() => setNote((current) => (current === message ? null : current)), 4000);
  }

  async function copyInvite() {
    const code = session?.code;
    if (!code) return;
    const link = `${window.location.origin}/join/${encodeURIComponent(code)}`;
    try {
      await navigator.clipboard?.writeText(link);
      flash(t("room.inviteCopied"));
    } catch {
      flash(link);
    }
  }

  async function setReminder() {
    if (busy) return;
    setBusy(true);
    try {
      const response = await fetch(`${apiUrl}/rooms/${roomId}/reminders`, {
        method: "POST",
        headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
        body: JSON.stringify({ minutes: 30 }),
      });
      flash(response.ok ? t("room.reminderSaved") : t("room.reminderFailed"));
    } catch {
      flash(t("room.reminderFailed"));
    } finally {
      setBusy(false);
    }
  }

  const elapsed = baseMs === null ? 0 : Math.max(0, Math.floor((now - baseMs) / 1000));
  const members = Math.max(memberCount, session?.memberCount ?? 0);
  const voiceLabel = !voiceEnabled
    ? t("room.voiceOff")
    : voiceJoined
      ? t("room.voiceLeave")
      : t("room.voiceJoin");

  if (narrow) {
    return (
      <nav className="session-rail" data-testid="session-dock" data-role={session?.role ?? "viewer"} data-variant="rail" aria-label={t("room.session")}>
        <button type="button" data-testid="session-dock-chat" aria-label={t("room.unread", { count: unread })} title={t("room.unread", { count: unread })} onClick={onJumpUnread}>
          <Icon name="chat" />
          {unread > 0 ? <span className="dock-badge" aria-hidden="true">{unread > 99 ? "99+" : unread}</span> : null}
        </button>
        <button type="button" data-testid="session-dock-invite" aria-label={t("room.invite")} title={t("room.invite")} onClick={() => void copyInvite()} disabled={!session}>
          <Icon name="users" />
        </button>
        <button
          type="button"
          data-testid="session-dock-voice-join"
          aria-label={voiceLabel}
          title={voiceLabel}
          aria-pressed={voiceJoined}
          onClick={() => (voiceJoined ? onVoiceLeave() : onVoiceJoin())}
          disabled={!voiceEnabled}
        >
          <Icon name={voiceJoined && voiceMuted ? "mic-off" : "mic"} />
          {voiceCount > 0 ? <span className="dock-badge" aria-hidden="true">{voiceCount}</span> : null}
        </button>
        <span className="session-rail-time" data-testid="session-dock-time" aria-label={t("room.sessionTime", { time: clock(elapsed) })}>
          {clock(elapsed)}
        </span>
        {canSettings ? (
          <button type="button" data-testid="session-dock-settings" aria-label={t("room.settings")} title={t("room.settings")} onClick={onSettings}>
            <Icon name="settings" />
          </button>
        ) : null}
        <button type="button" data-testid="session-dock-leave" aria-label={t("room.leave")} title={t("room.leave")} className="danger" onClick={onLeave}>
          <Icon name="leave" />
        </button>
        {note ? <small className="session-rail-note" data-testid="session-dock-note" role="status">{note}</small> : null}
      </nav>
    );
  }

  return (
    <div className="session-dock-bar" data-testid="session-dock" data-role={session?.role ?? "viewer"} data-variant="bar">
      <div className="dock-group">
        <span className="session-dock-dot" />
        <b>
          {t("room.session")} <span data-testid="session-dock-time">{clock(elapsed)}</span>
        </b>
      </div>
      <div className="dock-group">
        <span data-testid="session-dock-members">{t("room.memberCount", { count: members })}</span>
        <span data-testid="session-dock-voice">{t("room.voiceCount", { count: voiceCount })}</span>
      </div>
      <span className="spacer" />
      <div className="dock-group">
        <button type="button" data-testid="session-dock-invite" onClick={() => void copyInvite()} disabled={!session}>
          {t("room.invite")}
        </button>
        <button type="button" data-testid="session-dock-remind" onClick={() => void setReminder()} disabled={busy}>
          {t("room.remind")}
        </button>
      </div>
      <div className="dock-group">
        {voiceEnabled ? (
          voiceJoined ? (
            <>
              <button type="button" data-testid="session-dock-mute" onClick={onVoiceMute}>
                {voiceMuted ? t("room.micOn") : t("room.micOff")}
              </button>
              <button type="button" data-testid="session-dock-voice-leave" onClick={onVoiceLeave}>
                {t("room.voiceLeave")}
              </button>
            </>
          ) : (
            <button type="button" data-testid="session-dock-voice-join" onClick={onVoiceJoin}>
              {t("room.voiceJoin")}
            </button>
          )
        ) : (
          <button type="button" data-testid="session-dock-voice-join" disabled title={t("voice.disabled")}>
            {t("room.voiceOff")}
          </button>
        )}
      </div>
      <div className="dock-group">
        {canSettings ? (
          <button type="button" data-testid="session-dock-settings" onClick={onSettings}>
            {t("room.settings")}
          </button>
        ) : null}
        <button type="button" data-testid="session-dock-leave" onClick={onLeave}>
          {t("room.leave")}
        </button>
      </div>
      {note ? <small data-testid="session-dock-note">{note}</small> : null}
    </div>
  );
}
