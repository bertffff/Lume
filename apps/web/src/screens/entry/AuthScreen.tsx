import { useState, type FormEvent } from "react";
import { Button, Field, Input } from "../../ds/index.js";
import { cx } from "../../ds/cx.js";
import { useI18n } from "../../i18n/context.js";
import styles from "./AuthScreen.module.css";

export function AuthScreen({ onTelegram, name, onName, onEmail, onRegister }: {
  onTelegram: () => void;
  name: string;
  onName: (value: string) => void;
  onEmail: (event: FormEvent) => void;
  onRegister: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const { t } = useI18n();
  const [tab, setTab] = useState<"login" | "register">("login");
  const [password, setPassword] = useState("");
  return (
    <div className={styles.root}>
      <section className={styles.hero}>
        <div className={styles.logo}><i className={styles.spot} />lume</div>
        <h1 className={styles.headline}>{t("auth.heroTitle")}</h1>
        <p className={styles.lead}>{t("auth.heroBody")}</p>
      </section>
      <form className={styles.card} onSubmit={tab === "register" ? onRegister : onEmail}>
        <div className={styles.tabs} role="group">
          {(["login", "register"] as const).map((id) => (
            <button key={id} type="button" aria-pressed={tab === id} className={cx(styles.tab, tab === id && styles.on)} onClick={() => setTab(id)}>
              {t(id === "login" ? "auth.loginTab" : "auth.registerTab")}
            </button>
          ))}
        </div>
        <Button className={styles.telegram} block onClick={onTelegram}>{t("mobile.telegram")}</Button>
        <p className={styles.or}>{t("auth.orEmail")}</p>
        <Field label={t("auth.email")}>
          <Input data-testid="lobby-name" value={name} onChange={(event) => onName(event.target.value)} placeholder="albert@example.com" />
        </Field>
        <Field label={t("auth.password")}>
          <Input name="password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
        </Field>
        {tab === "register" ? (
          <Field label={t("auth.name")}><Input name="displayName" defaultValue={name.split("@")[0] || t("auth.guest")} /></Field>
        ) : null}
        <Button type="submit" variant="primary" block data-testid="lobby-sign-in">{tab === "register" ? t("auth.register") : t("auth.login")}</Button>
      </form>
    </div>
  );
}
