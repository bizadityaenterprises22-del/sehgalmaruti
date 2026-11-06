import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";
import { fileURLToPath, URL } from "node:url";
import { readFileSync } from "node:fs";

const pkg = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf-8")) as { version: string };
const stamp = new Date().toISOString().slice(0, 16).replace("T", " ");

// GOLDEN STACK app - React 19.2 / TS 6.0 / Vite 8.2 / Tailwind 4.3 / PWA 1.3 / Router 7.18 /
// TanStack 5 / Zustand 5 / Supabase 2.111 - ONE gateway src/app/api.ts. Wrapped for Android by
// Capacitor 8 (capacitor.config.ts). Backend = Supabase project "Sehgal Hero" (Sehgal Maruti).
export default defineConfig({
  define: { __APP_VERSION__: JSON.stringify(`${pkg.version} ${stamp} UTC`) },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      manifest: {
        name: "Sehgal Maruti",
        short_name: "Sehgal Maruti",
        description: "Sehgal Maruti Dealership App — W2 Portal, Vehicle History, Two-State Holdup, CRM (SMR & PSF) and Insurance Calling.",
        theme_color: "#0f2342",
        background_color: "#0f2342",
        display: "standalone",
        orientation: "any",
        start_url: "./",
        scope: "./",
        icons: [
          { src: "icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
          { src: "icon.svg", sizes: "any", type: "image/svg+xml", purpose: "maskable" },
        ],
      },
      workbox: { globPatterns: ["**/*.{js,css,html,svg,woff2}"], maximumFileSizeToCacheInBytes: 4 * 1024 * 1024 },
    }),
  ],
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  server: { port: 5205, strictPort: true },
  test: { environment: "node", include: ["src/**/*.test.ts"], testTimeout: 30000, hookTimeout: 30000 },
});
