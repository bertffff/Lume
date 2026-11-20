import { useEffect, useState } from "react";
import { apiUrl } from "../api/client.js";

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

export function SessionDock({
  roomId,
  token,
  memberCount,
  voiceCount,
  voiceEnabled,
  voiceJoined,
  voiceMuted,
  canSettings,
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
  canSettings: boolean;
  onVoiceJoin: () => void;
  onVoiceLeave: () => void;
  onVoiceMute: () => void;
  onSettings: () => void;
  onLeave: () => void;
}) {
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
      flash("Ссылка скопирована");
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
      flash(response.ok ? "Напоминание сохранено" : "Не удалось сохранить");
    } catch {
      flash("Не удалось сохранить");
    } finally {
      setBusy(false);
    }
  }

  const elapsed = baseMs === null ? 0 : Math.max(0, Math.floor((now - baseMs) / 1000));
  const members = Math.max(memberCount, session?.memberCount ?? 0);

  return (
    <div className="session-dock-bar" data-testid="session-dock" data-role={session?.role ?? "viewer"}>
      <div className="dock-group">
        <span className="session-dock-dot" />
        <b>
          Сессия <span data-testid="session-dock-time">{clock(elapsed)}</span>
        </b>
      </div>
      <div className="dock-group">
        <span data-testid="session-dock-members">{members} в комнате</span>
        <span data-testid="session-dock-voice">{voiceCount} в голосе</span>
      </div>
      <span className="spacer" />
      <div className="dock-group">
        <button type="button" data-testid="session-dock-invite" onClick={() => void copyInvite()} disabled={!session}>
          Позвать
        </button>
        <button type="button" data-testid="session-dock-remind" onClick={() => void setReminder()} disabled={busy}>
          Напомнить
        </button>
      </div>
      <div className="dock-group">
        {voiceEnabled ? (
          voiceJoined ? (
            <>
              <button type="button" data-testid="session-dock-mute" onClick={onVoiceMute}>
                {voiceMuted ? "Вкл микрофон" : "Выкл микрофон"}
              </button>
              <button type="button" data-testid="session-dock-voice-leave" onClick={onVoiceLeave}>
                Выйти из голоса
              </button>
            </>
          ) : (
            <button type="button" data-testid="session-dock-voice-join" onClick={onVoiceJoin}>
              Войти в голос
            </button>
          )
        ) : (
          <button type="button" data-testid="session-dock-voice-join" disabled title="Голос не настроен">
            Голос выкл
          </button>
        )}
      </div>
      <div className="dock-group">
        {canSettings ? (
          <button type="button" data-testid="session-dock-settings" onClick={onSettings}>
            Настройки
          </button>
        ) : null}
        <button type="button" data-testid="session-dock-leave" onClick={onLeave}>
          Выйти
        </button>
      </div>
      {note ? <small data-testid="session-dock-note">{note}</small> : null}
    </div>
  );
}
