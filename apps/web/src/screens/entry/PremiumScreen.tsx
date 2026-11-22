import { State } from "../../ds/index.js";
import { useI18n } from "../../i18n/context.js";
import styles from "./EmptyScreen.module.css";

export function PremiumScreen() {
  const { t } = useI18n();
  return <div className={styles.root}><State kind="empty" title={t("premium.emptyTitle")} body={`${t("premium.body")} ${t("premium.emptyBody")}`} /></div>;
}
