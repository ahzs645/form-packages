# Deploying the Web Forms player into PowerChart

Two deployment shapes, both verified against Oracle Health / Clinical Office
documented procedure. Nothing here requires the Clinical Office product — the
mechanisms (static content folder, prefmaint tabs, Bedrock components) are
Cerner's own.

## Where the files go

Either host is supported:

- **Cerner WebSphere static content** —
  `I:\Winintel\Static_Content\custom_mpage_content\<app-folder>`
  After copying, open the **MPages Static Content Management Page**, find
  `custom_mpage_content`, and click **Refresh** — files are not live on the
  JVM until that refresh runs.
  The management page's URL is derived from
  `dm_info` where `info_domain = "INS"` and `info_name = "CONTENT_SERVICE_URL"`,
  plus `/manager`:

  ```sql
  select manager_url = build(info_char, "/manager")
  from dm_info where info_domain = "INS" and info_name = "CONTENT_SERVICE_URL"
  with maxrec = 1
  ```

- **Our own web server** — any HTTPS origin the clinical workstations can
  reach. Cross-origin hosting needs CORS headers (see below).

## A. Full-page MPage (chart tab or organizer tab)

1. `pnpm --filter @webforms/cerner-player export:mpage <form-dir> --name <id>`
   and copy `dist-mpage/webforms-<id>/` to the chosen host.
2. Refresh `custom_mpage_content` from the Management Page (WebSphere only).
3. `prefmaint` → PowerChart → the Position → expand **Chart** (patient
   context) or **Organizer** (no patient) → **Add Tab** → move
   **Discern Report** into the existing tabs → OK.
4. On the new tab set:
   - `VIEW_CAPTION` — the name clinicians see.
   - `WEB_BROWSER_SELECTION` — **1-Edge Chromium**. This is per-tab, so our
     tab can run the modern engine regardless of what other MPages in the
     domain use. If this option is unavailable in the domain's Millennium
     version, that is the trigger for the Tier-2 launch-out shell.
5. Expand the tab's **Discern Report** sub-branch and set `REPORT_NAME` to a
   URL literal — note the `<url>` prefix and the explicit `index.html`:

   ```
   <url>$DM_INFO:CONTENT_SERVICE_URL$/custom_mpage_content/webforms-<id>/index.html
   ```

   or for our own origin:

   ```
   <url>https://forms.example.org/webforms-<id>/index.html
   ```

   `$DM_INFO:CONTENT_SERVICE_URL$` resolves per domain, so the same
   preference value moves cleanly between build/cert/prod.

No CCL redirect script is needed for this path — PowerChart loads the URL
directly.

## B. Workflow component (embedded in a Workflow MPage)

Requires a one-time, per-domain enablement of the component namespace, then
per-component registration.

1. **Per domain, once** — the host page needs a component namespace that
   knows how to fetch and mount our element. Clinical Office ships one
   (`clinical_office.mpage_component` added to
   `custom_mpage_content\custom-components\js\custom-components.js`); it
   resolves a component by calling a CCL program with the Bedrock label and
   then injects

   ```js
   <script type="module" src="{url}/{component}.js{cache}">
   <{component} title="{headerTitle}" path="{url}"></{component}>
   ```

   Our element implements exactly that contract (`title`, `path`, tag =
   folder name), so it works under that namespace or under an equivalent
   one written for NH.
2. `pnpm --filter @webforms/cerner-player export:component <form-dir>…`
   and copy `dist-mpage/webforms-player/` to the host. Keep the folder name:
   the tag is derived from the last path segment.
3. Bedrock → **Quality Reporting and MPage Setup** → **View Builder** →
   Build and Maintain Views → add a view with N **Workflow Custom
   Components** and **Workflow MPage-level Settings**.
4. Bedrock → **MPage Setup** → find the view → **Define MPage Layout** →
   place components in column 1 → for each component set the label and set
   **Namespace** to the namespace from step 1.
5. Map the Bedrock label to our folder/URL (Clinical Office's setup MPage
   does this by writing a `dm_info` row; the equivalent row is
   `info_domain = "Clinical Office Component"`, `info_name = <label>`,
   `info_char = custom_mpage_content/webforms-player` or an absolute URL).
6. `prefmaint` → Chart branch only (components need patient context) → add a
   **Discern Report** tab whose `REPORT_NAME` points at the Workflow host
   page, e.g.

   ```
   <url>$DM_INFO:CONTENT_SERVICE_URL$/mp-content/idx.html?m=^CHT^&pId=$PAT_PERSONID$&eId=$VIS_ENCNTRID$&uId=$USR_PERSONID$&pCd=$USR_PositionCd$&ppr=$PAT_PPRCode$&app=^$APP_AppName$^&vId="<BEDROCK_VIEW_ID>"&sLoc=""
   ```

   Those `pId` / `eId` / `uId` query parameters are how patient context
   reaches an embedded component — `resolveChartContext` reads them (and the
   `$PAT_PersonId$` CCL macros remain the fallback).

## Cross-origin hosting checklist

Serving from our own origin rather than WebSphere requires:

- `Access-Control-Allow-Origin` for the PowerChart origin — module scripts
  and `fetch` for `forms/*/index.jsx` are both CORS-governed.
- No `X-Frame-Options` / `frame-ancestors` blocking, if the host frames us.
- HTTPS reachable from clinical workstations (proxy/allow-list may apply).

## Server side

Both shapes need `nh_wf_entry:group1` and its whitelisted scripts compiled in
the domain — see `packages/cerner-ccl`.
