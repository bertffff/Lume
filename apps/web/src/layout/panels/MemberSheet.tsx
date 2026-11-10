import { useEffect, useState } from "react";
import { apiUrl } from "../../api/client.js";
import { useI18n } from "../../i18n/context.js";
import { useRoomActions } from "../../room/live.js";

interface PermissionRow {
  userId: string;
  displayName: string;
  canChat: boolean;
  canSpeak: boolean;
  canControlVideo: boolean;
  canAddToQueue: boolean;
  canRemoveFromQueue: boolean;
  canReorderQueue: boolean;
  overridden: boolean;
}

export function MemberSheet() {
  const live = useRoomActions();
  const { t } = useI18n();
  const [rows, setRows] = useState<PermissionRow[]>([]);
  const [log, setLog] = useState<Array<{ id: string; action: string; detail: string | null }>>([]);
  const [seconds, setSeconds] = useState(30);
  const token = live?.accessToken ?? "";
  const roomId = live?.state.room.id;

  useEffect(() => {
    if (!roomId || !token || live?.state.self.role === "viewer") return;
    void fetch(`${apiUrl}/rooms/${roomId}/permissions`, { headers: { authorization: `Bearer ${token}` } })
      .then((response) => response.json())
      .then((payload: { members?: PermissionRow[] }) => setRows(payload.members ?? []))
      .catch(() => setRows([]));
    void fetch(`${apiUrl}/rooms/${roomId}/mod-log`, { headers: { authorization: `Bearer ${token}` } })
      .then((response) => response.json())
      .then((payload: { log?: Array<{ id: string; action: string; detail: string | null }> }) => setLog(payload.log ?? []))
      .catch(() => setLog([]));
  }, [live?.state.self.role, roomId, token]);

  if (!live || live.state.self.role === "viewer") return null;

  async function save(row: PermissionRow) {
    await fetch(`${apiUrl}/rooms/${roomId}/permissions`, {
      method: "PATCH",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify(row),
    });
  }

  return (
    <div className="tr-voice-controls" data-testid="member-sheet">
      <p>{t("mod.sheet")}</p>
      {rows.map((row) => (
        <div key={row.userId}>
          <strong>{row.displayName}</strong>
          {(["canChat", "canSpeak", "canControlVideo", "canAddToQueue", "canRemoveFromQueue", "canReorderQueue"] as const).map((key) => (
            <label key={key} className="tr-check">
              <input
                type="checkbox"
                checked={row[key]}
                onChange={(event) => {
                  const next = { ...row, [key]: event.target.checked, overridden: true };
                  setRows((current) => current.map((item) => (item.userId === row.userId ? next : item)));
                  void save(next);
                }}
              />
              {key}
            </label>
          ))}
          <button
            type="button"
            className="tr-text-button"
            onClick={() => {
              void fetch(`${apiUrl}/rooms/${roomId}/temp-mute`, {
                method: "POST",
                headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
                body: JSON.stringify({ userId: row.userId, seconds }),
              });
            }}
          >
            {t("mod.tempMute")}
          </button>
        </div>
      ))}
      <label>
        {t("mod.seconds")}
        <input type="number" min={30} max={86400} value={seconds} onChange={(event) => setSeconds(Number(event.target.value))} />
      </label>
      <ul data-testid="mod-log">
        {log.length === 0 ? <li className="tr-empty">{t("mod.empty")}</li> : null}
        {log.map((entry) => (
          <li key={entry.id}>{entry.action} {entry.detail ?? ""}</li>
        ))}
      </ul>
    </div>
  );
}
