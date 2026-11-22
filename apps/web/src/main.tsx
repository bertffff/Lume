import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.js";
import "./styles/global.css";
import "@fontsource/geologica/cyrillic-600.css";
import "@fontsource/geologica/cyrillic-700.css";
import "@fontsource/onest/cyrillic-400.css";
import "@fontsource/onest/cyrillic-500.css";
import "@fontsource/onest/cyrillic-600.css";
import "@fontsource/jetbrains-mono/cyrillic-400.css";
import "@fontsource/jetbrains-mono/cyrillic-500.css";
import "@fontsource/jetbrains-mono/cyrillic-600.css";
import "./design/cinema.css";
import "./design/gruvbox.css";
import "./design/telerave.css";
import "./design/surfaces.css";
import "./design/layout.css";
import "./design/room.css";

const root = document.getElementById("root");
if (!root) {
  throw new Error("root element is missing");
}

// Specimen sheet for the design system. Guarded by MODE, not DEV: the root .env sets NODE_ENV=development,
// which would otherwise keep this branch in a local `vite build`.
if (import.meta.env.MODE === "development" && window.location.pathname.startsWith("/__design")) {
  void import("./gallery/mount.js").then(({ mountGallery }) => mountGallery(root));
} else {
  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}
