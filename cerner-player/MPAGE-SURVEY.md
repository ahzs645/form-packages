# What production MPages actually do

Notes from reading ten MPage codebases from three health systems — PHSA
(BC), Covenant Health (TN), and a US multi-facility system — spanning the
IE11 and Edge/WebView2 generations. `PLATFORM-NOTES.md` records what the
platform provides; this records what shipping teams do with it, and where our
own assumptions were confirmed or were missing something.

## Provenance and a licensing boundary

Most of these repos are built on `@clinicaloffice/clinical-office-mpage[-core]`,
which is **proprietary** (`"license": "UNLICENSED"`, served from a private
GitHub Packages registry) and carries an explicit no-copy notice from
Precision Healthcare Solutions. One repo also leaks the library's full
unminified source through checked-in sourcemaps.

Everything below is recorded as **observed wire format and platform
behaviour** — facts about how Cerner's bridge and CCL behave, which are not
the library's copyrightable expression. No vendor source is reproduced, and
`packages/cerner-ccl` remains clean-room. Treat those `.map` files as
contaminated.

## The headline: no Terra anywhere

Zero `terra-*` or `@cerner/*` packages across all ten repos — verified
against source, both `package-lock.json` files, and the committed `dist/`
bundles. What these teams actually ship inside an MPage:

- **Angular Material** — the vendor template's default, themed from a
  generated `theme.scss` and emitted as a separate `material-theme` bundle.
- **ng-zorro-antd (Ant Design)** — in the newest and largest production app.
- **PrimeNG** — in the CST Future Orders apps.
- **Bootstrap 3/4 + DataTables + FontAwesome** — the legacy components,
  loaded off a mapped drive (`I:\mPages\...`).

So our Terra target has **no prior art to copy**. The useful transfer is not
about Terra; it is that a non-Material design system (ng-zorro) demonstrably
ships fine inside an MPage, which de-risks the approach by analogy.

Two constraints that do apply directly to us:

- **Global CSS is treated as radioactive.** The vendor template's
  `styles.scss` is a single line: do not define any global styles, they will
  affect Cerner's own components. This is exactly why `<TerraBase>` is
  scoped and mounted only while a Terra tree is live.
- **Angular's `anyComponentStyle` budget is 2 KB warn / 4 KB error.** Terra's
  per-component CSS blows through that immediately. Not our bundler, but it
  tells you what reviewers there consider normal.

## IE11 → Edge/WebView2: what actually changed

Read from one app that exists in both generations, ~2 years apart.

**The Discern bridge went asynchronous.** Not just the factory — *every*
method returns a promise:

```js
// IE                                        // Edge
window.external.DiscernObjectFactory("POWERORDERS")   → .then(obj => …)
obj.CreateMOEW(...)                                   → .then(hMoew => …)
obj.InvokeActivateAction(...)                         → .then(ok => …)
obj.SignOrders(hMoew)                                 → .then(…)
```

Under Edge, `DiscernObjectFactory` object *properties* are promises too
(`await patientSearchObj.PersonId`), and the property casing is inconsistent
across Cerner builds — production code carries lowercase fallbacks.

Also: `new XMLCclRequest()` becomes available as a bare global, and
synchronous `open(..., false)` is gone.

**Bootstrapping moved to a custom element.** Both Edge-era templates replace
`bootstrap: [AppComponent]` with `ngDoBootstrap` + `createCustomElement`,
guarded by `customElements.get()` because Cerner can load the bundle twice
into one page. The build then concatenates `runtime + main + polyfills` into
one file with `outputHashing: "none"`, so the Cerner-side `<script src>`
never changes. **The React analogue for us is a web-component wrapper around
the Terra root**, so one artifact serves both the full page and a component
slot.

**Dropped in the Edge generation:** `iframe-resizer` (the IE shell iframed
the MPage, so the page had to self-report its height), `classlist.js`,
`polyfills.ts`, `.browserslistrc`, and es5 differential loading.

