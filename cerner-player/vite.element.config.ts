import path from "node:path";
import { defineConfig, type UserConfig } from "vite";

import baseConfig from "./vite.config";

// Workflow-component build: one self-contained IIFE (dynamic imports inlined
// — no code-splitting allowed when the host loads us as a single script).
// Reuses only resolve/plugins from the app config; the app's multi-page
// rollup inputs must not leak in here (they conflict with inlining).
const base = baseConfig as UserConfig;

export default defineConfig({
  base: "./",
  publicDir: false,
  plugins: base.plugins,
  resolve: base.resolve,
  build: {
    outDir: "dist-element",
    target: "es2020",
    lib: {
      entry: path.resolve(__dirname, "src/element.tsx"),
      formats: ["iife"],
      name: "WebformsPlayer",
      fileName: () => "webforms-player.js",
    },
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
        entryFileNames: "webforms-player.js",
        assetFileNames: "[name][extname]",
      },
    },
  },
});
