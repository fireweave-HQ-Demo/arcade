import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    host: "0.0.0.0",
    port: 5173,
    strictPort: true,
    watch: { usePolling: true, interval: 300 },
    proxy: { "/api": process.env.API_PROXY ?? "http://127.0.0.1:3000" },
  },
  preview: {
    port: 5173,
    // SPA deep links (/play/…, /scoreboard) → index.html
    proxy: { "/api": process.env.API_PROXY ?? "http://127.0.0.1:3000" },
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    target: "esnext",
  },
});