**Two WebView2 workarounds worth knowing:** icon *fonts* are unreliable, so
production code replaced `<i class="pi pi-search">` with hand-inlined
`<svg>`; and dropdown overlays need `appendTo="body"` to escape clipping.
Terra's Hookshot portal already does the equivalent.

**An unsolved pain point:** relative asset paths do not resolve once a bundle
is loaded into a Cerner page, and the production fix there was to hardcode an
absolute environment-specific hostname into a template. The better answer,
also present in the corpus, is a runtime `assets/config.json` carrying
`contextRoot` plus a domain list, loaded via `APP_INITIALIZER` — one artifact,
N domains, no rebuild.

## Transport: what we had right, and what we were missing

Confirmed unchanged across both library generations, matching what
`@webforms/cerner-core` already implements: `XMLCclRequest` → `setBlobIn` →
positional prompt; the `%PDF` / 492 handling; `$PAT_PersonId$` /
`$VIS_EncntrId$` macros; the `{forcef8}` replacer.

The prompt signature is six slots:

```
OUTDEV, PERSONID, ENCNTRID, USERID, INSTANCE, CONFIG_JSON
```

with the **instance index in slot 5** so CCL can echo it back — that is how a
pooled set of request objects demultiplexes replies. Under the web/proxy
fallback the same call is a form-encoded POST with the blob **hex-encoded**
both ways.

`{forcef8}` is worth restating because it is easy to get wrong: any JSON key
ending `Cd` / `Id` / `Float` whose value is a whole number must be emitted as
a bare float (`123.0`), because CCL types it `f8` and rejects an integer. The
libraries do it by stringifying to `"{forcef8}123.0{forcef8}"` and then
stripping the quotes with a regex.

Genuinely new to us:

- **`1CO_MPAGE_DM_INFO:GROUP1`** — `DM_INFO` used as a per-user key/value
  store through a stock script, with `clearPatientSource: true`. Real
  deployments keep column layouts and last-used form values there. **This is
  a ready-made form-draft/autosave mechanism with no DDL and no domain
  build** — the most directly useful find in the corpus.
- **`reqinfo->updt_app != 600005`** — refuse to write unless the call really
  came from PowerChart; and `reqinfo->updt_id` is the only trustworthy acting
  user id. Never take a user id from the payload.
- **`SET MODIFY MAXVARLEN 50000000`** — without it, large JSON in
  `_memory_reply_string` truncates silently.
- **`IF (CURRDBUSER = "V500_MPAGE") RDB ALTER SESSION SET CURRENT_SCHEMA = V500`**
  — over the MPages web tier the request runs as a different DB user with no
  default schema, so raw `RDB` queries fail. This is the "works in DVDev,
  empty in the MPage" bug.
- **`eks_put_source` with `isblob='1'` and a `gvc` field** — the escape hatch
  for payloads too large for the reply string.
- **`1co_show_service_dir`** in DVDev gives you the proxy target for a
  `/cclproxy` dev-server rewrite: real CCL against a real domain with hot
  reload, instead of compile-and-copy. The single most useful operational tip
  in the corpus.

## Bridge invocations, verbatim

The **discern meta tag**, unquoted attributes and all:

```html
<meta name=discern content=APPLINK,CCLLINK,MPAGES_EVENT,MPAGES_SVC_EVENT,XMLCCLREQUEST,CCLNEWSESSIONWINDOW http-equiv=Content-Type>
```

The longest capability list seen adds `CCLLINKPOPUP, CCLNEWWINDOW, CCLEVENT,
CCLEKSREPLYOBJECT`.

**The `<a id="applink">` trampoline.** Every `javascript:` bridge call is
routed through one hidden anchor rather than called inline, because direct
`window.external.MPAGES_EVENT(...)` calls are unreliable under both IE and
WebView2:

