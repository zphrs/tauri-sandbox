import { defineConfig } from "vite"
import { VitePWA } from "vite-plugin-pwa"
import mkcert from "vite-plugin-mkcert"

const host = process.env.TAURI_DEV_HOST;

export default defineConfig({
  plugins: [
    // VitePWA({
    //   registerType: "autoUpdate",
    //   strategies: "injectManifest",
    //   srcDir: "src",
    //   filename: "sw.ts",
    //   devOptions: {
    //     enabled: true,
    //   },
    // }),
    mkcert(),
  ],
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
        protocol: "ws",
        host,
        port: 1421,
      }
      : undefined,
    watch: {
      ignored: ["**/src-tauri/**", "**/subdomain/**"]
    }
  },
})
