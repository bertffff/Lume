import type { Theme } from "@lume/contracts";
import { themeToCssVars } from "@lume/ui";
import { useEffect, type ReactNode } from "react";

export function ThemeProvider({
  theme,
  overrides,
  children,
}: {
  theme: Theme;
  overrides: Record<string, string>;
  children: ReactNode;
}) {
  useEffect(() => {
    const root = document.documentElement;
    const vars = { ...themeToCssVars(theme), ...overrides };
    for (const [key, value] of Object.entries(vars)) {
      root.style.setProperty(key, value);
    }
    root.dataset.theme = overrides["--lume-accent"] ? `${theme.id}-adapted` : theme.id;
  }, [theme, overrides]);

  return children;
}
