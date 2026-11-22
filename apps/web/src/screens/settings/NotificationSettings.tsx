import { useCallback, useEffect, useState } from "react";
import { Field, Input, Select } from "../../ds/index.js";
import { useI18n } from "../../i18n/context.js";
import { Check, Row } from "./Row.js";
import styles from "./SettingsScreen.module.css";

const kinds = ["FRIEND_REQUEST", "FRIEND_ACCEPTED", "ROOM_INVITE", "ACHIEVEMENT_UNLOCKED", "SYSTEM"] as const;
const digests = ["INSTANT", "HOURLY", "DAILY"] as const;

interface Delivery { digest: (typeof digests)[number]; quietHoursEnabled: boolean; quietStart: string; quietEnd: string }
const initial: Delivery = { digest: "INSTANT", quietHoursEnabled: false, quietStart: "22:00", quietEnd: "08:00" };

type Send = (path: string, method: "PUT", body: unknown) => Promise<Response>;

/** Telegram delivery: which kinds to forward, how often, and when to stay quiet. Reads and writes /me/notification-preferences. */
export function NotificationSettings({ token, apiUrl, send }: { token?: string; apiUrl?: string; send: Send }) {
  const { t } = useI18n();
  const [enabled, setEnabled] = useState<Record<string, boolean>>({});
  const [delivery, setDelivery] = useState<Delivery>(initial);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!token || !apiUrl) return;
    void fetch(`${apiUrl}/me/notification-preferences`, { headers: { authorization: `Bearer ${token}` } })
      .then((response) => response.json())
      .then((payload: { preferences?: Array<{ channel: string; kind: string; enabled: boolean }>; delivery?: Partial<Delivery> }) => {
        setEnabled(Object.fromEntries((payload.preferences ?? []).filter((row) => row.channel === "telegram").map((row) => [row.kind, row.enabled])));
        setDelivery((current) => ({ ...current, ...payload.delivery }));
      })
      .catch(() => undefined);
  }, [token, apiUrl]);

  const save = useCallback((body: object, rollback: () => void) => {
    setFailed(false);
    void send("/me/notification-preferences", "PUT", { channel: "telegram", kind: "SYSTEM", enabled: true, ...body }).catch(() => { rollback(); setFailed(true); });
  }, [send]);

  const toggleKind = (kind: string, next: boolean) => {
    setEnabled((current) => ({ ...current, [kind]: next }));
    void send("/me/notification-preferences", "PUT", { channel: "telegram", kind, enabled: next }).catch(() => { setEnabled((current) => ({ ...current, [kind]: !next })); setFailed(true); });
  };
  const patchDelivery = (patch: Partial<Delivery>) => {
    const previous = delivery;
    setDelivery({ ...delivery, ...patch });
    save({ ...patch, enabled: enabled.SYSTEM !== false }, () => setDelivery(previous));
  };

  return (
    <>
      <Row title={t("settings.notifTelegram")} hint={t("settings.notifTelegramHint")} />
      {kinds.map((kind) => (
        <Row key={kind} title={t(`settings.notif.${kind}`)}>
          <Check testId={`notif-${kind}`} label={t(`settings.notif.${kind}`)} checked={enabled[kind] !== false} onChange={(next) => toggleKind(kind, next)} />
        </Row>
      ))}
      <Row title={t("settings.digest")}>
        <div className={styles.grow}>
          <Field label={t("settings.digest")} hideLabel>
            <Select data-testid="notif-digest" value={delivery.digest} onChange={(event) => patchDelivery({ digest: event.target.value as Delivery["digest"] })}>
              {digests.map((item) => <option key={item} value={item}>{t(`settings.digest.${item}`)}</option>)}
            </Select>
          </Field>
        </div>
      </Row>
      <Row title={t("settings.quiet")} hint={t("settings.quietHint")}>
        <div className={styles.inline}>
          <Check testId="notif-quiet" label={t("settings.quiet")} checked={delivery.quietHoursEnabled} onChange={(next) => patchDelivery({ quietHoursEnabled: next })} />
          {delivery.quietHoursEnabled ? (
            <>
              <Field label={t("settings.quietFrom")}><Input type="time" value={delivery.quietStart} onChange={(event) => event.target.value && patchDelivery({ quietStart: event.target.value })} /></Field>
              <Field label={t("settings.quietTo")}><Input type="time" value={delivery.quietEnd} onChange={(event) => event.target.value && patchDelivery({ quietEnd: event.target.value })} /></Field>
            </>
          ) : null}
        </div>
      </Row>
      {failed ? <p className={styles.none} role="status">{t("settings.notifSaveFailed")}</p> : null}
    </>
  );
}
