import { useEffect, useState } from "react";
import { apiUrl } from "../api/client.js";

export interface InRoomProfile {
  userId: string;
  displayName: string;
  role: "host" | "mod" | "viewer";
}

export function RoomProfileModal({
  member,
  roomId,
  token,
  selfId,
  canBan = false,
  onClose,
}: {
  member: InRoomProfile;
  roomId: string;
  token: string;
  selfId: string;
  canBan?: boolean;
  onClose: () => void;
}) {
  const [reason, setReason] = useState("");
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function addFriend() {
    setBusy(true);
    try {
      const response = await fetch(`${apiUrl}/friends/request`, {
        method: "POST",
        headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
        body: JSON.stringify({ userId: member.userId }),
      });
      const payload = (await response.json().catch(() => ({}))) as { status?: string; error?: string };
      if (response.ok) {
        setNote(payload.status === "accepted" ? "Теперь вы друзья" : "Заявка отправлена");
      } else {
        setNote(payload.error ?? "Не получилось добавить");
      }
    } catch {
      setNote("Не получилось добавить");
    } finally {
      setBusy(false);
    }
  }

  async function report() {
    const text = reason.trim();
    if (!text) {
      setNote("Опишите причину жалобы");
      return;
    }
    setBusy(true);
    try {
      const response = await fetch(`${apiUrl}/reports`, {
        method: "POST",
        headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
        body: JSON.stringify({ targetKind: "user", targetId: member.userId, roomId, reason: text }),
      });
      setNote(response.ok ? "Жалоба отправлена" : "Не получилось отправить");
    } catch {
      setNote("Не получилось отправить");
    } finally {
      setBusy(false);
    }
  }

  async function blacklist() {
    setBusy(true);
    try {
      const response = await fetch(`${apiUrl}/rooms/${roomId}/ban`, {
        method: "POST",
        headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
        body: JSON.stringify({ userId: member.userId, type: "blacklist", reason: "глобальная блокировка" }),
      });
      setNote(response.ok ? "Заблокирован во всех ваших комнатах" : "Не получилось заблокировать");
    } catch {
      setNote("Не получилось заблокировать");
    } finally {
      setBusy(false);
    }
  }

  const roleLabel = member.role === "host" ? "ведущий" : member.role === "mod" ? "модератор" : "смотрит";

  return (
    <div className="overlay docked" role="dialog" aria-modal="true" data-testid="profile-modal">
      <div className="modal">
        <div className="mh">
          <h2 data-testid="profile-modal-name">{member.displayName}</h2>
          <button type="button" data-testid="profile-modal-close" onClick={onClose}>×</button>
        </div>
        <div className="mb">
          <p>{roleLabel}</p>
          {member.userId === selfId ? (
            <p data-testid="profile-modal-self">Это вы.</p>
          ) : (
            <>
              <div className="set-row">
                <div><b>Друзья</b><small>Заявка придёт в уведомления.</small></div>
                <button type="button" className="btn btn-outline" data-testid="profile-add-friend" disabled={busy} onClick={() => void addFriend()}>
                  Добавить
                </button>
              </div>
              {canBan ? (
                <div className="set-row">
                  <div><b>Глобальный чёрный список</b><small>Отдельно от блокировки друзей. Закрывает вход во все ваши комнаты.</small></div>
                  <button type="button" className="btn btn-outline" data-testid="profile-global-ban" disabled={busy} onClick={() => void blacklist()}>
                    Заблокировать везде
                  </button>
                </div>
              ) : null}
              <form
                className="set-row"
                onSubmit={(event) => {
                  event.preventDefault();
                  void report();
                }}
              >
                <div><b>Жалоба</b><small>До 500 знаков. Хранится в модерации.</small></div>
                <input
                  data-testid="profile-report-reason"
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  placeholder="Причина"
                />
                <button type="submit" className="btn btn-outline" data-testid="profile-report" disabled={busy}>
                  Пожаловаться
                </button>
              </form>
            </>
          )}
          {note ? <p data-testid="profile-modal-note">{note}</p> : null}
        </div>
      </div>
    </div>
  );
}
