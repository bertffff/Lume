import type { FormEvent } from "react";
import { Button, Modal } from "../../ds/index.js";
import { RoomCodeInput } from "../../design/RoomCodeInput.js";
import { useI18n } from "../../i18n/context.js";
import styles from "./EntryModals.module.css";

export function JoinScreen({ code, codeInvalid, onCode, onSubmit, onCancel }: {
  code: string; codeInvalid: boolean; onCode: (value: string) => void; onSubmit: (event: FormEvent) => void; onCancel?: () => void;
}) {
  const { t } = useI18n();
  return (
    <Modal
      open
      size="sm"
      title={t("join.title")}
      onClose={() => onCancel?.()}
      footer={
        <>
          <Button variant="ghost" onClick={onCancel}>{t("common.cancel")}</Button>
          <Button type="submit" variant="primary" form="join-room-form" data-testid="lobby-join">{t("auth.login")}</Button>
        </>
      }
    >
      <form id="join-room-form" className={styles.form} onSubmit={onSubmit}>
        <p className={styles.lead}>{t("join.subtitle")}</p>
        <RoomCodeInput value={code} onChange={onCode} invalid={codeInvalid} autoFocus />
        <p className={styles.lead}>{t("join.hint")}</p>
      </form>
    </Modal>
  );
}
