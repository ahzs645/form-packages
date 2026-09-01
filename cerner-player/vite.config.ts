import react from "@vitejs/plugin-react";
import fs from "node:fs";
import path from "node:path";
import { defineConfig, type Plugin } from "vite";

/**
 * Dev-only: serve the downloaded Cerner example repos at /cerner-examples/<key>/
 * with the mock PowerChart bridge injected into every HTML page, so their
 * checked-in production builds run locally. Nothing is copied into this repo
 * (several of the example trees are proprietary).
 */
const EXAMPLE_ROOTS: Record<string, string> = {
  co: "/Users/ahmadjalil/Downloads/Cerner",
  cst: "/Users/ahmadjalil/Downloads/Cerner/cst-future-orders-edge-master",
  ets: "/Users/ahmadjalil/Downloads/Cerner/ets-clinical-framework-main",
  dash: "/Users/ahmadjalil/Downloads/Cerner/cer-dashboard-main",
  ccls: "/Users/ahmadjalil/Downloads/Cerner/CCLS_Demo-v1",
  lab: "/Users/ahmadjalil/Downloads/Cerner/code-learning-lab-main",
  terra: "/Users/ahmadjalil/Downloads/Cerner/terra-core-main",
};

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".htm": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".mjs": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".map": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
};

function cernerExamplesPlugin(): Plugin {
  return {
    name: "cerner-examples",
    configureServer(server) {
      server.middlewares.use("/cerner-examples", (req, res, next) => {
        try {
          const pathname = decodeURIComponent((req.url || "/").split("?")[0]);
          const segments = pathname.split("/").filter(Boolean);
          const root = EXAMPLE_ROOTS[segments[0]];
          if (!root) return next();
          let filePath = path.join(root, ...segments.slice(1));
          const resolved = path.resolve(filePath);
          if (resolved !== root && !resolved.startsWith(root + path.sep)) {
            res.statusCode = 403;
            return res.end("forbidden");
          }
          let stat = fs.statSync(resolved, { throwIfNoEntry: false });
          if (stat?.isDirectory()) {
            filePath = path.join(resolved, "index.html");
            stat = fs.statSync(filePath, { throwIfNoEntry: false });
          } else {
            filePath = resolved;
          }
          if (!stat?.isFile()) {
            res.statusCode = 404;
            return res.end("not found: " + pathname);
          }
          const ext = path.extname(filePath).toLowerCase();
          let data: Buffer = fs.readFileSync(filePath);
          if (ext === ".html" || ext === ".htm") {
            const inject = '<script src="/mock-powerchart-global.js"></script>';
            let html = data.toString("utf8");
            html = /<head[^>]*>/i.test(html)
              ? html.replace(/<head([^>]*)>/i, `<head$1>${inject}`)
              : inject + html;
            data = Buffer.from(html);
          }
          res.setHeader("Content-Type", MIME[ext] ?? "application/octet-stream");
          res.setHeader("Cache-Control", "no-store");
          res.end(data);
        } catch (error) {
          next(error);
        }
      });
    },
  };
}

// Cerner content-server constraints: relative asset paths (unknown mount
// depth) and stable file names (the registered path must not change per
// build; freshness comes from no-cache metas / server-side cache busting).
export default defineConfig({
  base: "./",
  plugins: [react(), cernerExamplesPlugin()],
  resolve: {
    // The workspace packages carry their own peer-dep installs; without
    // dedupe the player and @mois/form-components load separate React and
    // Fluent instances (invalid-hook-call / broken style contexts).
    dedupe: ["react", "react-dom", "@fluentui/react", "@babel/standalone", "immer"],
    // Order matters: subpath aliases must precede the bare package alias.
    alias: [
      // MarkdownEditor rides the form-components barrel but never renders in
      // the player; stubbing Milkdown keeps ~1MB of editor out of the bundle.
      { find: /^@milkdown\/.*/, replacement: path.resolve(__dirname, "src/stubs/milkdown.ts") },
      {
        find: "@mois/form-components/nhforms/next",
        replacement: path.resolve(__dirname, "../form-components/src/nhforms/index.next.ts"),
      },
      {
        find: "@mois/form-components",
        replacement: path.resolve(__dirname, "../form-components/src/index.ts"),
      },
      {
        find: "@mois/form-engine-core",
        replacement: path.resolve(__dirname, "../form-engine-core/src/index.ts"),
      },
      {
        find: "@webforms/cerner-core",
        replacement: path.resolve(__dirname, "../cerner-core/src/index.ts"),
      },
      {
        find: "@webforms/form-model",
        replacement: path.resolve(__dirname, "../form-model/src/index.ts"),
      },
    ],
  },
  build: {
    outDir: "dist",
    target: "es2020",
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, "index.html"),
        "smart-launch": path.resolve(__dirname, "smart-launch.html"),
        "smart-app": path.resolve(__dirname, "smart-app.html"),
      },
      output: {
        entryFileNames: "assets/[name].js",
        chunkFileNames: "assets/[name].js",
        assetFileNames: "assets/[name][extname]",
      },
    },
  },
  server: {
    port: 5209,
  },
});
