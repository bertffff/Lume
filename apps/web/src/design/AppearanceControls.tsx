import { Film, Monitor, Moon, Radio, Sun, Terminal, type LucideIcon } from "lucide-react";
import { Chip, ChipGroup } from "../ds/index.js";
import { useI18n } from "../i18n/context.js";
import { type MessageKey } from "../i18n/ru.js";
import { type StyleId, type ThemeMode } from "./theme.js";
import styles from "./AppearanceControls.module.css";

interface Option<T extends string> {
  id: T;
  label: MessageKey | "Gruvbox" | "TeleRave-v2";
  icon: LucideIcon;
}

const styleOptions: readonly Option<StyleId>[] = [
  { id: "cinema", label: "settings.cinema", icon: Film },
  { id: "gruvbox", label: "Gruvbox", icon: Terminal },
  { id: "telerave", label: "TeleRave-v2", icon: Radio },
];

const modeOptions: readonly Option<ThemeMode>[] = [
  { id: "dark", label: "settings.dark", icon: Moon },
  { id: "light", label: "settings.light", icon: Sun },
  { id: "system", label: "settings.systemFollow", icon: Monitor },
];

function OptionGroup<T extends string>({ label, options, value, onSelect }: {
  label: string;
  options: readonly Option<T>[];
  value: T;
  onSelect: (value: T) => void;
}) {
  const { t } = useI18n();
  return (
    <div className={styles.group}>
      <span className={styles.label}>{label}</span>
      <ChipGroup label={label}>
        {options.map(({ id, label: optionLabel, icon }) => (
          <Chip key={id} icon={icon} selected={id === value} onClick={() => { if (id !== value) onSelect(id); }}>
            {optionLabel === "Gruvbox" || optionLabel === "TeleRave-v2" ? optionLabel : t(optionLabel)}
          </Chip>
        ))}
      </ChipGroup>
    </div>
  );
}

interface AppearanceControlsProps {
  style: StyleId;
  mode: ThemeMode;
  onStyle: (style: StyleId) => void;
  onMode: (mode: ThemeMode) => void;
}

export function AppearanceControls({ style, mode, onStyle, onMode }: AppearanceControlsProps) {
  const { t } = useI18n();
  return (
    <div className={styles.root}>
      <OptionGroup label={t("settings.styleInterface")} options={styleOptions} value={style} onSelect={onStyle} />
      <OptionGroup label={t("settings.theme")} options={modeOptions} value={mode} onSelect={onMode} />
    </div>
  );
}
