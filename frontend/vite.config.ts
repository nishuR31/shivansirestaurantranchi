import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { TanStackRouterVite } from "@tanstack/router-plugin/vite";

export default defineConfig({
  plugins: [TanStackRouterVite({ autoCodeSplitting: true }), react(), tailwindcss()],
  resolve: {
    dedupe: ["react", "react-dom"],
    tsconfigPaths: true,
  } as any,
  server: {
    port: 5173,
    strictPort: false,
    proxy: {
      "/api": {
        target: "http://127.0.0.1:3000",
        changeOrigin: true,
      },
      "/socket.io": {
        target: "http://127.0.0.1:3000",
        ws: true,
        changeOrigin: true,
      },
    },
  },
  build: {
    // Raise the warning threshold slightly — after splitting, no chunk should
    // exceed this. Keep it tight to catch regressions early.
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks(id) {
          // ── React core ──────────────────────────────────────────────────
          // Tiny, changes rarely → long-lived cache hit on every deploy.
          if (
            id.includes("node_modules/react/") ||
            id.includes("node_modules/react-dom/") ||
            id.includes("node_modules/scheduler/")
          ) {
            return "vendor-react";
          }

          // ── TanStack (router + query) ────────────────────────────────────
          if (id.includes("node_modules/@tanstack/")) {
            return "vendor-tanstack";
          }

          // ── Radix UI primitives ──────────────────────────────────────────
          if (id.includes("node_modules/@radix-ui/")) {
            return "vendor-radix";
          }

          // ── Charts (Recharts + D3 internals) — only used on admin pages ──
          if (
            id.includes("node_modules/recharts") ||
            id.includes("node_modules/d3-") ||
            id.includes("node_modules/victory-vendor")
          ) {
            return "vendor-charts";
          }

          // ── Icon set (lucide-react is ~300 kB unminified) ────────────────
          if (id.includes("node_modules/lucide-react")) {
            return "vendor-icons";
          }

          // ── Redux ────────────────────────────────────────────────────────
          if (
            id.includes("node_modules/@reduxjs/") ||
            id.includes("node_modules/react-redux/") ||
            id.includes("node_modules/redux/") ||
            id.includes("node_modules/immer/")
          ) {
            return "vendor-redux";
          }

          // ── Everything else (Zod, date-fns, sonner, vaul, axios …) ───────
          if (id.includes("node_modules/")) {
            return "vendor-misc";
          }
        },
      },
    },
  },
});
