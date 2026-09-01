import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Export one form as an MPage-compliant deployable folder.
 *
 * Usage: node export-mpage.mjs <form-dir> [--name <app-name>] [--theme cerner]
 *   <form-dir> must contain index.jsx and (optionally) Identity.json —
 *   i.e. the same folder shape our MOIS export emits.
 *
 * Output: dist-mpage/<app-name>/ — copy it to the Cerner content server under
 * custom_mpage_content/<app-name>/ and register per DEPLOY.md inside.
 */

const here = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
if (args.length === 0) {
  console.error("usage: node export-mpage.mjs <form-dir> [--name <app-name>] [--theme cerner]");
  process.exit(1);
}

const formDir = resolve(args[0]);
let name = "";
let theme = "";
for (let i = 1; i < args.length; i++) {
  if (args[i] === "--name") name = args[++i] ?? "";
  if (args[i] === "--theme") theme = args[++i] ?? "";
}

const sourcePath = join(formDir, "index.jsx");
if (!existsSync(sourcePath)) {
  console.error("No index.jsx in " + formDir);
  process.exit(1);
}
let identity = {};
const identityPath = join(formDir, "Identity.json");
if (existsSync(identityPath)) {
  identity = JSON.parse(readFileSync(identityPath, "utf8"));
}
const formId = name || identity.name || "form";
const appName = "webforms-" + formId;

console.log("Building player...");
execFileSync("pnpm", ["exec", "vite", "build"], { cwd: here, stdio: "inherit" });

const dist = join(here, "dist");
const out = join(here, "dist-mpage", appName);
rmSync(out, { recursive: true, force: true });
mkdirSync(dirname(out), { recursive: true });
cpSync(dist, out, { recursive: true });

// Replace the bundled sample forms with just this one.
rmSync(join(out, "forms"), { recursive: true, force: true });
const outFormDir = join(out, "forms", formId);
mkdirSync(outFormDir, { recursive: true });
cpSync(formDir, outFormDir, { recursive: true });

// Bake the form selection (and theme) into the page so no query string is
// needed when PowerChart redirects here.
const indexPath = join(out, "index.html");
const config = { formId, ...(theme ? { theme } : {}) };
const inject = `<script>window.WEBFORMS_PLAYER_CONFIG=${JSON.stringify(config)}</script>`;
writeFileSync(
  indexPath,
  readFileSync(indexPath, "utf8").replace(/<head([^>]*)>/i, `<head$1>${inject}`),
);

// Drop dev-only artifacts from the deployable.
rmSync(join(out, "mock-powerchart-global.js"), { force: true });
rmSync(join(out, "examples.html"), { force: true });

const title = identity.title || formId;
writeFileSync(
  join(out, "DEPLOY.md"),
  `# Deploying ${title} as a Cerner MPage

1. Copy this folder to the Cerner content server:
   <CONTENT_SERVICE_URL>/custom_mpage_content/${appName}/
   (CONTENT_SERVICE_URL is the dm_info row INS / CONTENT_SERVICE_URL.)

2. Full-screen MPage: point the chart-level MPage's CCL redirect at
   "custom_mpage_content/${appName}/index.html" (relative path resolves
   against the content service; an absolute https URL to another host also
   works if the workstation can reach it).

3. Workflow component (optional): create the Bedrock custom component with
   an mp_label, then register the mapping row:
   info_domain = "Clinical Office Component" (or our own domain),
   info_name   = <mp_label>,
   info_char   = path or absolute URL to this folder.

4. Freshness: file names are stable on purpose; the page carries no-cache
   metas and the component path should be served with a cache-busting query
   by the resolving script.

Entry: index.html (form "${formId}" baked in via WEBFORMS_PLAYER_CONFIG).
`,
);

console.log("MPage export ready: " + out);
