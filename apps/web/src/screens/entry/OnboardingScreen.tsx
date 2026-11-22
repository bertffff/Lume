import { Compass } from "lucide-react";
import { Button, Icon, Modal } from "../../ds/index.js";
import { useI18n } from "../../i18n/context.js";
import styles from "./EntryModals.module.css";

export function OnboardingScreen({ onDone }: { onDone: () => void }) {
  const { t } = useI18n();
  return (
    <Modal
      open
      size="sm"
      title={t("onboarding.welcome")}
      onClose={onDone}
      footer={
        <>
          <Button variant="ghost" onClick={onDone}>{t("join.skip")}</Button>
          <Button variant="primary" onClick={onDone}>{t("join.next")}</Button>
        </>
      }
    >
      <div className={styles.form}>
        <span className={styles.glyph}><Icon icon={Compass} size="lg" /></span>
        <h3 className={styles.title}>{t("onboarding.title")}</h3>
        <p className={styles.lead}>{t("onboarding.body")}</p>
      </div>
    </Modal>
  );
}
