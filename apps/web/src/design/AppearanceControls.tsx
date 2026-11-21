import { Check, Film, Monitor, Moon, Radio, Sun, Terminal, type LucideIcon } from "lucide-react";
import { useI18n } from "../i18n/context.js";
import { type MessageKey } from "../i18n/ru.js";
import { type StyleId, type ThemeMode } from "./theme.js";

interface Option<T extends string> {
  id: T;
  label: MessageKey | "Gruvbox" | "TeleRave-v2";
  icon: LucideIcon;
}

const styles: readonly Option<StyleId>[] = [
  { id: "cinema", label: "settings.cinema", icon: Film },
  { id: "gruvbox", label: "Gruvbox", icon: Terminal },
  { id: "telerave", label: "TeleRave-v2", icon: Radio },
];

const modes: readonly Option<ThemeMode>[] = [
  { id: "dark", label: "settings.dark", icon: Moon },
  { id: "light", label: "settings.light", icon: Sun },
  { id: "system", label: "settings.systemFollow", icon: Monitor },
];

interface OptionGroupProps<T extends string> {
  label: string;
  options: readonly Option<T>[];
  value: T;
  onSelect: (value: T) => void;
  square: boolean;
}

function OptionGroup<T extends string>({ label, options, value, onSelect, square }: OptionGroupProps<T>) {
  const { t } = useI18n();
  return (
    <fieldset className="min-w-0">
      <legend className="mb-2 font-semibold">{label}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map(({ id, label: optionLabel, icon: Icon }) => (
          <button
            key={id}
            type="button"
            aria-pressed={id === value}
            className={`appearance-option inline-flex min-h-11 items-center gap-2 px-3 py-1.5 ${square ? "rounded-none" : "rounded-md"}`}
            onClick={() => { if (id !== value) onSelect(id); }}
          >
            <Icon aria-hidden="true" size={16} />
            {optionLabel === "Gruvbox" || optionLabel === "TeleRave-v2" ? optionLabel : t(optionLabel)}
            <Check aria-hidden="true" size={14} className={id === value ? undefined : "invisible"} />
          </button>
        ))}
      </div>
    </fieldset>
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
    <div className="grid gap-4">
      <OptionGroup label={t("settings.styleInterface")} options={styles} value={style} onSelect={onStyle} square={style === "gruvbox"} />
      <OptionGroup label={t("settings.theme")} options={modes} value={mode} onSelect={onMode} square={style === "gruvbox"} />
    </div>
  );
}
