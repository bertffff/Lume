import { layoutAspectGroup, withLayoutPreset, withVideoAspect, type RoomLayout } from "@lume/contracts";
import { useState } from "react";
import { apiUrl } from "../api/client.js";
import { useI18n } from "../i18n/context.js";
import type { useRoomMeta } from "../room/hooks/useRoomMeta.js";
import type { RoomActions } from "../room/live.js";
import { Button, Chip, ChipGroup, Modal } from "../ds/index.js";
import styles from "./RoomDialogs.module.css";
import { runVoicePreflight, saveVoicePreflight } from "../voice/preflight.js";
import { AppearanceControls } from "./AppearanceControls.js";
import type { RoomAppearance } from "./room-appearance.js";

export function RoomPersonalSettings({ live, meta, layout, appearance, onLayout, onClose }: {
  live: RoomActions;
  meta: ReturnType<typeof useRoomMeta>;
  layout: RoomLayout;
  appearance: RoomAppearance | null;
  onLayout: (next: RoomLayout) => void;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const [checking, setChecking] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [savingReminder, setSavingReminder] = useState(false);
  const { preflight } = meta;
  const headers = { authorization: `Bearer ${live.accessToken}`, "content-type": "application/json" };
  const roomPath = `${apiUrl}/rooms/${live.state.room.id}`;

  async function checkVoice() {
    setChecking(true);
    try {
      const result = await runVoicePreflight();
      meta.setPreflight(result);
      meta.setPreflight(await saveVoicePreflight(live.accessToken, result));
    } catch {
      // Preserve the local checks if saving fails.
    } finally {
      setChecking(false);
    }
  }

  async function remind() {
    setSavingReminder(true);
    try {
      const response = await fetch(`${roomPath}/reminders`, { method: "POST", headers, body: JSON.stringify({ minutes: 30 }) });
      setNote(t(response.ok ? "room.reminderSaved" : "room.reminderFailed"));
    } catch {
      setNote(t("room.reminderFailed"));
    } finally {
      setSavingReminder(false);
    }
  }

  return (
    <Modal open size="sm" title={t("room.layoutGroup")} testId="room-personal-sheet" onClose={onClose}>
      <div className={styles.form}>
        <ChipGroup label={t("room.layoutGroup")}>
          {(["theater", "enlarged", "immersive"] as const).map((preset) => <Chip key={preset} data-testid={`layout-${preset}`} selected={layout.preset === preset} onClick={() => onLayout(withLayoutPreset(layout, preset))}>{t(`layout.${preset}`)}</Chip>)}
          <Chip data-testid="layout-horizontal" selected={layoutAspectGroup(layout.videoAspect) === "horizontal"} onClick={() => onLayout(withVideoAspect(layout, 16 / 9))}>16:9</Chip>
          <Chip data-testid="layout-vertical" selected={layoutAspectGroup(layout.videoAspect) === "vertical"} onClick={() => onLayout(withVideoAspect(layout, 9 / 16))}>9:16</Chip>
        </ChipGroup>
        {appearance && <AppearanceControls {...appearance} />}
        <section className={styles.moderation} aria-label={t("room.voiceTitle")}>
          <h3 className={styles.subtitle}>{t("room.voiceTitle")}</h3>
          <div className={styles.inline}><Button data-testid="voice-preflight-run" disabled={checking} onClick={() => void checkVoice()}>{t(checking ? "room.voiceChecking" : "room.voiceCheck")}</Button></div>
          <div className={styles.diagnostic} data-testid="voice-preflight" data-state={preflight ? "done" : "idle"} data-network={preflight?.network ?? ""} data-mic={preflight ? String(preflight.mic) : ""} data-speaker={preflight ? String(preflight.speaker) : ""}>
            {preflight ? <>
              <span data-testid="voice-preflight-mic">{preflight.mic ? t("room.micLevel", { level: preflight.micLevel }) : t("room.micNoAccess")}</span>
              <span data-testid="voice-preflight-speaker">{t(preflight.speaker ? "room.speakersOk" : "room.speakersNone")}</span>
              <span data-testid="voice-preflight-network" data-network={preflight.network}>{t("room.network", { state: t(preflight.network === "good" ? "room.networkGood" : preflight.network === "fair" ? "room.networkFair" : "room.networkWeak") })}</span>
            </> : <span>{t("room.preflightHint")}</span>}
          </div>
        </section>
        <div className={styles.actions}>
          <Button size="sm" data-testid="session-dock-remind" disabled={savingReminder} onClick={() => void remind()}>{t("room.remind")}</Button>
          {live.state.room.nowPlaying && <>
            <Button size="sm" data-testid="sync-incident" title={t("room.syncIncidentHint")} onClick={() => { void fetch(`${roomPath}/sync-incident`, { method: "POST", headers, body: JSON.stringify({ note: "player drift" }) }).catch(() => undefined); }}>{t("room.syncIncident")}</Button>
            <Button size="sm" data-testid="report-buffering" title={t("room.bufferingHint")} onClick={() => live.reportViewer("buffering")}>{t("room.buffering")}</Button>
          </>}
          <Button size="sm" data-testid="hide-other-reactions" onClick={() => {
            const hideOtherReactions = !meta.hideOther;
            void fetch(`${apiUrl}/me`, { method: "PATCH", headers, body: JSON.stringify({ hideOtherReactions }) })
              .then((response) => { if (response.ok) meta.setHideOther(hideOtherReactions); }).catch(() => undefined);
          }}>{t(meta.hideOther ? "room.showOthers" : "room.hideOthers")}</Button>
        </div>
        {note && <p className={styles.note} data-testid="session-dock-note" role="status">{note}</p>}
      </div>
    </Modal>
  );
}
