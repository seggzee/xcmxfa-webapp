import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),

    VitePWA({
      /**
       * PHASE 0 UPDATE STRATEGY
       * - Use PROMPT flow, not autoUpdate
       * - User decides when to reload into the new version
       *
       * IMPORTANT
       * - This avoids surprise reloads during use
       * - App shell/offline support remains enabled
       */
      registerType: "prompt",
      injectRegister: false,

      manifest: {
        name: "XCMXFA App",
        short_name: "TEST-APP",
        description: "XCMXFA crew webapp",
        start_url: "/",
        scope: "/",
        display: "standalone",
        theme_color: "#0A1F44",
        background_color: "#0A1F44",
        icons: [
          {
            src: "/pwa-icons/icon-192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "/pwa-icons/icon-512.png",
            sizes: "512x512",
            type: "image/png",
          },
          {
            src: "/pwa-icons/icon-maskable-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },

      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,webp,woff2}"],

        // SPA shell fallback
        navigateFallback: "index.html",

        // Phase 0 rule:
        // - do not "offline-cache" API responses as product data
        navigateFallbackDenylist: [/^\/api\//],
      },

      devOptions: {
        enabled: false,
      },
    }),
  ],

  server: {
    host: true,
  },
});