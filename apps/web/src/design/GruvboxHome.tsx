import type { View } from "./DesignApp.js";
import type { ReactNode } from "react";
import { copy } from "./copy.js";

export function GruvboxBar({ view, onGo, text, actions }: { view: View; onGo: (path: string) => void; text: ReturnType<typeof copy>; actions: ReactNode }) {
  const tabs: Array<[View | "home", string]> = [["home", "home"], ["search", "search"], ["room", "room"], ["profile", "profile"]];
  return (
    <div className="tabline">
      <span className="brand"><i className="dot" />LUME</span>
      <div className="bufs">
        {tabs.map(([id, label], index) => (
          <button key={id} type="button" className={view === id || (id === "home" && view === "home") ? "buf on" : "buf"} onClick={() => onGo(id === "home" ? "/" : `/${id}`)}>
            <span className="nr">{index + 1}</span>{label}
          </button>
        ))}
      </div>
      <label className="search-lg"><input aria-label={text.search} placeholder={text.search} onFocus={() => onGo("/search")} /></label>
      <div className="nav-actions">{actions}</div>
    </div>
  );
}
