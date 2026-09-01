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
  `# Registering the webforms-player Workflow component

Deploy: copy this folder to
  <CONTENT_SERVICE_URL>/custom_mpage_content/${TAG}/
(base URL = dm_info row INS / CONTENT_SERVICE_URL). The folder name must stay
"${TAG}" — component hosts derive the custom-element tag from the last URL
segment.

## 1. Bedrock
Create the custom Workflow/Chart component and note its mp_label
(convention: filter_mean CUSTOM_COMP_* with an mp_label value).

## 2. Mapping row (dm_info)
| column | value |
|---|---|
| info_domain | Clinical Office Component (or the site's own component domain) |
| info_name   | <the Bedrock mp_label> |
| info_char   | custom_mpage_content/${TAG} (or an absolute https URL) |

Insert via the site's component-registration tooling, or:
  insert into dm_info d
  set d.info_domain = "Clinical Office Component",
      d.info_name = "<mp_label>",
      d.info_char = "custom_mpage_content/${TAG}",
      d.info_number = 0 ;commit

## 3. Placement attributes
  <${TAG} person_id="$PAT_PersonId$" encntr_id="$VIS_EncntrId$"
      form-id="${formIds[0] ?? "demo"}" theme="cerner"
      content-root="<CONTENT_SERVICE_URL>/custom_mpage_content/${TAG}">
Bundled forms: ${formIds.join(", ") || "(none)"} — one placement per form via
form-id. content-root is required when embedded (relative fetches resolve
against the host page otherwise).

## 4. Server side
Requires nh_wf_entry:group1 and friends compiled in the domain
(packages/cerner-ccl).
`,
);

console.log("Component export ready: " + out);
