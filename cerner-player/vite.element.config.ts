import path from "node:path";
import { defineConfig, type UserConfig } from "vite";

import baseConfig from "./vite.config";

// Workflow-component build: one self-contained ES module. Cerner's component
// framework injects <script type="module" src="{path}/{tag}.js{cache}">, so
// the artifact must be a module named after the folder, with dynamic imports
// inlined (no code-splitting — the host loads exactly one file).
// Cross-origin hosting therefore needs CORS headers: module scripts are
// fetched with CORS even when a classic script would not be.
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
      formats: ["es"],
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
