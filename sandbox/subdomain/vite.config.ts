import { defineConfig, loadEnv } from "vite"
import { VitePWA } from "vite-plugin-pwa"
import inlineSource from "vite-plugin-inline-source"
import mkcert from "vite-plugin-mkcert"
export default ({ mode }) => {
  process.env = { ...process.env, ...loadEnv(mode, process.cwd()) }
  return defineConfig({
    plugins: [
      VitePWA({
        injectRegister: null,
        strategies: "injectManifest",
        srcDir: "src/sw",
        injectManifest: {
          injectionPoint: undefined,
        },
        manifest: false,
        filename: "sw.ts",
        devOptions: {
          enabled: true,
          type: "module",
        },
      }),
      inlineSource(),
      mkcert({
        force: true,
      }),
    ],
    server: {
      cors: true,
      port: 5273,
    },
    preview: {
      cors: true,
      port: 5273,
      proxy: {
        "^pg-doc-id/.*": {
          target: process.env.VITE_SUBDOMAIN_WILDCARD_URL,
          secure: true,
        },
      },
    },
  })
}
