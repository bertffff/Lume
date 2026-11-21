import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  envDir: "../..",
  appType: "spa",
  plugins: [react(), tailwindcss()],
  server: {
    host: true,
    port: 5173,
  },
  build: {
    // Explicit budget: the entry, hls.js and LiveKit chunks are lazy but still
    // large. Anything above this limit is a real regression and warns again.
    chunkSizeWarningLimit: 720,
  },
});
