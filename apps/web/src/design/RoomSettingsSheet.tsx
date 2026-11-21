import { useEffect, useState } from "react";
import { roomCategorySelectionSchema, viewerPermissionKeys, type RoomCategorySelection } from "@lume/contracts";
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
  categorySelection?: RoomCategorySelection;
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
  onMuteAll,
  members,
}: {
  roomId: string;
  token: string;
  onClose: () => void;
  onSaved: (settings: RoomSettings) => void;
  onMuteAll: () => void;
  members: readonly { userId: string; displayName: string }[];
}) {
  const { t, locale } = useI18n();
  const [settings, setSettings] = useState<RoomSettings>(fallback);
  const [defaults, setDefaults] = useState<Record<string, boolean>>(() => Object.fromEntries(viewerPermissionKeys.map((key) => [key, true])));
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [log, setLog] = useState<ModerationEntry[] | null>(null);
  const [logFailed, setLogFailed] = useState(false);
  const [logBusy, setLogBusy] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    void fetch(`${apiUrl}/rooms/${roomId}/settings`, { headers: { authorization: `Bearer ${token}` }, signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error("settings_load_failed");
        return response.json();
      })
      .then((payload: RoomSettings) => {
        setSettings(payload);
        setLoaded(true);
        if (payload.defaults) {
          setDefaults(Object.fromEntries(viewerPermissionKeys.map((key) => [key, payload.defaults?.[key] !== false])));
        }
      })
      .catch(() => { if (!controller.signal.aborted) setNote(t("settings.loadFailed")); });
    return () => controller.abort();
  }, [roomId, token, t]);

  function patch(patchValue: Partial<RoomSettings>) {
    setSettings((current) => ({ ...current, ...patchValue }));
  }

  async function save() {
    if (!loaded || busy) return;
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
          categorySelection: settings.categorySelection,
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

  async function loadLog() {
    setLogBusy(true);
    setLogFailed(false);
    try {
      const response = await fetch(`${apiUrl}/rooms/${roomId}/mod-log`, { headers: { authorization: `Bearer ${token}` } });
      if (!response.ok) throw new Error("log_load_failed");
      const payload = (await response.json()) as { log: ModerationEntry[] };
      setLog(payload.log);
    } catch {
      setLogFailed(true);
    } finally {
      setLogBusy(false);
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
        <fieldset className="set-grp room-modal-content" disabled={!loaded || busy}>
          <label className="field">
            {t("create.roomName")}
            <input data-testid="settings-title" required maxLength={120} value={settings.title} onChange={(event) => patch({ title: event.target.value })} />
          </label>
          <label className="field">
            {t("create.roomDescription")}
            <input data-testid="settings-description" maxLength={280} value={settings.description} onChange={(event) => patch({ description: event.target.value })} />
          </label>
          <label className="field">
            {t("room.categoryLabel")}
            <select data-testid="settings-category" disabled={settings.categorySelection === undefined} value={settings.categorySelection ?? "auto"} onChange={(event) => {
              const selection = roomCategorySelectionSchema.safeParse(event.target.value);
              if (selection.success) patch({ categorySelection: selection.data });
            }}>
              {roomCategorySelectionSchema.options.map((item) => <option key={item} value={item}>{t(item === "auto" ? "room.categoryAuto" : `feed.${item}`)}</option>)}
            </select>
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
        </fieldset>
        {note ? <p data-testid="room-settings-note" role="status">{note}</p> : null}
        <div className="mf">
          <button type="button" className="btn btn-ghost" data-testid="room-settings-cancel" onClick={onClose}>
            {t("common.cancel")}
          </button>
          <button type="submit" className="btn btn-primary" data-testid="room-settings-save" disabled={!loaded || busy} aria-busy={busy || undefined}>
            {t("common.save")}
          </button>
        </div>
      </form>
      <section className="room-modal-content room-moderation" aria-label={t("mod.sheet")}>
        <h3>{t("mod.sheet")}</h3>
        <div className="room-settings-actions">
          <button type="button" data-testid="voice-mute-all" onClick={onMuteAll}>{t("voice.muteAll")}</button>
          <button type="button" data-testid="room-mod-log-open" disabled={logBusy} onClick={() => void loadLog()}>{t("mod.sheet")}</button>
        </div>
        {logFailed && <p role="status">{t("settings.loadFailed")}</p>}
        {log && <div data-testid="room-mod-log">{log.length ? <ul>{log.map((entry) => (
          <li key={entry.id}><time dateTime={entry.createdAt}>{new Date(entry.createdAt).toLocaleString(locale)}</time>{" · "}
            {t(logLabels[entry.action] ?? "mod.sheet")}{entry.targetId ? ` · ${members.find((member) => member.userId === entry.targetId)?.displayName ?? t("room.people")}` : ""}
          </li>
        ))}</ul> : <p>{t("mod.empty")}</p>}</div>}
      </section>
    </Modal>
  );
}

interface ModerationEntry { id: string; action: string; targetId: string | null; createdAt: string }
const logLabels: Record<string, Parameters<ReturnType<typeof useI18n>["t"]>[0]> = {
  "temp-mute": "mod.tempMute", "slow-mode": "chat.slow", "sync-incident": "room.syncIncident",
  kick: "member.kick", mute: "member.mute", unmute: "member.unmute", role: "member.makeMod",
  retry: "room.refreshLink", open: "room.openPlatform", replace: "room.replaceVideo",
};
