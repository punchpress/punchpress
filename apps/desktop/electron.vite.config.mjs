import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, externalizeDepsPlugin } from "electron-vite";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  main: {
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, "src-electron/index.ts"),
        },
      },
    },
    plugins: [externalizeDepsPlugin()],
  },
  preload: {
    build: {
      rollupOptions: {
        input: {
          preload: resolve(__dirname, "src-electron/preload.ts"),
        },
      },
    },
    plugins: [externalizeDepsPlugin()],
  },
  renderer: {
    cacheDir: resolve(__dirname, "node_modules/.vite-electron-renderer"),
    build: {
      rollupOptions: {
        input: {
          dummy: resolve(__dirname, "src-electron/renderer-dummy.js"),
        },
      },
    },
  },
});