```js
const el = document.getElementById("applink");
el.href = 'javascript:APPLINK(0,"Powerchart.exe","/PERSONID=" + id + "")';
el.click();
```

`APPLINK` mode `0` opens a Cerner app, `100` opens an arbitrary URL;
`$APP_AppName$` targets the current app and `/FIRSTTAB=^Name^` a chart tab.

**Discern objects in use:** `POWERORDERS` (the MOEW create → act → sign →
destroy sequence), `PVVIEWERMPAGE` (order info, doc viewer, procedure
viewer), `PEXSCHEDULINGACTIONS`, `PVPATIENTSEARCHMPAGE` (how an
organizer-level page with no chart context acquires one — cancellation shows
up as an id of `0`, not a rejection).

## Practices worth stealing

- **Offline fixtures from scrambled real responses.** Capture a real CCL
  reply, run it through a PHI scrambler, commit the scrambled file, and
  branch on the same `inMpage` probe the transport already uses. Gives a real
  envelope to test against without PHI.
- **A service-driver CCL program.** One program, many services, dispatched on
  prompt `$2` with a JSON blob in `$3`; `cnvtjsontorec` in,
  `cnvtrectojson(reply, 4)` out. One CCL object to promote through domains
  instead of N, and it maps cleanly onto a `{action, payload}` envelope.
- **Config as a flat file read via `define rtl3`.** Site configuration with no
  table changes and no recompile, with an admin page writing it back.
- **`_Memory_Reply_String` save/restore plus
  `with replace("RECORD_DATA","TEMP_RECORD_DATA")`** when calling a stock
  `mp_*` script, so the callee cannot clobber your record or corrupt the
  reply stream.
- **Auto-bumping the patch version on every build**, surfaced in a corner of
  the UI — the deployed-version-identification story, and a good one.
- **A visible in-page log component, left in the deployed build**, so
  helpdesk can read errors back. WebView2 offers no devtools.

## Practices explicitly not worth copying

- A client-side hardcoded password gating an admin page.
- Feature flags returned as `vc` `"true"` / `"false"` and compared as strings
  — with at least one inverted-logic bug in the corpus.
- `DestroyMOEW` called only inside the success branch, leaking the handle on
  failure.
- Error handling that consists of `go to end_program`, which returns nothing
  and looks identical to "no data".

## The bridge catalogue (added 2026-09-20)

The sections above describe the transport. This one names the **calls**, which
the survey previously left implicit — so the player's mock had to guess and
nothing could check it. Source: `geekmdtravis/fluent-cerner-js` (MIT,
© 2022 geekmdtravis), a wrapper over the native objects an embedded MPage
talks to. Adapted as a description, not copied as code; it now lives as data in
`@webforms/cerner-core` (`MPAGES_EVENTS`, `DISCERN_OBJECTS`) so the mock, the
stage host and any future player share one definition.

### Two facts that shape everything

**Every `MPAGES_EVENT` payload is one pipe-delimited positional string.** There
are no named arguments, so an omitted middle field is `0` or empty — never
absent. Getting a field one place left still "works", it just opens nothing,
which is why both hosts now check arity and report it.

**A bridge call outside PowerChart throws rather than returning.** That is how
a page detects it is not hosted; `outsideOfPowerChartError()` is that test.

### Events

| Event | Payload |
| --- | --- |
| `ALLERGY` | `personId\|encntrId\|allergyId\|nomenId\|substanceDisp\|conceptId\|substanceTypeCd\|substanceTypeDisplay\|viewSeq\|compSeq` — missing from the first catalogue; see the wiki check below. |
| `POWERFORM` | `personId\|encntrId\|formId\|activityId\|chartMode` — a new form carries `formId` with `activityId` 0; a non-zero `activityId` opens that charted form and wins over `formId`; **`0\|0` is the ad-hoc search**. `chartMode` 0 views or modifies, 1 is view-only. |
| `POWERNOTE` | `personId\|encntrId\|CKI\|eventId` — a new note carries an encounter-pathway **CKI** and `eventId` 0; an existing one an empty CKI and the note's CLINICAL_EVENT event id. |
| `CLINICALNOTE` | `personId\|encntrId\|[eventId\|eventId…]\|windowTitle\|viewOptionFlags\|viewName\|viewSeq\|compName\|compSeq` |
| `ORDERS` | `personId\|encntrId\|{order}{order}…\|customizeFlags\|{tab\|display}{…}\|defaultDisplay[\|silentSignFlag]` — six or seven fields. |

