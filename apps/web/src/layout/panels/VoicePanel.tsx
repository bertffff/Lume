import { useState } from "react";
import { useI18n } from "../../i18n/context.js";

export function VoicePanel({
  collapsed,
  collapsible,
  onToggle,
}: {
  collapsed: boolean;
  collapsible: boolean;
  onToggle: () => void;
}) {
  const { t } = useI18n();
  const [muted, setMuted] = useState(true);

  if (collapsed) {
    return (
      <button type="button" className="tr-rail" onClick={onToggle}>
        {t("voice.title")}
      </button>
    );
  }

  return (
    <section className="tr-panel" aria-label={t("voice.title")}>
      <header className="tr-panel-bar">
        <span>{t("voice.title")}</span>
        {collapsible ? (
          <button type="button" className="tr-text-button" onClick={onToggle}>
            {t("layout.collapse")}
          </button>
        ) : null}
      </header>
      <ul className="tr-voice-list">
        <li>
          <i className={muted ? "is-quiet" : "is-hot"} />
          {t("voice.you")}
        </li>
        <li>
          <i className="is-hot" />
          {t("voice.mate1")}
        </li>
        <li>
          <i className="is-quiet" />
          {t("voice.mate2")}
        </li>
      </ul>
      <footer className="tr-panel-bar">
        <span className="tr-chip">{t("voice.livekit")}</span>
        <button type="button" className="tr-text-button" onClick={() => setMuted((value) => !value)}>
          {muted ? t("voice.unmute") : t("voice.mute")}
        </button>
      </footer>
    </section>
  );
}
