import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  return {
    plugins: [react()],
    // Expose PUBLIC_FW_* (and VITE_*) to import.meta.env for the FireWeave web harness.
    envPrefix: ["VITE_", "PUBLIC_"],
    define: {
      // Fallback so local docker/host can inject from process env without a .env.local
      "import.meta.env.PUBLIC_FW_API_URL": JSON.stringify(
        env.PUBLIC_FW_API_URL || process.env.PUBLIC_FW_API_URL || "https://app-server.fireweave.ai",
      ),
      "import.meta.env.PUBLIC_FW_PROJECT_API_KEY": JSON.stringify(
        env.PUBLIC_FW_PROJECT_API_KEY || process.env.PUBLIC_FW_PROJECT_API_KEY || "",
      ),
    },
    server: {
      host: "0.0.0.0",
      port: 5173,
      strictPort: true,
      watch: { usePolling: true, interval: 300 },
      proxy: { "/api": process.env.API_PROXY ?? "http://127.0.0.1:3000" },
    },
    preview: {
      port: 5173,
      proxy: { "/api": process.env.API_PROXY ?? "http://127.0.0.1:3000" },
    },
    build: {
      outDir: "dist",
      emptyOutDir: true,
      target: "esnext",
    },
  };
});