**`CLINICALNOTE`'s third field is bracketed and itself pipe-delimited**, so a
plain `split("|")` shreds it and shifts every field after it. Both hosts use a
depth-aware split; `mock-powerchart.test.ts` pins that case specifically.

### The CKI is the interesting one

`POWERNOTE`'s third field is a **Clinical Knowledge Identifier**. *Corrected
2026-09-23:* the MPages Development Wiki spells it out — it is
`CKI_SOURCE!CKI_IDENTIFIER` from `SCR_PATTERN` and names an **encounter
pathway** (`CKI!EPS HAIR LOSS`), not a note template, and certainly not a
Smart Template (those belong to Dynamic Documentation). The stage's
`SMART_TEMPLATE_TRAINING_CKI` is an emulator-only alias in that shape.

### Objects, via `window.external.DiscernObjectFactory`

`POWERORDERS` is the large one and drives the Modal Order Entry Window: it is
created, configured, shown modally, read back, then **destroyed — and it must
be destroyed, or PowerChart leaks the window**. The full method lists are in
`DISCERN_OBJECTS`; both hosts warn on a method that is not in them, because an
unknown method otherwise answers here and fails only in the real client.

### The codecs (added 2026-09-23)

The values *inside* the payloads are now in `@webforms/cerner-core` too:
`discern-codes.ts` encodes and decodes order strings (the `ORDER` / `CANCEL DC`
/ `RENEW_RX` … verbs, origination and interaction codes), the whole `ORDERS`
event (`{tab|display}`, launch view 8/16/32, the PowerPlan flag 24), the three
`CreateMOEW` bitmasks, the `CLINICALNOTE` view flags and `APPLINK` arguments,
and describes any of them in words for a call log. `orders-xml.ts` (on
`fast-xml-parser`) builds and parses the signed-orders reply, with the full
99-field order record, and reads the scratchpad and PowerPlan documents the
MOEW methods take. Both are read from fluent-cerner-js 1.1.x, which took them
from Cerner's MPage developer wiki, so they are its reading of the
documentation rather than values observed in a live client.

Running the unmodified library against the PowerChart stage
(`lib/host-emulators/__tests__/powerchart-mpage-bridge.test.tsx`) turned up
one thing worth knowing: `submitPowerOrdersAsync` calls `DestroyMOEW` only on
its success path. A cancelled or failed submission leaves the handle open,
which is the leak this document warns about above. The stage's bridge now
reports undestroyed handles when the page unloads.

### What it does NOT contain

No Smart Template content whatsoever. The library is overwhelmingly order
entry — 28 of its calls are `POWERORDERS`, 2 are `DYNDOC`, and one each of
`PVCONTXTMPAGE`, `PATIENTEDUCATION` and `DISCHARGEPROCESS`. Anyone sent here
expecting Smart Template definitions should stop and read
`lib/cerner-powerforms/smart-template-*.ts` instead, which is where ours live.

## Checked against Oracle's MPages Development Wiki (2026-09-23)

Everything above that came from fluent-cerner-js has now been read against
the wiki itself (Confluence space MPDEVWIKI, plus the Discern Explorer help).
The catalogue lives in `@webforms/cerner-core`'s `discern-catalog.ts`, with a
wiki page id and an evidence label (`wiki`, `wiki-example`,
`reverse-engineered`) on every object method. What changed:

