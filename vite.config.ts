import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  server: {
    port: 5173,
    strictPort: true,
  },
  envPrefix: ["VITE_", "TAURI_"],
  build: {
    target: ["es2023", "safari17"],
    minify: !process.env.TAURI_DEBUG ? "esbuild" : false,
    sourcemap: !!process.env.TAURI_DEBUG,
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) {
            return undefined;
          }

          if (
            id.includes("react-markdown") ||
            id.includes("remark-") ||
            id.includes("rehype-") ||
            id.includes("marked")
          ) {
            return "vendor-markdown";
          }

          if (
            id.includes("@tiptap")
          ) {
            return "vendor-tiptap";
          }

          if (id.includes("prosemirror")) {
            return "vendor-prosemirror";
          }

          if (id.includes("@codemirror") || id.includes("codemirror")) {
            return "vendor-codemirror";
          }

          if (id.includes("docx")) {
            return "vendor-export";
          }

          return undefined;
        },
      },
    },
  },
});
