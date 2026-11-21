import { useEffect, useState } from "react";
import { viewerPermissionKeys } from "@lume/contracts";
import { apiUrl } from "../api/client.js";
import { permissionHint, permissionLabel } from "./copy.js";
import { useI18n } from "../i18n/context.js";
import { Modal } from "../ui/index.js";

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
  const { t } = useI18n();
  const [settings, setSettings] = useState<RoomSettings>(fallback);
  const [defaults, setDefaults] = useState<Record<string, boolean>>(() => Object.fromEntries(viewerPermissionKeys.map((key) => [key, true])));
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void fetch(`${apiUrl}/rooms/${roomId}/settings`, { headers: { authorization: `Bearer ${token}` } })
      .then((response) => response.json())
      .then((payload: RoomSettings) => {
        setSettings(payload);
        if (payload.defaults) {
          setDefaults(Object.fromEntries(viewerPermissionKeys.map((key) => [key, payload.defaults?.[key] !== false])));
        }
      })
      .catch(() => setNote(t("settings.loadFailed")));
  }, [roomId, token, t]);

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
        setNote(t("settings.saveFailed"));
        return;
      }
      onSaved({ ...payload, defaults });
      onClose();
    } catch {
      setNote(t("settings.saveFailed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open
      title={t("settings.roomTitle")}
      onClose={onClose}
      testId="room-settings-sheet"
      closeTestId="room-settings-close"
      lg
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
      >
        <div className="set-grp">
          <label className="field">
            {t("create.roomName")}
            <input data-testid="settings-title" value={settings.title} onChange={(event) => patch({ title: event.target.value })} />
          </label>
          <label className="field">
            {t("create.roomDescription")}
            <input data-testid="settings-description" value={settings.description} onChange={(event) => patch({ description: event.target.value })} />
          </label>
          <label className="set-row">
            <div><b>{t("settings.public")}</b><small>{t("settings.publicHint")}</small></div>
            <input data-testid="settings-public" type="checkbox" checked={settings.isPublic} onChange={(event) => patch({ isPublic: event.target.checked })} />
          </label>
          <label className="set-row">
            <div><b>{t("settings.maxMembers")}</b><small>{t("settings.maxMembersHint")}</small></div>
            <input data-testid="settings-max-members" type="number" min={2} max={100} value={settings.maxMembers} onChange={(event) => patch({ maxMembers: Number(event.target.value) })} />
          </label>
          <label className="set-row">
            <div><b>{t("settings.hideReactions")}</b><small>{t("settings.hideReactionsHint")}</small></div>
            <input data-testid="settings-hide-reactions" type="checkbox" checked={settings.hideReactions} onChange={(event) => patch({ hideReactions: event.target.checked })} />
          </label>
          <div className="set-row">
            <div><b>{t("settings.viewerRights")}</b><small>{t("settings.viewerRightsHint")}</small></div>
          </div>
          {viewerPermissionKeys.map((key) => (
            <label className="set-row" key={key}>
              <div><b>{permissionLabel(key, t)}</b><small>{permissionHint(key, t)}</small></div>
              <input
                data-testid={`settings-default-${key}`}
                type="checkbox"
                checked={defaults[key] !== false}
                onChange={(event) => setDefaults((current) => ({ ...current, [key]: event.target.checked }))}
              />
            </label>
          ))}
          {note ? <p data-testid="room-settings-note" role="status">{note}</p> : null}
        </div>
        <div className="mf">
          <button type="button" className="btn btn-ghost" data-testid="room-settings-cancel" onClick={onClose}>
            {t("common.cancel")}
          </button>
          <button type="submit" className="btn btn-primary" data-testid="room-settings-save" disabled={busy} aria-busy={busy || undefined}>
            {t("common.save")}
          </button>
        </div>
      </form>
    </Modal>
  );
}
