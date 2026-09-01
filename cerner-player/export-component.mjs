import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Export the Workflow custom element as a registrable component folder.
 *
 * Usage: node export-component.mjs [<form-dir> ...]
 *   Each form dir (index.jsx + Identity.json) is bundled under forms/<name>
 *   so placements can pick a form via the form-id attribute.
 *
 * Output: dist-mpage/webforms-player/ — one JS file + forms + REGISTER.md.
 * The folder name doubles as the custom-element tag per the component
 * resolution convention (tag = last URL segment).
 */

const here = dirname(fileURLToPath(import.meta.url));
const TAG = "webforms-player";

console.log("Building component bundle...");
execFileSync("pnpm", ["exec", "vite", "build", "--config", "vite.element.config.ts"], {
  cwd: here,
  stdio: "inherit",
});

const out = join(here, "dist-mpage", TAG);
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
cpSync(join(here, "dist-element", "webforms-player.js"), join(out, "webforms-player.js"));

const formDirs = process.argv.slice(2);
const formIds = [];
for (const dir of formDirs.length ? formDirs : [join(here, "public/forms/demo")]) {
  const formDir = resolve(dir);
  if (!existsSync(join(formDir, "index.jsx"))) {
    console.error("Skipping " + formDir + " (no index.jsx)");
    continue;
  }
  let name = "form";
  const identityPath = join(formDir, "Identity.json");
  if (existsSync(identityPath)) {
    name = JSON.parse(readFileSync(identityPath, "utf8")).name || name;
  }
  cpSync(formDir, join(out, "forms", name), { recursive: true });
  formIds.push(name);
}

writeFileSync(
  join(out, "REGISTER.md"),
  `# Registering the ${TAG} Workflow component

Full procedure: packages/cerner-player/DEPLOYMENT.md

Deploy: copy this folder to
  I:\\Winintel\\Static_Content\\custom_mpage_content\\${TAG}
(or an HTTPS origin), then Refresh custom_mpage_content from the MPages
Static Content Management Page.

KEEP THE FOLDER NAME "${TAG}". The component framework derives both the
script filename and the custom-element tag from the last path segment:
  <script type="module" src="{path}/${TAG}.js{cache}">
  <${TAG} title="{Bedrock label}" path="{path}"></${TAG}>

## 1. Per-domain, once
The Workflow host page needs a component namespace that resolves a Bedrock
label to a URL and mounts the element as above (Clinical Office ships
clinical_office.mpage_component in
custom_mpage_content\\custom-components\\js\\custom-components.js). Our
element implements that exact contract.

## 2. Bedrock
Quality Reporting and MPage Setup -> View Builder -> Build and Maintain Views:
add a view with N Workflow Custom Components + Workflow MPage-level Settings.
Then MPage Setup -> Define MPage Layout -> components in column 1 -> set each
component's label and Namespace.

## 3. Label -> path mapping (dm_info)
  info_domain = "Clinical Office Component"   (or the site's own domain)
  info_name   = <the Bedrock label>
  info_char   = custom_mpage_content/${TAG}   (or an absolute URL)

## 4. prefmaint (Chart branch only — components need patient context)
Add a Discern Report tab pointing at the Workflow host page; patient context
travels in ITS query string, which our component reads (pId/eId/uId):
  <url>$DM_INFO:CONTENT_SERVICE_URL$/mp-content/idx.html?m=^CHT^&pId=$PAT_PERSONID$&eId=$VIS_ENCNTRID$&uId=$USR_PERSONID$&pCd=$USR_PositionCd$&ppr=$PAT_PPRCode$&app=^$APP_AppName$^&vId="<BEDROCK_VIEW_ID>"&sLoc=""

Bundled forms: ${formIds.join(", ") || "(none)"} — select per placement with
the form-id attribute; theme="cerner" for PowerChart chrome.

## 5. Server side
Requires nh_wf_entry:group1 and friends compiled in the domain
(packages/cerner-ccl).
`,
);

console.log("Component export ready: " + out);
