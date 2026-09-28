import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  root: "web",
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      "/api": `http://127.0.0.1:${process.env.SOLVAA_API_PORT || 3008}`,
      "/health": `http://127.0.0.1:${process.env.SOLVAA_API_PORT || 3008}`,
    },
  },
  build: { outDir: "../dist", emptyOutDir: true },
});
