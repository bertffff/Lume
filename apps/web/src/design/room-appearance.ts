import { createContext } from "react";
import type { StyleId, ThemeMode } from "./theme.js";

export interface RoomAppearance {
  style: StyleId;
  mode: ThemeMode;
  onStyle: (style: StyleId) => void;
  onMode: (mode: ThemeMode) => void;
}

// The shell supplies its existing appearance owner; the room does not create a second one.
export const RoomAppearanceContext = createContext<RoomAppearance | null>(null);
