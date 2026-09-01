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
  `# Deploying ${title} as a full-page Cerner MPage

Entry: index.html (form "${formId}" baked in via WEBFORMS_PLAYER_CONFIG).
Full procedure and the Workflow-component variant: packages/cerner-player/DEPLOYMENT.md

1. Copy this folder to either
     I:\\Winintel\\Static_Content\\custom_mpage_content\\${appName}
   or any HTTPS origin the clinical workstations can reach.

2. WebSphere only: open the MPages Static Content Management Page, find
   custom_mpage_content and click Refresh. Files are not live until you do.
     select manager_url = build(info_char, "/manager")
     from dm_info where info_domain = "INS" and info_name = "CONTENT_SERVICE_URL"
     with maxrec = 1

3. prefmaint -> PowerChart -> Position -> expand Chart (patient context) or
   Organizer -> Add Tab -> move "Discern Report" across -> OK.

4. On the new tab set:
     VIEW_CAPTION          = the name clinicians see
     WEB_BROWSER_SELECTION = 1-Edge Chromium   (per-tab; our tab can be modern
                             even if other MPages in the domain are not)

5. Expand the tab's Discern Report sub-branch and set REPORT_NAME
   (keep the <url> prefix and the explicit index.html):
     <url>$DM_INFO:CONTENT_SERVICE_URL$/custom_mpage_content/${appName}/index.html
   or, hosting it ourselves:
     <url>https://your.host/${appName}/index.html

6. Server side: nh_wf_entry:group1 and its whitelisted scripts must be
   compiled in the domain (packages/cerner-ccl).

Serving from a non-Cerner origin also needs CORS headers for the PowerChart
origin (index.jsx is fetched, and component scripts are modules).
`,
);

console.log("MPage export ready: " + out);