- **Field names are the wiki's.** POWERFORM's fifth field is `chartMode`,
  POWERNOTE's fourth is `eventId`, ORDERS' fields are `orderLst`,
  `customizeFlags`, `tabLst`, `defaultDisplay`, `silentSignFlag`.
- **ALLERGY is a fifth MPAGES_EVENT** (ten fields) the first catalogue missed.
- **ORDERS may have six fields.** Every MPDEVWIKI example omits
  `silentSignFlag`, and `tabLst` can carry several `{tab|display}` sets
  (`{2|127}{3|127}`). `customizeFlags` 24 is CreateMOEW's 8|16; the wiki
  never ties it to a PowerPlan tab, and it always uses display mask 127 —
  fluent-cerner-js' `{2|0}` is a mask with no search or scratchpad pane, which
  the wiki says cannot add orders.
- **Silent signing only covers new orders.** The wiki: orders sign without
  the window only when no other orderActions are present, so a silent
  `CANCEL DC` shows the MOEW (the stage now does; its test was changed).
- **POWERORDERS has 22 documented methods, not 7** — InvokeCancelDCAction,
  InvokeCompleteAction, InvokeRenewAction(+WithRouting), InvokeResolveActionMOEW,
  GetAvailableOrderActions (a 31-bit mask), AddNewOrderToScratchpad,
  RemoveOrderFromScratchPad, GetScratchPadOrders, IsScratchPadEmptyMOEW (TRUE
  when there IS uncommitted data), AddDiagnosesToOrder, AddPowerPlanMOEW, the
  routing calls — plus CustomizeTabMOEW, which appears only in examples.
  CreateMOEW's bits 2 and 64 exist but are documented as not implemented;
  display bits 128 (plan entry only) and 256 (formulary details) were missing.
- **Twenty objects, not seven**: POWERNOTE, PVFRAMEWORKLINK, PVVIEWERMPAGE,
  TASKDOC, INDEXEDDOUBLECOLLECTION, PREGNANCY, KIACROSSMAPPING, INFOBUTTONLINK,
  ORDERS, PVPATIENTFOCUS, PVPATIENTSEARCHMPAGE, PMLISTMAINTENANCE,
  PEXAPPLICATIONSTATUS, CONMANAPPNOTIFIER were added. PVCONTXTMPAGE.SetPatient
  is not on the wiki and is now labelled reverse-engineered.
- **APPLINK modes**: 0 starts a solution by executable name (the documented
  chart-navigation mode), 1 by application object, 100 shell-executes.
  fluent-cerner-js navigates chart tabs with 100 — undocumented, flagged.
- **Context variables** (`$PAT_PersonId$` → `…​.00`, `*PAT_PersonId*` bare
  and URL-encoded) are documented for CCLLINK / APPLINK arguments and the
  Discern Report preferences only — never inside MPAGES_EVENT, and the wiki
  says nothing about XMLCclRequest parameters, so our envelope's reliance on
  that substitution is reverse-engineered.
- **The meta tag** is `content='A,B'` with no spaces and no `http-equiv` (the
  `http-equiv=Content-Type` in the production copy above is folklore, and
  `CCLNEWWINDOW` / `CCLEKSREPLYOBJECT` are not documented names); under Edge
  it is unnecessary, and page-defined shims of the native functions break.
- **Still reverse-engineered only**: `InvokeActivateAction` (seen in the
  production code above, on no wiki page, so not catalogued), the MPAGES_EVENT
  / DYNDOC return values fluent-cerner-js reads (the wiki documents none),
  the signed-orders reply record, `outsideOfPowerChartError`, and the `%PDF`
  missing-program sentinel.
- **XMLCclRequest**: async defaults to true; synchronous calls throw in Edge;
  send() parameters must be under 65535 characters (else status 500); the only
  statuses are 200/405/409/492/493/500; `setBlobIn` and `cleanup` exist.
