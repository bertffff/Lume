import { useEffect, useState } from "react";
import { viewFromPath, views, type View } from "./views.js";

/** Path, connectivity and viewport state for the app shell; `go` is a plain history push that other hooks can reuse. */
export function useRouter(roomId: string | null, joiningInvite: boolean) {
  const [path, setPath] = useState(() => window.location.pathname);
  const [shot] = useState(() => new URLSearchParams(window.location.search).get("shot"));
  const [offline, setOffline] = useState(() => !window.navigator.onLine);
  const [narrow, setNarrow] = useState(() => window.innerWidth < 800);

  useEffect(() => {
    const onResize = () => setNarrow(window.innerWidth < 800);
    const onPop = () => setPath(window.location.pathname);
    const onOff = () => setOffline(true);
    const onOn = () => setOffline(false);
    window.addEventListener("resize", onResize);
    window.addEventListener("popstate", onPop);
    window.addEventListener("offline", onOff);
    window.addEventListener("online", onOn);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("popstate", onPop);
      window.removeEventListener("offline", onOff);
      window.removeEventListener("online", onOn);
    };
  }, []);

  function go(next: string) {
    window.history.pushState({}, "", next);
    setPath(next);
    window.dispatchEvent(new PopStateEvent("popstate"));
  }

  const view: View = shot && views.has(shot as View) ? (shot as View) : offline ? "offline" : roomId ? "room" : joiningInvite ? "join" : viewFromPath(path);
  return { path, shot, offline, narrow, go, view };
}
