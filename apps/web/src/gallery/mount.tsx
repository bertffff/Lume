import { createRoot } from "react-dom/client";
import "../ds/index.js";
import { Gallery } from "./Gallery.js";

export function mountGallery(root: HTMLElement): void {
  createRoot(root).render(<Gallery />);
}
