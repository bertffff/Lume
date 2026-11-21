import { useState } from "react";
import { apiUrl } from "../api/client.js";
import { useI18n } from "../i18n/context.js";
import { Button, Modal } from "../ui/index.js";

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
  const { t } = useI18n();
  const [reason, setReason] = useState("");
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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
        setNote(payload.status === "accepted" ? t("profile.friendsNow") : t("profile.requestSent"));
      } else {
        setNote(t("profile.actionFailed"));
      }
    } catch {
      setNote(t("profile.actionFailed"));
    } finally {
      setBusy(false);
    }
  }

  async function report() {
    const text = reason.trim();
    if (!text) {
      setNote(t("profile.reportReasonNeeded"));
      return;
    }
    setBusy(true);
    try {
      const response = await fetch(`${apiUrl}/reports`, {
        method: "POST",
        headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
        body: JSON.stringify({ targetKind: "user", targetId: member.userId, roomId, reason: text }),
      });
      setNote(response.ok ? t("profile.reportSent") : t("profile.actionFailed"));
    } catch {
      setNote(t("profile.actionFailed"));
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
        body: JSON.stringify({ userId: member.userId, type: "blacklist", reason: "global_block" }),
      });
      setNote(response.ok ? t("profile.blockedEverywhere") : t("profile.actionFailed"));
    } catch {
      setNote(t("profile.actionFailed"));
    } finally {
      setBusy(false);
    }
  }

  const roleLabel = member.role === "host" ? t("profile.roleHost") : member.role === "mod" ? t("profile.roleMod") : t("profile.roleViewer");

  return (
    <Modal open title={<span data-testid="profile-modal-name">{member.displayName}</span>} onClose={onClose} testId="profile-modal" closeTestId="profile-modal-close">
      <p>{roleLabel}</p>
      {member.userId === selfId ? (
        <p data-testid="profile-modal-self">{t("profile.thisIsYou")}</p>
      ) : (
        <>
          <div className="set-row">
            <div><b>{t("profile.friends")}</b><small>{t("profile.friendsHint")}</small></div>
            <Button variant="outline" data-testid="profile-add-friend" disabled={busy} onClick={() => void addFriend()}>
              {t("profile.add")}
            </Button>
          </div>
          {canBan ? (
            <div className="set-row">
              <div><b>{t("profile.blockEverywhere")}</b><small>{t("profile.blockEverywhereHint")}</small></div>
              <Button variant="outline" data-testid="profile-global-ban" disabled={busy} onClick={() => void blacklist()}>
                {t("profile.blockEverywhere")}
              </Button>
            </div>
          ) : null}
          <form
            className="set-row"
            onSubmit={(event) => {
              event.preventDefault();
              void report();
            }}
          >
            <div><b>{t("profile.report")}</b><small>{t("profile.reportHint")}</small></div>
            <input
              data-testid="profile-report-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder={t("profile.reportReason")}
            />
            <button type="submit" className="btn btn-outline" data-testid="profile-report" disabled={busy}>
              {t("profile.reportSend")}
            </button>
          </form>
        </>
      )}
      {note ? <p data-testid="profile-modal-note">{note}</p> : null}
    </Modal>
  );
}
