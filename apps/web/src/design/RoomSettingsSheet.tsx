import { useEffect, useState } from "react";
import { viewerPermissionKeys } from "@lume/contracts";
import { apiUrl } from "../api/client.js";

export interface RoomSettings {
  title: string;
  description: string;
  isPublic: boolean;
  maxMembers: number;
  hideReactions: boolean;
  defaults: Record<string, boolean> | null;
}

const fallback: RoomSettings = {
  title: "",
  description: "",
  isPublic: false,
  maxMembers: 25,
  hideReactions: false,
  defaults: null,
};

export function RoomSettingsSheet({
  roomId,
  token,
  onClose,
  onSaved,
}: {
  roomId: string;
  token: string;
  onClose: () => void;
  onSaved: (settings: RoomSettings) => void;
}) {
  const [settings, setSettings] = useState<RoomSettings>(fallback);
  const [defaults, setDefaults] = useState<Record<string, boolean>>(() => Object.fromEntries(viewerPermissionKeys.map((key) => [key, true])));
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    void fetch(`${apiUrl}/rooms/${roomId}/settings`, { headers: { authorization: `Bearer ${token}` } })
      .then((response) => response.json())
      .then((payload: RoomSettings) => {
        setSettings(payload);
        if (payload.defaults) {
          setDefaults(Object.fromEntries(viewerPermissionKeys.map((key) => [key, payload.defaults?.[key] !== false])));
        }
      })
      .catch(() => setNote("Не удалось загрузить настройки"));
  }, [roomId, token]);

  function patch(patchValue: Partial<RoomSettings>) {
    setSettings((current) => ({ ...current, ...patchValue }));
  }

  async function save() {
    setBusy(true);
    try {
      const response = await fetch(`${apiUrl}/rooms/${roomId}/settings`, {
        method: "PATCH",
        headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
        body: JSON.stringify({
          title: settings.title,
          description: settings.description,
          isPublic: settings.isPublic,
          maxMembers: settings.maxMembers,
          hideReactions: settings.hideReactions,
          defaults,
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as RoomSettings & { error?: string };
      if (!response.ok) {
        setNote(payload.error ?? "Не удалось сохранить");
        return;
      }
      onSaved({ ...payload, defaults });
      onClose();
    } catch {
      setNote("Не удалось сохранить");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="overlay docked" role="dialog" aria-modal="true" data-testid="room-settings-sheet">
      <form
        className="modal"
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
      >
        <div className="mh">
          <h2>Настройки комнаты</h2>
          <button type="button" data-testid="room-settings-close" onClick={onClose}>×</button>
        </div>
        <div className="mb">
          <label className="field">
            Название
            <input data-testid="settings-title" value={settings.title} onChange={(event) => patch({ title: event.target.value })} />
          </label>
          <label className="field">
            Описание
            <input data-testid="settings-description" value={settings.description} onChange={(event) => patch({ description: event.target.value })} />
          </label>
          <label className="set-row">
            <div><b>Публичная комната</b><small>Показывать в открытых комнатах.</small></div>
            <input
              data-testid="settings-public"
              type="checkbox"
              checked={settings.isPublic}
              onChange={(event) => patch({ isPublic: event.target.checked })}
            />
          </label>
          <label className="set-row">
            <div><b>Лимит участников</b><small>От 2 до 100 человек.</small></div>
            <input
              data-testid="settings-max-members"
              type="number"
              min={2}
              max={100}
              value={settings.maxMembers}
              onChange={(event) => patch({ maxMembers: Number(event.target.value) })}
            />
          </label>
          <label className="set-row">
            <div><b>Скрывать чужие реакции</b><small>Для всех зрителей комнаты.</small></div>
            <input
              data-testid="settings-hide-reactions"
              type="checkbox"
              checked={settings.hideReactions}
              onChange={(event) => patch({ hideReactions: event.target.checked })}
            />
          </label>
          <div className="set-row">
            <div><b>Права зрителей</b><small>Для тех, у кого нет личных прав.</small></div>
          </div>
          {viewerPermissionKeys.map((key) => (
            <label className="set-row" key={key}>
              <div><b>{key}</b></div>
              <input
                data-testid={`settings-default-${key}`}
                type="checkbox"
                checked={defaults[key] !== false}
                onChange={(event) => setDefaults((current) => ({ ...current, [key]: event.target.checked }))}
              />
            </label>
          ))}
          {note ? <p data-testid="room-settings-note">{note}</p> : null}
        </div>
        <div className="mf">
          <button type="button" className="btn btn-ghost" data-testid="room-settings-cancel" onClick={onClose}>Отмена</button>
          <button type="submit" className="btn btn-primary" data-testid="room-settings-save" disabled={busy}>Сохранить</button>
        </div>
      </form>
    </div>
  );
}
